import { describe, it, expect } from 'vitest';
import { routeBilling } from './router';
import { makeDeps, USER } from './testing/fakes';
import { makeSub } from './testing/fixtures';

describe('routeBilling', () => {
  it('404 para ação desconhecida (inclusive chaves de protótipo)', async () => {
    const { deps } = makeDeps();
    expect((await routeBilling(deps, USER, 'nada', 'GET', {})).status).toBe(404);
    expect((await routeBilling(deps, USER, '__proto__', 'GET', {})).status).toBe(404);
    expect((await routeBilling(deps, USER, 'constructor', 'GET', {})).status).toBe(404);
  });
  it('405 para método não suportado', async () => {
    const { deps } = makeDeps();
    expect((await routeBilling(deps, USER, 'status', 'POST', {})).status).toBe(405);
    expect((await routeBilling(deps, USER, 'subscribe', 'GET', {})).status).toBe(405);
  });
  it('config devolve só a chave pública', async () => {
    const { deps } = makeDeps();
    expect((await routeBilling(deps, USER, 'config', 'GET', {})).body).toEqual({ ok: true, publicKey: 'public-key-de-teste' });
  });
  it('subscribe repassa só plan e cardToken (preço do cliente é ignorado)', async () => {
    const { deps, mp } = makeDeps();
    const res = await routeBilling(deps, USER, 'subscribe', 'POST', { plan: 'monthly', cardToken: 'token-de-cartao-1', amount: 1, user_id: 'outro' });
    expect(res.status).toBe(200);
    const [input] = mp.createPreapproval.mock.calls[0];
    expect(input.auto_recurring.transaction_amount).toBe(119);
    expect(input.external_reference).toBe('user-1');
  });
  it('DELETE change-plan desfaz a troca agendada; status funciona', async () => {
    const { deps } = makeDeps({ subs: [makeSub({ pending_plan: 'annual' })] });
    expect((await routeBilling(deps, USER, 'change-plan', 'DELETE', {})).status).toBe(200);
    expect((await routeBilling(deps, USER, 'status', 'GET', {})).body).toMatchObject({ status: 'active', pendingPlan: null });
  });
  it('roteia cancel e resume (POST) e recusa GET', async () => {
    const { deps } = makeDeps({ subs: [makeSub()] });
    expect((await routeBilling(deps, USER, 'cancel', 'POST', {})).body).toMatchObject({ cancelAtPeriodEnd: true });
    expect((await routeBilling(deps, USER, 'resume', 'POST', {})).status).toBe(200);
    expect((await routeBilling(deps, USER, 'cancel', 'GET', {})).status).toBe(405);
  });
});
