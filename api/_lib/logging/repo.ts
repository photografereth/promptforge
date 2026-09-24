import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import type { LogRepo } from './types.js';

export function createSupabaseRepo(client: SupabaseClient = supabaseAdmin): LogRepo {
  return {
    async insertLog(level, event, details) {
      const { error } = await client.from('system_logs').insert({ level, event, details });
      if (error) throw error;
    },
  };
}
