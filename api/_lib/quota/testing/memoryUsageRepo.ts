import type { UsageRepo } from '../types.js';

export interface MemoryUsageRepo extends UsageRepo {
  counts: Map<string, number>;
}

// `seed` usa a chave `"${userId}|${dateStr}"`.
export function createMemoryUsageRepo(seed: Record<string, number> = {}): MemoryUsageRepo {
  const counts = new Map<string, number>(Object.entries(seed));

  return {
    counts,
    async incrementAndGetUsage(userId, dateStr) {
      const key = `${userId}|${dateStr}`;
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
  };
}
