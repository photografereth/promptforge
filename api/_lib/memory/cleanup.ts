import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { createSupabaseStorage } from './storage.js';
import type { StoragePort } from './types.js';

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
const BATCH = 1000; // mesmo limit da função SQL
const MAX_ROUNDS = 10;

// Chamado pelo cron diário. Remove fotos com mais de 24h que nenhum ativo referencia
// (upload nunca confirmado, ou remoção do Storage que falhou antes).
export async function cleanupOrphanPhotos(
  client: SupabaseClient = supabaseAdmin,
  storage: StoragePort = createSupabaseStorage(client),
  now: Date = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - ORPHAN_AGE_MS).toISOString();
  let removed = 0;
  // Repete enquanto vier um lote cheio, com teto de rodadas para não estourar o tempo do cron.
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const { data, error } = await client.rpc('list_orphan_brand_photos', { p_older_than: cutoff });
    if (error) throw error;
    const paths = ((data ?? []) as { path: string }[]).map((r) => r.path);
    if (paths.length > 0) await storage.remove(paths);
    removed += paths.length;
    if (paths.length < BATCH) break;
  }
  return removed;
}
