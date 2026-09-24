import { errorName } from '../../logging/errorName.js';
import { logWarn } from '../../logging/logger.js';
import type { MemoryDeps } from '../types.js';

// Falha ao apagar do Storage nunca desfaz a operação: o arquivo fica órfão e a limpeza diária remove.
export async function removePhotosQuietly(deps: MemoryDeps, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await deps.storage.remove(paths);
  } catch (err) {
    logWarn('memory_photo_remove_failed', { errorName: errorName(err), count: paths.length });
  }
}
