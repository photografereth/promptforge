import type { PlanId } from '../lib/billingApi';

// Só exibição. O preço cobrado é definido no servidor (api/_lib/plans.ts).
export const PLAN_INFO: Record<
  PlanId,
  { label: string; price: number; priceLabel: string; period: string; note: string }
> = {
  monthly: {
    label: 'Mensal',
    price: 119,
    priceLabel: 'R$ 119,00',
    period: 'por mês',
    note: 'Renova todo mês no cartão. Cancele quando quiser.',
  },
  annual: {
    label: 'Anual',
    price: 948,
    priceLabel: 'R$ 948,00',
    period: 'por ano',
    note: 'Uma cobrança única por ano (equivale a R$ 79,00 por mês).',
  },
};
