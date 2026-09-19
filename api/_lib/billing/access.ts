import { WITHDRAW_DAYS } from '../plans';
import type { PlanId, Subscription } from './types';

const DAY_MS = 86_400_000;

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

// Regra única de acesso, avaliada só no backend.
export function hasAccess(
  sub: Pick<Subscription, 'status' | 'grace_until'> | null,
  now: Date
): boolean {
  if (!sub) return false;
  if (sub.status === 'active') return true;
  if (sub.status === 'past_due' && sub.grace_until) {
    return new Date(sub.grace_until).getTime() > now.getTime();
  }
  return false;
}

export type WithdrawCheck =
  | { ok: true; deadline: Date }
  | { ok: false; reason: 'not_active' | 'no_charge' | 'already_refunded' | 'expired' };

export function checkWithdraw(sub: Subscription | null, now: Date): WithdrawCheck {
  if (!sub || sub.status !== 'active') return { ok: false, reason: 'not_active' };
  if (sub.refunded_at) return { ok: false, reason: 'already_refunded' };
  if (!sub.first_charge_at || !sub.first_payment_id) return { ok: false, reason: 'no_charge' };
  const deadline = addDays(new Date(sub.first_charge_at), WITHDRAW_DAYS);
  if (now.getTime() >= deadline.getTime()) return { ok: false, reason: 'expired' };
  return { ok: true, deadline };
}

// Espelho em public.profiles (legado do Pilar 1). 'trial' significa "sem assinatura":
// nenhum trial é concedido, e o acesso nunca é decidido a partir de profiles.
export function profileMirror(sub: Pick<Subscription, 'status' | 'plan'>): {
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled';
  plan: PlanId | null;
} {
  const subscription_status = sub.status === 'pending' ? 'trial' : sub.status;
  const plan = sub.status === 'active' || sub.status === 'past_due' ? sub.plan : null;
  return { subscription_status, plan };
}
