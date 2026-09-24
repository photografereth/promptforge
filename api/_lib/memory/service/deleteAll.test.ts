import { describe, it, expect } from 'vitest';
import { deleteAllUserMemory } from './deleteAll.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from '../testing/fixtures.js';

describe('deleteAllUserMemory', () => {
  it('apaga marcas, ativos, prompts e fotos do usuário, e nada de outro usuário', async () => {
    const { deps, repo, storage } = makeDeps();
    const a = await seedBrand(deps, USER_A, 'A', true);
    const b = await seedBrand(deps, USER_B, 'B', true);
    const aPath = `${USER_A.id}/${a.id}/x/a.jpg`;
    const bPath = `${USER_B.id}/${b.id}/x/b.jpg`;
    simulateUpload(storage, aPath);
    simulateUpload(storage, bPath);
    await seedAsset(deps, USER_A, a.id, { photos: [{ path: aPath, mime: 'image/jpeg', size: 1 }] });
    await seedAsset(deps, USER_B, b.id, { photos: [{ path: bPath, mime: 'image/jpeg', size: 1 }] });

    await deleteAllUserMemory(deps, USER_A.id);

    expect(repo.brands.map((x) => x.userId)).toEqual([USER_B.id]);
    expect(repo.assets.map((x) => x.userId)).toEqual([USER_B.id]);
    expect(storage.files.has(aPath)).toBe(false);
    expect(storage.files.has(bPath)).toBe(true);
  });

  it('também apaga uploads nunca confirmados sob a pasta do usuário', async () => {
    const { deps, storage } = makeDeps();
    const a = await seedBrand(deps, USER_A, 'A', true);
    const pending = `${USER_A.id}/${a.id}/00000000-0000-4000-8000-0000000000aa/e0000000-0000-4000-8000-000000000001.jpg`;
    const other = `${USER_B.id}/x/y/e0000000-0000-4000-8000-000000000002.jpg`;
    simulateUpload(storage, pending);
    simulateUpload(storage, other);

    await deleteAllUserMemory(deps, USER_A.id);

    expect(storage.files.has(pending)).toBe(false);
    expect(storage.files.has(other)).toBe(true);
  });
});
