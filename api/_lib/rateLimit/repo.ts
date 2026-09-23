import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import type { IpRateLimitRepo } from './types.js';

export function createSupabaseRepo(client: SupabaseClient = supabaseAdmin): IpRateLimitRepo {
  return {
    async incrementAndGetCount(ip, windowStartIso) {
      const { data, error } = await client.rpc('increment_ip_rate_limit', {
        p_ip: ip,
        p_window_start: windowStartIso,
      });
      if (error) throw error;
      return data as number;
    },
  };
}
