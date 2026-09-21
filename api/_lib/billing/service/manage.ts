import { randomUUID } from 'node:crypto';
import { autoRecurringFor, isPlanId, PLANS } from '../../plans.js';
import { emails } from '../mailer.js';
import {
  canceledState,
  cancelPreapproval,
  fail,
  guard,
  idemKey,
  MP_ERROR,
  ok,
  safeSend,
  type Deps,
  type Result,
  type User,
} from './context.js';

const TEN_MIN = 10 * 60_000;

function isToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 200;
}

// PUTs de valor são idempotentes por natureza e o mesmo par (plano, período) pode se repetir
// legitimamente (agendar, desfazer, agendar de novo): a chave é única por chamada.
const freshKey = (...parts: string[]) => idemKey(...parts, randomUUID());

export async function changePlan(deps: Deps, user: User, input: { plan?: unknown }): Promise<Result> {
  const { plan } = input;
  if (!isPlanId(plan)) return fail(400, 'Plano inválido.');

  const limited = await guard(deps, user.id, 'change-plan', 10, TEN_MIN);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  if (!sub || sub.status !== 'active' || !sub.mp_preapproval_id) {
    return fail(409, 'Você precisa de uma assinatura ativa para trocar de plano.');
  }
  if (sub.cancel_at_period_end) return fail(409, 'Retome a assinatura antes de trocar de plano.');
  if (plan === sub.plan) return fail(409, 'Você já está neste plano.');
  if (!sub.current_period_end) {
    return fail(409, 'Aguarde a confirmação da primeira cobrança para trocar de plano.');
  }

  try {
    await deps.mp.updatePreapproval(
      sub.mp_preapproval_id,
      { auto_recurring: autoRecurringFor(plan) },
      freshKey(user.id, 'change-plan', plan)
    );
  } catch {
    return fail(502, MP_ERROR);
  }

  const next = { ...sub, pending_plan: plan, pending_plan_effective_at: sub.current_period_end };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'change_plan.scheduled',
    before: sub,
    after: next,
    mp_id: sub.mp_preapproval_id,
  });
  await safeSend(
    deps,
    user.id,
    emails.planChangeScheduled({ planLabel: PLANS[plan].label, effectiveAt: new Date(sub.current_period_end) })
  );
  return ok({ pendingPlan: plan, effectiveAt: sub.current_period_end });
}

export async function undoPlanChange(deps: Deps, user: User): Promise<Result> {
  const limited = await guard(deps, user.id, 'change-plan', 10, TEN_MIN);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  if (!sub || sub.status !== 'active' || !sub.mp_preapproval_id || !sub.pending_plan) {
    return fail(409, 'Não há troca de plano agendada.');
  }

  try {
    await deps.mp.updatePreapproval(
      sub.mp_preapproval_id,
      { auto_recurring: autoRecurringFor(sub.plan) },
      freshKey(user.id, 'undo-plan-change', sub.plan)
    );
  } catch {
    return fail(502, MP_ERROR);
  }

  const next = { ...sub, pending_plan: null, pending_plan_effective_at: null };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'change_plan.undone',
    before: sub,
    after: next,
    mp_id: sub.mp_preapproval_id,
  });
  return ok();
}

export async function updateCard(deps: Deps, user: User, input: { cardToken?: unknown }): Promise<Result> {
  const { cardToken } = input;
  if (!isToken(cardToken)) return fail(400, 'Dados do cartão inválidos.');

  const limited = await guard(deps, user.id, 'update-card', 10, TEN_MIN);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  if (!sub || !sub.mp_preapproval_id || (sub.status !== 'active' && sub.status !== 'past_due')) {
    return fail(409, 'Você precisa de uma assinatura ativa para trocar o cartão.');
  }

  try {
    await deps.mp.updatePreapproval(
      sub.mp_preapproval_id,
      { card_token_id: cardToken },
      idemKey(user.id, 'update-card', cardToken)
    );
  } catch {
    return fail(502, MP_ERROR);
  }

  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'update_card',
    mp_id: sub.mp_preapproval_id,
  });
  return ok();
}

export async function cancelSubscription(deps: Deps, user: User): Promise<Result> {
  const limited = await guard(deps, user.id, 'cancel', 10, TEN_MIN);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  if (!sub || !sub.mp_preapproval_id || (sub.status !== 'active' && sub.status !== 'past_due')) {
    return fail(409, 'Não há assinatura para cancelar.');
  }

  // Em carência não há período pago a preservar: cancela de verdade agora.
  if (sub.status === 'past_due') {
    try {
      await cancelPreapproval(deps, sub, 'cancel-now');
    } catch {
      return fail(502, MP_ERROR);
    }
    const next = canceledState(sub);
    await deps.repo.save(next);
    await deps.repo.recordEvent({
      user_id: user.id,
      actor: 'user',
      action: 'cancel.immediate',
      before: sub,
      after: next,
      mp_id: sub.mp_preapproval_id,
    });
    await safeSend(deps, user.id, emails.subscriptionCanceled({ accessUntil: null }));
    return ok({ status: 'canceled' });
  }

  if (sub.cancel_at_period_end) {
    return ok({ cancelAtPeriodEnd: true, accessUntil: sub.current_period_end });
  }

  const next = { ...sub, cancel_at_period_end: true };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'cancel.scheduled',
    before: sub,
    after: next,
    mp_id: sub.mp_preapproval_id,
  });
  await safeSend(
    deps,
    user.id,
    emails.subscriptionCanceled({ accessUntil: sub.current_period_end ? new Date(sub.current_period_end) : null })
  );
  return ok({ cancelAtPeriodEnd: true, accessUntil: sub.current_period_end });
}

export async function resumeSubscription(deps: Deps, user: User): Promise<Result> {
  const limited = await guard(deps, user.id, 'cancel', 10, TEN_MIN);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  if (!sub || sub.status !== 'active' || !sub.cancel_at_period_end) {
    return fail(409, 'Não há cancelamento agendado.');
  }

  const next = { ...sub, cancel_at_period_end: false };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'resume',
    before: sub,
    after: next,
    mp_id: sub.mp_preapproval_id,
  });
  return ok();
}
