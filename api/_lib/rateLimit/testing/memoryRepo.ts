import type { IpRateLimitRepo } from '../types.js';

export interface MemoryRepo extends IpRateLimitRepo {
  counts: Map<string, number>;
}

// `seed` usa a chave `"${ip}|${windowStartIso}"`.
export function createMemoryRepo(seed: Record<string, number> = {}): MemoryRepo {
  const counts = new Map<string, number>(Object.entries(seed));

  return {
    counts,
    async incrementAndGetCount(ip, windowStartIso) {
      const key = `${ip}|${windowStartIso}`;
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
  };
}
