import { apiFetch } from './apiFetch';

export type PlanId = 'monthly' | 'annual';

export interface BillingStatus {
  status: 'none' | 'pending' | 'active' | 'past_due' | 'canceled';
  plan?: PlanId;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  pendingPlan?: PlanId | null;
  pendingPlanEffectiveAt?: string | null;
  graceUntil?: string | null;
  hasAccess: boolean;
  canWithdraw: boolean;
  withdrawDeadline?: string | null;
}

export interface Invoice {
  id: string;
  date: string | null;
  amount: number;
  status: 'paid' | 'failed' | 'scheduled';
}

export class BillingApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'BillingApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/api/billing/${path}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new BillingApiError(res.status, json.error ?? 'Algo deu errado. Tente novamente.');
  return json as T;
}

const post = (path: string, body?: unknown) =>
  request<{ ok: true }>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const billingApi = {
  status: () => request<BillingStatus>('status'),
  config: () => request<{ publicKey: string }>('config'),
  invoices: () => request<{ invoices: Invoice[] }>('invoices'),
  subscribe: (plan: PlanId, cardToken: string) => post('subscribe', { plan, cardToken }),
  changePlan: (plan: PlanId) => post('change-plan', { plan }),
  undoPlanChange: () => request<{ ok: true }>('change-plan', { method: 'DELETE' }),
  updateCard: (cardToken: string) => post('update-card', { cardToken }),
  cancel: () => post('cancel'),
  resume: () => post('resume'),
  withdraw: () => post('withdraw'),
};
