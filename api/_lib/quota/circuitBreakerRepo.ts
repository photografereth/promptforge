import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import type { CircuitBreakerRepo } from './types.js';

export function createSupabaseCircuitBreakerRepo(client: SupabaseClient = supabaseAdmin): CircuitBreakerRepo {
  return {
    async getLastHighDemandAt() {
      const { data, error } = await client
        .from('gemini_circuit_breaker')
        .select('last_high_demand_at')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return (data?.last_high_demand_at as string | null) ?? null;
    },
    async setHighDemandNow(nowIso) {
      const { error } = await client.from('gemini_circuit_breaker').update({ last_high_demand_at: nowIso }).eq('id', true);
      if (error) throw error;
    },
  };
}
