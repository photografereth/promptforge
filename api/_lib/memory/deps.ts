import { randomUUID } from 'node:crypto';
import { MEMORY_LIMITS } from './limits.js';
import { createSupabaseMemoryRepo } from './repo.js';
import { createSupabaseStorage } from './storage.js';
import type { MemoryDeps } from './types.js';

export function buildMemoryDeps(): MemoryDeps {
  return {
    repo: createSupabaseMemoryRepo(),
    storage: createSupabaseStorage(),
    limits: MEMORY_LIMITS.default,
    now: () => new Date(),
    newId: () => randomUUID(),
  };
}
