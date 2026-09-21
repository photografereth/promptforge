import { describe, it, expect } from 'vitest';
import { withdraw } from './withdraw';
import { makeDeps, USER } from '../testing/fakes';
import { daysFromNow, makeSub, NOW } from '../testing/fixtures';

describe('withdraw', () => {
  it('dentro de 7 dias: reembolsa a primeira cobrança, cancela a preapproval e revoga o acesso', async () => {
    const { deps, mp, repo, mailer } = makeDeps({ subs: [makeSub({ first_charge_at: daysFromNow(-3), first_payment_id: '999' })] });
    const res = await withdraw(deps, USER);
    expect(res).toEqual({ status: 200, body: { ok: true, status: 'canceled' } });
    expect(mp.refundPayment).toHaveBeenCalledWith('999', expect.any(String));
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { status: 'cancelled' }, expect.any(String));
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled', refunded_at: NOW.toISOString() });
    expect(repo.events.map((e) => e.action)).toContain('withdraw');
    expect(mailer.sent[0].message.subject).toBe('Reembolso concluído');
  });

  it('fora da janela: 409 e nenhuma chamada ao MP', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub({ first_charge_at: daysFromNow(-8) })] });
    const res = await withdraw(deps, USER);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ reason: 'expired' });
    expect(mp.refundPayment).not.toHaveBeenCalled();
  });

  it('sem assinatura ativa ou sem cobrança confirmada: 409', async () => {
    expect((await withdraw(makeDeps().deps, USER)).body).toMatchObject({ reason: 'not_active' });
    expect((await withdraw(makeDeps({ subs: [makeSub({ first_payment_id: null })] }).deps, USER)).body).toMatchObject({ reason: 'no_charge' });
  });

  it('falha no reembolso: 502 e o estado não muda (nunca cancela sem reembolsar)', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub()] });
    mp.refundPayment.mockRejectedValueOnce(new Error('mp'));
    expect((await withdraw(deps, USER)).status).toBe(502);
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', refunded_at: null });
    expect(mp.updatePreapproval).not.toHaveBeenCalled();
  });

  it('reembolso feito mas cancelamento no MP falha: grava cancelado e registra para a reconciliação', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub()] });
    mp.updatePreapproval.mockRejectedValueOnce(new Error('mp'));
    expect((await withdraw(deps, USER)).status).toBe(200);
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled' });
    expect(repo.events.map((e) => e.action)).toContain('withdraw.cancel_failed');
  });

  it('segunda tentativa após reembolso: 409', async () => {
    const { deps } = makeDeps({ subs: [makeSub()] });
    await withdraw(deps, USER);
    expect((await withdraw(deps, USER)).status).toBe(409);
  });

  it('rate limit estrito: 3 tentativas por hora', async () => {
    const { deps } = makeDeps({ subs: [makeSub({ first_charge_at: daysFromNow(-8) })] });
    for (let i = 0; i < 3; i++) expect((await withdraw(deps, USER)).status).toBe(409);
    expect((await withdraw(deps, USER)).status).toBe(429);
  });
});
