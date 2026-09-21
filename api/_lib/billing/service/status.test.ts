import { describe, it, expect } from 'vitest';
import { getInvoices, getStatus } from './status';
import { makeAuthorizedPayment, makeDeps, USER } from '../testing/fakes';
import { daysFromNow, makeSub } from '../testing/fixtures';

describe('getStatus', () => {
  it('sem assinatura', async () => {
    const res = await getStatus(makeDeps().deps, USER);
    expect(res.body).toEqual({ ok: true, status: 'none', hasAccess: false, canWithdraw: false });
  });
  it('active dentro da janela de arrependimento', async () => {
    const sub = makeSub({ first_charge_at: daysFromNow(-3) });
    const res = await getStatus(makeDeps({ subs: [sub] }).deps, USER);
    expect(res.body).toMatchObject({
      status: 'active',
      plan: 'monthly',
      hasAccess: true,
      canWithdraw: true,
      withdrawDeadline: daysFromNow(4),
      cancelAtPeriodEnd: false,
      pendingPlan: null,
    });
  });
  it('past_due com carência mantém acesso; sem carência não', async () => {
    const withGrace = await getStatus(makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(2) })] }).deps, USER);
    expect(withGrace.body).toMatchObject({ status: 'past_due', hasAccess: true, graceUntil: daysFromNow(2), canWithdraw: false });
    const expired = await getStatus(makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(-1) })] }).deps, USER);
    expect(expired.body).toMatchObject({ hasAccess: false });
  });
});

describe('getInvoices', () => {
  it('lista vazia sem assinatura', async () => {
    expect((await getInvoices(makeDeps().deps, USER)).body).toEqual({ ok: true, invoices: [] });
  });
  it('mapeia cobranças do MP para paid/failed/scheduled', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    mp.searchAuthorizedPayments.mockResolvedValueOnce([
      makeAuthorizedPayment({ id: 1, status: 'processed', transaction_amount: 119, debit_date: '2026-09-15T12:00:00.000Z' }),
      makeAuthorizedPayment({ id: 2, status: 'recycling', payment: { id: 8, status: 'rejected' } }),
      makeAuthorizedPayment({ id: 3, status: 'scheduled', payment: undefined }),
    ]);
    const res = await getInvoices(deps, USER);
    expect(mp.searchAuthorizedPayments).toHaveBeenCalledWith('pre_1');
    expect(res.body.invoices).toEqual([
      { id: '1', date: '2026-09-15T12:00:00.000Z', amount: 119, status: 'paid' },
      { id: '2', date: expect.any(String), amount: 119, status: 'failed' },
      { id: '3', date: expect.any(String), amount: 119, status: 'scheduled' },
    ]);
  });
  it('502 se o MP falhar', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    mp.searchAuthorizedPayments.mockRejectedValueOnce(new Error('mp'));
    expect((await getInvoices(deps, USER)).status).toBe(502);
  });
});
