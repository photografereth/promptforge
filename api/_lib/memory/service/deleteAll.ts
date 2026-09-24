import type { MemoryDeps } from '../types.js';

// Pedido de exclusão (LGPD), executado pelo suporte. Diferente das outras remoções, uma falha
// no Storage aqui propaga: o suporte precisa saber que a exclusão não terminou.
// Uploads nunca confirmados sob {userId}/ são removidos pela limpeza diária de órfãs.
export async function deleteAllUserMemory(deps: MemoryDeps, userId: string): Promise<void> {
  const assets = await deps.repo.listAllAssets(userId);
  const paths = assets.flatMap((a) => a.photos.map((p) => p.path));
  if (paths.length > 0) await deps.storage.remove(paths);
  await deps.repo.deleteAllBrands(userId);
}
