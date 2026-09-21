import { describe, it, expect } from 'vitest';
import { runBillingCron } from './cron';
import { makeDeps, makePreapproval } from '../testing/fakes';
import { daysFromNow, makeSub } from '../testing/fixtures';

const cancelled = makePreapproval({ status: 'cancelled' });

describe('runBillingCron', () => {
  it('cancela no MP as assinaturas com cancelamento agendado e período vencido', async () => {
    const { deps, mp, repo, mailer } = makeDeps({ subs: [makeSub({ cancel_at_period_end: true, current_period_end: daysFromNow(-1) })] });
    mp.getPreapproval.mockResolvedValue(cancelled);
    const summary = await runBillingCron(deps);
    expect(summary).toEqual({ canceledAtPeriodEnd: 1, graceExpired: 0, reconciled: 0, errors: 0 });
    expect(mp.updatePreapproval).toHaveBeenCalledTimes(1);
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { status: 'cancelled' }, expect.any(String));
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled', cancel_at_period_end: false });
    expect(repo.events.map((e) => e.action)).toContain('cron.cancel_at_period_end');
    expect(mailer.sent).toHaveLength(1);
  });

  it('encerra carências vencidas', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(-1) })] });
    mp.getPreapproval.mockResolvedValue(cancelled);
    const summary = await runBillingCron(deps);
    expect(summary.graceExpired).toBe(1);
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled', grace_until: null });
  });

  it('não mexe em assinaturas ativas que não venceram', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ cancel_at_period_end: true, current_period_end: daysFromNow(5) })] });
    const summary = await runBillingCron(deps);
    expect(summary).toEqual({ canceledAtPeriodEnd: 0, graceExpired: 0, reconciled: 0, errors: 0 });
    expect(mp.updatePreapproval).not.toHaveBeenCalled();
    expect((await repo.getByUser('user-1'))?.status).toBe('active');
  });

  it('reconcilia: cancelada localmente mas ativa no MP é cancelada no MP', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ status: 'canceled' })] });
    const summary = await runBillingCron(deps);
    expect(summary.reconciled).toBe(1);
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { status: 'cancelled' }, expect.any(String));
    expect(repo.events.map((e) => e.action)).toContain('reconcile.cancel_in_mp');
  });

  it('reconcilia: ativa localmente mas cancelada no MP vira cancelada', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub()] });
    mp.getPreapproval.mockResolvedValue(cancelled);
    expect((await runBillingCron(deps)).reconciled).toBe(1);
    expect((await repo.getByUser('user-1'))?.status).toBe('canceled');
    expect(repo.events.map((e) => e.action)).toContain('reconcile.local_canceled');
  });

  it('reconcilia: pending autorizada no MP (webhook perdido) vira active', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'pending', current_period_end: null })] });
    expect((await runBillingCron(deps)).reconciled).toBe(1);
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', current_period_end: daysFromNow(27) });
  });

  it('erro em um usuário não interrompe o lote e é contabilizado', async () => {
    const due = { cancel_at_period_end: true, current_period_end: daysFromNow(-1) };
    const { deps, mp, repo } = makeDeps({
      subs: [
        makeSub({ user_id: 'user-1', mp_preapproval_id: 'pre_1', ...due }),
        makeSub({ user_id: 'user-2', mp_preapproval_id: 'pre_2', ...due }),
      ],
    });
    // getPreapproval fica no padrão (authorized): a reconciliação não altera user-1 (ativa) nem user-2 já cancelada localmente.
    mp.updatePreapproval.mockRejectedValueOnce(new Error('mp fora do ar'));
    const summary = await runBillingCron(deps);
    expect(summary).toMatchObject({ canceledAtPeriodEnd: 1, errors: 1 });
    expect((await repo.getByUser('user-1'))?.status).toBe('active'); // tenta de novo amanhã
    expect((await repo.getByUser('user-2'))?.status).toBe('canceled');
    expect(repo.events.map((e) => e.action)).toContain('cron.error');
  });
});
