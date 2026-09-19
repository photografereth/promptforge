export type PlanId = 'monthly' | 'annual';
export type SubStatus = 'pending' | 'active' | 'past_due' | 'canceled';
export type BillingActor = 'user' | 'webhook' | 'cron' | 'system';

export interface Subscription {
  user_id: string;
  mp_preapproval_id: string | null;
  plan: PlanId;
  status: SubStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  pending_plan: PlanId | null;
  pending_plan_effective_at: string | null;
  grace_until: string | null;
  first_charge_at: string | null;
  first_payment_id: string | null;
  refunded_at: string | null;
}

export interface BillingEventInput {
  user_id: string | null;
  actor: BillingActor;
  action: string;
  before?: unknown;
  after?: unknown;
  mp_id?: string | null;
}

// Persistência de cobrança. Implementações: repo.ts (Supabase) e testing/memoryRepo.ts.
export interface BillingRepo {
  getByUser(userId: string): Promise<Subscription | null>;
  getByPreapprovalId(preapprovalId: string): Promise<Subscription | null>;
  // Upsert da linha inteira + espelho em profiles.
  save(sub: Subscription): Promise<void>;
  recordEvent(event: BillingEventInput): Promise<void>;
  countEvents(userId: string, action: string, sinceIso: string): Promise<number>;
  // true se o evento foi registrado agora; false se já existia.
  claimWebhookEvent(eventId: string, eventType: string): Promise<boolean>;
  releaseWebhookEvent(eventId: string, eventType: string): Promise<void>;
  listCancellationsDue(nowIso: string): Promise<Subscription[]>;
  listGraceExpired(nowIso: string): Promise<Subscription[]>;
  // pending/active/past_due + canceladas atualizadas desde `recentCanceledSinceIso`.
  listReconcilable(recentCanceledSinceIso: string): Promise<Subscription[]>;
  getProfileEmail(userId: string): Promise<string | null>;
}
