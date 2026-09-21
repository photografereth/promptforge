import { checkWithdraw, hasAccess } from '../access';
import { paymentOutcome } from '../mercadopago';
import { fail, MP_ERROR, ok, type Deps, type Result, type User } from './context';

export async function getStatus(deps: Deps, user: User): Promise<Result> {
  const sub = await deps.repo.getByUser(user.id);
  if (!sub) return ok({ status: 'none', hasAccess: false, canWithdraw: false });

  const now = deps.now();
  const withdrawal = checkWithdraw(sub, now);
  return ok({
    status: sub.status,
    plan: sub.plan,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    pendingPlan: sub.pending_plan,
    pendingPlanEffectiveAt: sub.pending_plan_effective_at,
    graceUntil: sub.grace_until,
    hasAccess: hasAccess(sub, now),
    canWithdraw: withdrawal.ok,
    withdrawDeadline: withdrawal.ok ? withdrawal.deadline.toISOString() : null,
  });
}

export async function getInvoices(deps: Deps, user: User): Promise<Result> {
  const sub = await deps.repo.getByUser(user.id);
  if (!sub?.mp_preapproval_id) return ok({ invoices: [] });

  try {
    const payments = await deps.mp.searchAuthorizedPayments(sub.mp_preapproval_id);
    const invoices = payments.map((ap) => {
      const outcome = paymentOutcome(ap);
      return {
        id: String(ap.id),
        date: ap.debit_date ?? null,
        amount: ap.transaction_amount,
        status: outcome === 'paid' ? 'paid' : outcome === 'failed' ? 'failed' : 'scheduled',
      };
    });
    return ok({ invoices });
  } catch {
    return fail(502, MP_ERROR);
  }
}
