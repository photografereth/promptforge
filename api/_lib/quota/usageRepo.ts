import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import type { UsageRepo } from './types.js';

export function createSupabaseUsageRepo(client: SupabaseClient = supabaseAdmin): UsageRepo {
  return {
    async incrementAndGetUsage(userId, dateStr) {
      const { data, error } = await client.rpc('increment_ai_usage', {
        p_user_id: userId,
        p_date: dateStr,
      });
      if (error) throw error;
      return data as number;
    },
  };
}
