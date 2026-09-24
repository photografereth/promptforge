import { describe, it, expect } from 'vitest';
import { deleteAllUserMemory } from './deleteAll.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from '../testing/fixtures.js';

describe('deleteAllUserMemory', () => {
  it('apaga marcas, ativos, prompts e fotos do usuário, e nada de outro usuário', async () => {
    const { deps, repo, storage } = makeDeps();
    const a = await seedBrand(deps, USER_A, 'A', true);
    const b = await seedBrand(deps, USER_B, 'B', true);
    simulateUpload(storage, 'a.jpg');
    simulateUpload(storage, 'b.jpg');
    await seedAsset(deps, USER_A, a.id, { photos: [{ path: 'a.jpg', mime: 'image/jpeg', size: 1 }] });
    await seedAsset(deps, USER_B, b.id, { photos: [{ path: 'b.jpg', mime: 'image/jpeg', size: 1 }] });

    await deleteAllUserMemory(deps, USER_A.id);

    expect(repo.brands.map((x) => x.userId)).toEqual([USER_B.id]);
    expect(repo.assets.map((x) => x.userId)).toEqual([USER_B.id]);
    expect(storage.files.has('a.jpg')).toBe(false);
    expect(storage.files.has('b.jpg')).toBe(true);
  });
});
