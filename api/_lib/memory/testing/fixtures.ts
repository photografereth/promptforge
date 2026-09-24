import type { User } from '../../billing/service/context.js';
import { MEMORY_LIMITS } from '../limits.js';
import type { Asset, Brand, MemoryDeps, MemoryLimits, NewAsset } from '../types.js';
import { createMemoryRepo } from './memoryRepo.js';
import { createMemoryStorage, type InMemoryStorage } from './memoryStorage.js';

export const USER_A: User = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.com' };
export const USER_B: User = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@example.com' };

// `now` avança 1s a cada chamada, para a ordem de "usado por último" ser determinística.
export function makeDeps(limits: Partial<MemoryLimits> = {}) {
  const repo = createMemoryRepo();
  const storage = createMemoryStorage();
  let tick = 0;
  let fileSeq = 0;
  const deps: MemoryDeps = {
    repo,
    storage,
    limits: { ...MEMORY_LIMITS.default, ...limits },
    now: () => new Date(Date.UTC(2026, 5, 1) + ++tick * 1000),
    newId: () => `f0000000-0000-4000-8000-${String(++fileSeq).padStart(12, '0')}`,
  };
  return { deps, repo, storage };
}

export function seedBrand(deps: MemoryDeps, user: User, name = 'Marca Teste', isDefault = false): Promise<Brand> {
  return deps.repo.insertBrand(user.id, { name, kit: {}, isDefault });
}

export function seedAsset(
  deps: MemoryDeps,
  user: User,
  brandId: string,
  overrides: Partial<NewAsset> = {}
): Promise<Asset> {
  return deps.repo.insertAsset(user.id, {
    brandId,
    kind: 'product',
    name: 'Sérum X',
    data: { nome: 'Sérum X' },
    analysis: null,
    photos: [],
    pinned: false,
    lastUsedAt: deps.now().toISOString(),
    ...overrides,
  });
}

// Simula o navegador enviando a foto pelo link assinado.
export function simulateUpload(storage: InMemoryStorage, path: string, size = 300_000, mime = 'image/jpeg'): void {
  storage.files.set(path, { size, mime });
}
