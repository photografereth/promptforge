import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';

// Chamado pelo cron diário de billing. Falha aqui nunca deve derrubar o cron inteiro —
// é limpeza, não a responsabilidade principal do job.
export async function cleanupOldWindows(client: SupabaseClient = supabaseAdmin): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error } = await client.from('ip_rate_limit').delete().lt('window_start', cutoff);
  if (error) throw error;
}
