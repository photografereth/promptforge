import type { MemoryDeps } from '../types.js';

// Pedido de exclusão (LGPD), executado pelo suporte. Apaga todos os arquivos sob {userId}/,
// inclusive uploads nunca confirmados. Diferente das outras remoções, uma falha no Storage
// aqui propaga: o suporte precisa saber que a exclusão não terminou.
export async function deleteAllUserMemory(deps: MemoryDeps, userId: string): Promise<void> {
  await deps.storage.removeUnder(`${userId}/`);
  await deps.repo.deleteAllBrands(userId);
}
