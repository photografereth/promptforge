import { GRACE_DAYS, PLANS } from '../../plans.js';
import { addDays } from '../access.js';
import { emails } from '../mailer.js';
import { paymentOutcome } from '../mercadopago.js';
import type { Subscription } from '../types.js';
import { canceledState, safeSend, type Deps } from './context.js';

const AMOUNT_EPSILON = 0.005;
const SUPPORTED = new Set(['subscription_preapproval', 'subscription_authorized_payment']);

const same = (a: Subscription, b: Subscription) => JSON.stringify(a) === JSON.stringify(b);
const amountEquals = (a: number, b: number) => Math.abs(a - b) <= AMOUNT_EPSILON;

export async function processPreapprovalEvent(deps: Deps, preapprovalId: string): Promise<void> {
  const pre = await deps.mp.getPreapproval(preapprovalId);
  const sub = await deps.repo.getByUser(pre.external_reference);

  if (!sub || sub.mp_preapproval_id !== pre.id) {
    await deps.repo.recordEvent({ user_id: null, actor: 'webhook', action: 'webhook.orphan_preapproval', mp_id: pre.id });
    return;
  }
  if (sub.status === 'canceled' && pre.status !== 'cancelled') {
    // Cancelada aqui (ex.: arrependimento) mas ainda ativa no MP: o cron de reconciliação cancela lá.
    await deps.repo.recordEvent({ user_id: sub.user_id, actor: 'webhook', action: 'webhook.ignored_after_cancel', mp_id: pre.id });
    return;
  }

  const now = deps.now();
  let next: Subscription = { ...sub, current_period_end: pre.next_payment_date ?? sub.current_period_end };

  if (pre.status === 'authorized') {
    // Só pending -> active. Sair de past_due exige um pagamento aprovado.
    if (sub.status === 'pending') next = { ...next, status: 'active' };
  } else if (pre.status === 'paused' && (sub.status === 'active' || sub.status === 'past_due')) {
    next = { ...next, status: 'past_due', grace_until: sub.grace_until ?? addDays(now, GRACE_DAYS).toISOString() };
  } else if (pre.status === 'cancelled') {
    next = { ...canceledState(sub), current_period_end: next.current_period_end };
  }

  if (same(sub, next)) return;

  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: sub.user_id,
    actor: 'webhook',
    action: 'webhook.preapproval',
    before: sub,
    after: next,
    mp_id: pre.id,
  });
  if (next.status === 'canceled' && sub.status !== 'canceled') {
    await safeSend(deps, sub.user_id, emails.subscriptionCanceled({ accessUntil: null }));
  }
}

export async function processAuthorizedPaymentEvent(deps: Deps, authorizedPaymentId: string): Promise<void> {
  const ap = await deps.mp.getAuthorizedPayment(authorizedPaymentId);
  const sub = await deps.repo.getByPreapprovalId(String(ap.preapproval_id));

  if (!sub) {
    await deps.repo.recordEvent({
      user_id: null,
      actor: 'webhook',
      action: 'webhook.orphan_authorized_payment',
      mp_id: String(ap.id),
    });
    return;
  }

  const outcome = paymentOutcome(ap);
  if (outcome === 'ignore') return;
  const now = deps.now();

  if (outcome === 'failed') {
    if (sub.status === 'canceled' || sub.status === 'pending') return;
    const next: Subscription = {
      ...sub,
      status: 'past_due',
      grace_until: sub.grace_until ?? addDays(now, GRACE_DAYS).toISOString(),
    };
    if (same(sub, next)) return;
    await deps.repo.save(next);
    await deps.repo.recordEvent({
      user_id: sub.user_id,
      actor: 'webhook',
      action: 'webhook.payment_failed',
      before: sub,
      after: next,
      mp_id: String(ap.id),
    });
    if (sub.status !== 'past_due') {
      await safeSend(
        deps,
        sub.user_id,
        emails.paymentFailed({ graceUntil: new Date(next.grace_until as string), updateCardUrl: deps.appUrl })
      );
    }
    return;
  }

  // outcome === 'paid'
  if (sub.status === 'canceled') {
    await deps.repo.recordEvent({
      user_id: sub.user_id,
      actor: 'webhook',
      action: 'webhook.paid_after_cancel',
      mp_id: String(ap.id),
    });
    return;
  }

  // Reconciliação de valor: o cobrado precisa bater com o plano (ou com a troca agendada).
  let plan = sub.plan;
  let promoted = false;
  if (!amountEquals(ap.transaction_amount, PLANS[sub.plan].amount)) {
    if (sub.pending_plan && amountEquals(ap.transaction_amount, PLANS[sub.pending_plan].amount)) {
      plan = sub.pending_plan;
      promoted = true;
    } else {
      await deps.repo.recordEvent({
        user_id: sub.user_id,
        actor: 'webhook',
        action: 'reconcile.amount_mismatch',
        after: { expected: PLANS[sub.plan].amount, received: ap.transaction_amount },
        mp_id: String(ap.id),
      });
      return;
    }
  }

  // Sem catch: se falhar, o erro propaga e o MP reenvia o webhook.
  const pre = await deps.mp.getPreapproval(sub.mp_preapproval_id as string);
  const periodEnd = pre.next_payment_date ?? sub.current_period_end;

  const next: Subscription = {
    ...sub,
    plan,
    status: 'active',
    grace_until: null,
    current_period_end: periodEnd,
    pending_plan: promoted ? null : sub.pending_plan,
    pending_plan_effective_at: promoted ? null : sub.pending_plan_effective_at,
    first_charge_at: sub.first_charge_at ?? now.toISOString(),
    first_payment_id: sub.first_payment_id ?? (ap.payment ? String(ap.payment.id) : null),
  };
  if (same(sub, next)) return;

  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: sub.user_id,
    actor: 'webhook',
    action: 'webhook.payment_paid',
    before: sub,
    after: next,
    mp_id: String(ap.id),
  });
  await safeSend(
    deps,
    sub.user_id,
    emails.receipt({
      planLabel: PLANS[plan].label,
      amount: ap.transaction_amount,
      nextChargeAt: periodEnd ? new Date(periodEnd) : null,
    })
  );
}

// Retorna o status HTTP para o handler. A chave inclui o x-request-id: o MP notifica o mesmo
// data.id várias vezes ao longo do ciclo de vida da cobrança e não podemos descartar as posteriores.
export async function handleWebhook(
  deps: Deps,
  evt: { type: string; dataId: string; requestId: string }
): Promise<number> {
  if (!SUPPORTED.has(evt.type) || !evt.dataId) return 200;

  const eventId = `${evt.dataId}:${evt.requestId}`;
  let claimed: boolean;
  try {
    claimed = await deps.repo.claimWebhookEvent(eventId, evt.type);
  } catch {
    return 500;
  }
  if (!claimed) return 200;

  try {
    if (evt.type === 'subscription_preapproval') await processPreapprovalEvent(deps, evt.dataId);
    else await processAuthorizedPaymentEvent(deps, evt.dataId);
    return 200;
  } catch {
    await deps.repo.releaseWebhookEvent(eventId, evt.type).catch(() => {});
    return 500;
  }
}
