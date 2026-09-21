import { describe, it, expect } from 'vitest';
import { subscribe } from './subscribe.js';
import { makeDeps, USER } from '../testing/fakes.js';
import { makeSub, daysFromNow } from '../testing/fixtures.js';

const TOKEN = 'card-token-12345';

describe('subscribe', () => {
  it('rejeita plano e token inválidos', async () => {
    const { deps, mp } = makeDeps();
    expect((await subscribe(deps, USER, { plan: 'gratis', cardToken: TOKEN })).status).toBe(400);
    expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: 'x' })).status).toBe(400);
    expect((await subscribe(deps, USER, { plan: 'monthly' })).status).toBe(400);
    expect(mp.createPreapproval).not.toHaveBeenCalled();
  });

  it('cria a preapproval com preço do servidor e grava pending', async () => {
    const { deps, mp, repo } = makeDeps();
    const res = await subscribe(deps, USER, { plan: 'annual', cardToken: TOKEN });
    expect(res).toEqual({ status: 200, body: { ok: true, status: 'pending' } });

    const [input, key] = mp.createPreapproval.mock.calls[0];
    expect(input).toMatchObject({
      external_reference: 'user-1',
      payer_email: 'ana@example.com',
      card_token_id: TOKEN,
      status: 'authorized',
      back_url: 'https://app.example.com/subscription/confirm',
      auto_recurring: { frequency: 1, frequency_type: 'years', transaction_amount: 948, currency_id: 'BRL' },
    });
    expect(key).toMatch(/^[0-9a-f]{64}$/);

    const saved = await repo.getByUser('user-1');
    expect(saved).toMatchObject({ plan: 'annual', status: 'pending', mp_preapproval_id: 'pre_1', refunded_at: null });
    expect(repo.events.map((e) => e.action)).toContain('subscribe');
  });

  it('ignora preço enviado pelo cliente', async () => {
    const { deps, mp } = makeDeps();
    await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN, amount: 1 } as never);
    expect(mp.createPreapproval.mock.calls[0][0].auto_recurring.transaction_amount).toBe(119);
  });

  it('recusa quando já existe assinatura não cancelada', async () => {
    for (const status of ['pending', 'active', 'past_due'] as const) {
      const { deps, mp } = makeDeps({ subs: [makeSub({ status })] });
      expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN })).status).toBe(409);
      expect(mp.createPreapproval).not.toHaveBeenCalled();
    }
  });

  it('permite reassinar após cancelamento e preserva refunded_at (um reembolso por conta)', async () => {
    const refundedAt = daysFromNow(-30);
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'canceled', refunded_at: refundedAt, first_charge_at: refundedAt })] });
    const res = await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN });
    expect(res.status).toBe(200);
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'pending', refunded_at: refundedAt, first_charge_at: null, first_payment_id: null });
  });

  it('falha do MP devolve 502 e não grava nada', async () => {
    const { deps, mp, repo } = makeDeps();
    mp.createPreapproval.mockRejectedValueOnce(new Error('mp fora do ar'));
    expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN })).status).toBe(502);
    expect(await repo.getByUser('user-1')).toBeNull();
  });

  it('limita tentativas (5 por 10 minutos); entrada inválida não consome o limite', async () => {
    const { deps } = makeDeps();
    for (let i = 0; i < 10; i++) await subscribe(deps, USER, { plan: 'gratis' as never, cardToken: TOKEN });
    // 1ª válida cria (200); as seguintes batem em 409 mas contam no limite
    expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN })).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN })).status).toBe(409);
    expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN })).status).toBe(429);
  });
});
