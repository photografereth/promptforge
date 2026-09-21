import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { profileMirror } from './access.js';
import type { BillingEventInput, BillingRepo, Subscription } from './types.js';

const COLUMNS =
  'user_id, mp_preapproval_id, plan, status, current_period_end, cancel_at_period_end, ' +
  'pending_plan, pending_plan_effective_at, grace_until, first_charge_at, first_payment_id, refunded_at';

export function createSupabaseRepo(client: SupabaseClient = supabaseAdmin): BillingRepo {
  const one = async (column: string, value: string): Promise<Subscription | null> => {
    const { data, error } = await client.from('subscriptions').select(COLUMNS).eq(column, value).maybeSingle();
    if (error) throw error;
    return (data as unknown as Subscription | null) ?? null;
  };
  const many = async (rows: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const { data, error } = await rows;
    if (error) throw new Error(error.message);
    return (data as unknown as Subscription[]) ?? [];
  };

  return {
    getByUser: (userId) => one('user_id', userId),
    getByPreapprovalId: (id) => one('mp_preapproval_id', id),

    async save(sub) {
      const { error } = await client
        .from('subscriptions')
        .upsert({ ...sub, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      const { error: mirrorError } = await client
        .from('profiles')
        .update(profileMirror(sub))
        .eq('id', sub.user_id);
      if (mirrorError) throw mirrorError;
    },

    async recordEvent(event: BillingEventInput) {
      const { error } = await client.from('billing_events').insert({
        user_id: event.user_id,
        actor: event.actor,
        action: event.action,
        before: event.before ?? null,
        after: event.after ?? null,
        mp_id: event.mp_id ?? null,
      });
      if (error) throw error;
    },

    async countEvents(userId, action, sinceIso) {
      const { count, error } = await client
        .from('billing_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action', action)
        .gte('created_at', sinceIso);
      if (error) throw error;
      return count ?? 0;
    },

    async claimWebhookEvent(eventId, eventType) {
      const { error } = await client.from('webhook_events').insert({ event_id: eventId, event_type: eventType });
      if (!error) return true;
      if (error.code === '23505') return false; // unique_violation: já processado
      throw error;
    },

    async releaseWebhookEvent(eventId, eventType) {
      const { error } = await client
        .from('webhook_events')
        .delete()
        .eq('event_id', eventId)
        .eq('event_type', eventType);
      if (error) throw error;
    },

    listCancellationsDue: (nowIso) =>
      many(
        client
          .from('subscriptions')
          .select(COLUMNS)
          .eq('status', 'active')
          .eq('cancel_at_period_end', true)
          .lte('current_period_end', nowIso)
      ),

    listGraceExpired: (nowIso) =>
      many(client.from('subscriptions').select(COLUMNS).eq('status', 'past_due').lte('grace_until', nowIso)),

    listReconcilable: (sinceIso) =>
      many(
        client
          .from('subscriptions')
          .select(COLUMNS)
          .or(`status.in.(pending,active,past_due),and(status.eq.canceled,updated_at.gte.${sinceIso})`)
      ),

    async getProfileEmail(userId) {
      const { data, error } = await client.from('profiles').select('email').eq('id', userId).maybeSingle();
      if (error) throw error;
      return (data as { email: string } | null)?.email ?? null;
    },
  };
}
