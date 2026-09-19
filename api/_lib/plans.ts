import type { PlanId } from './billing/types';

export const GRACE_DAYS = 7;
export const WITHDRAW_DAYS = 7;

export const PLANS = {
  monthly: { amount: 119.0, frequency: 1, frequencyType: 'months', label: 'Plano Mensal' },
  annual: { amount: 948.0, frequency: 1, frequencyType: 'years', label: 'Plano Anual' },
} as const satisfies Record<
  PlanId,
  { amount: number; frequency: number; frequencyType: 'months' | 'years'; label: string }
>;

export function isPlanId(value: unknown): value is PlanId {
  return value === 'monthly' || value === 'annual';
}

export function autoRecurringFor(plan: PlanId) {
  const p = PLANS[plan];
  return {
    frequency: p.frequency,
    frequency_type: p.frequencyType,
    transaction_amount: p.amount,
    currency_id: 'BRL' as const,
  };
}
