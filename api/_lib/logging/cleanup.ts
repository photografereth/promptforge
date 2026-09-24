import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';

const RETENTION_DAYS = 30;

export async function cleanupOldLogs(client: SupabaseClient = supabaseAdmin): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await client.from('system_logs').delete().lt('created_at', cutoff);
  if (error) throw error;
}
