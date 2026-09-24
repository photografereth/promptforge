import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { createSupabaseStorage } from './storage.js';
import type { StoragePort } from './types.js';

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

// Chamado pelo cron diário. Remove fotos com mais de 24h que nenhum ativo referencia
// (upload nunca confirmado, ou remoção do Storage que falhou antes).
export async function cleanupOrphanPhotos(
  client: SupabaseClient = supabaseAdmin,
  storage: StoragePort = createSupabaseStorage(client),
  now: Date = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - ORPHAN_AGE_MS).toISOString();
  const { data, error } = await client.rpc('list_orphan_brand_photos', { p_older_than: cutoff });
  if (error) throw error;
  const paths = ((data ?? []) as { path: string }[]).map((r) => r.path);
  if (paths.length > 0) await storage.remove(paths);
  return paths.length;
}
