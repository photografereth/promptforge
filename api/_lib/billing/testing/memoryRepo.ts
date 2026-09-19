import type { BillingEventInput, BillingRepo, Subscription } from '../types';

export interface MemoryRepo extends BillingRepo {
  events: BillingEventInput[];
  subs: Map<string, Subscription>;
  setEmail(userId: string, email: string): void;
}

// Implementação em memória de BillingRepo, só para testes. `clock` controla o "agora".
export function createMemoryRepo(seed: Subscription[] = [], clock: () => Date = () => new Date()): MemoryRepo {
  const subs = new Map<string, Subscription>();
  const updatedAt = new Map<string, number>();
  const events: BillingEventInput[] = [];
  const eventTimes: number[] = [];
  const claims = new Set<string>();
  const emails = new Map<string, string>();

  for (const s of seed) {
    subs.set(s.user_id, { ...s });
    updatedAt.set(s.user_id, clock().getTime());
  }

  const list = (predicate: (s: Subscription) => boolean) => [...subs.values()].filter(predicate).map((s) => ({ ...s }));

  return {
    events,
    subs,
    setEmail: (userId, email) => void emails.set(userId, email),

    async getByUser(userId) {
      const s = subs.get(userId);
      return s ? { ...s } : null;
    },
    async getByPreapprovalId(id) {
      const s = [...subs.values()].find((x) => x.mp_preapproval_id === id);
      return s ? { ...s } : null;
    },
    async save(sub) {
      subs.set(sub.user_id, { ...sub });
      updatedAt.set(sub.user_id, clock().getTime());
    },
    async recordEvent(event) {
      events.push(event);
      eventTimes.push(clock().getTime());
    },
    async countEvents(userId, action, sinceIso) {
      const since = new Date(sinceIso).getTime();
      return events.filter((e, i) => e.user_id === userId && e.action === action && eventTimes[i] >= since).length;
    },
    async claimWebhookEvent(eventId, eventType) {
      const key = `${eventId}|${eventType}`;
      if (claims.has(key)) return false;
      claims.add(key);
      return true;
    },
    async releaseWebhookEvent(eventId, eventType) {
      claims.delete(`${eventId}|${eventType}`);
    },
    async listCancellationsDue(nowIso) {
      const now = new Date(nowIso).getTime();
      return list(
        (s) =>
          s.status === 'active' &&
          s.cancel_at_period_end &&
          !!s.current_period_end &&
          new Date(s.current_period_end).getTime() <= now
      );
    },
    async listGraceExpired(nowIso) {
      const now = new Date(nowIso).getTime();
      return list((s) => s.status === 'past_due' && !!s.grace_until && new Date(s.grace_until).getTime() <= now);
    },
    async listReconcilable(sinceIso) {
      const since = new Date(sinceIso).getTime();
      return list(
        (s) =>
          s.status === 'pending' ||
          s.status === 'active' ||
          s.status === 'past_due' ||
          (s.status === 'canceled' && (updatedAt.get(s.user_id) ?? 0) >= since)
      );
    },
    async getProfileEmail(userId) {
      return emails.get(userId) ?? null;
    },
  };
}
