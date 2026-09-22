import { autoRecurringFor, isPlanId, PLANS } from '../../plans.js';
import type { Subscription } from '../types.js';
import { fail, guard, idemKey, MP_ERROR, ok, type Deps, type Result, type User } from './context.js';

const TEN_MIN = 10 * 60_000;

export async function subscribe(
  deps: Deps,
  user: User,
  input: { plan?: unknown; cardToken?: unknown }
): Promise<Result> {
  const { plan, cardToken } = input;
  if (!isPlanId(plan)) return fail(400, 'Plano inválido.');
  if (typeof cardToken !== 'string' || cardToken.length < 8 || cardToken.length > 200) {
    return fail(400, 'Dados do cartão inválidos.');
  }

  const limited = await guard(deps, user.id, 'subscribe', 5, TEN_MIN);
  if (limited) return limited;

  const existing = await deps.repo.getByUser(user.id);
  if (existing && existing.status !== 'canceled') return fail(409, 'Você já possui uma assinatura.');

  let preapproval;
  try {
    preapproval = await deps.mp.createPreapproval(
      {
        reason: `Flow Prompt Forge — ${PLANS[plan].label}`,
        external_reference: user.id,
        payer_email: user.email,
        card_token_id: cardToken,
        auto_recurring: autoRecurringFor(plan),
        back_url: `${deps.appUrl}/subscription/confirm`,
        notification_url: deps.notificationUrl,
        status: 'authorized',
      },
      // O token é de uso único: a mesma tentativa repetida cai na mesma chave.
      idemKey(user.id, 'subscribe', plan, cardToken)
    );
  } catch {
    return fail(502, MP_ERROR);
  }

  const next: Subscription = {
    user_id: user.id,
    mp_preapproval_id: preapproval.id,
    plan,
    status: 'pending',
    current_period_end: null,
    cancel_at_period_end: false,
    pending_plan: null,
    pending_plan_effective_at: null,
    grace_until: null,
    first_charge_at: null,
    first_payment_id: null,
    // Um reembolso por conta: quem já exerceu o arrependimento não exerce de novo.
    refunded_at: existing?.refunded_at ?? null,
  };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'subscribe',
    before: existing,
    after: next,
    mp_id: preapproval.id,
  });
  return ok({ status: 'pending' });
}
