import type { Subscription } from '../types.js';

export const NOW = new Date('2026-09-18T12:00:00.000Z');

export function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

export function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    user_id: 'user-1',
    mp_preapproval_id: 'pre_1',
    plan: 'monthly',
    status: 'active',
    current_period_end: daysFromNow(27),
    cancel_at_period_end: false,
    pending_plan: null,
    pending_plan_effective_at: null,
    grace_until: null,
    first_charge_at: daysFromNow(-3),
    first_payment_id: '999',
    refunded_at: null,
    ...overrides,
  };
}
