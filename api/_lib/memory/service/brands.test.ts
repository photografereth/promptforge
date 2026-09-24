import { describe, it, expect } from 'vitest';
import { createBrand, deleteBrand, ensureBrands, listBrands, updateBrand } from './brands.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from '../testing/fixtures.js';

describe('listBrands', () => {
  it('cria a "Minha marca" padrão no primeiro acesso, uma única vez', async () => {
    const { deps, repo } = makeDeps();
    const first = await listBrands(deps, USER_A);
    await listBrands(deps, USER_A);
    expect(first.status).toBe(200);
    expect(first.body.brands).toMatchObject([{ name: 'Minha marca', isDefault: true }]);
    expect(repo.brands.filter((b) => b.userId === USER_A.id)).toHaveLength(1);
  });

  it('tolera outra requisição ter criado a marca padrão ao mesmo tempo', async () => {
    const { deps, repo } = makeDeps();
    const original = repo.insertBrand;
    repo.insertBrand = async (userId, input) => {
      await original(userId, input);
      throw new Error('duplicate default brand');
    };
    const brands = await ensureBrands(deps, USER_A.id);
    expect(brands).toHaveLength(1);
  });
});

describe('createBrand', () => {
  it('cria marca não-padrão com nome aparado', async () => {
    const { deps } = makeDeps();
    const res = await createBrand(deps, USER_A, { name: '  Loja da Ana ' });
    expect(res.status).toBe(200);
    expect(res.body.brand).toMatchObject({ name: 'Loja da Ana', isDefault: false });
  });

  it('bloqueia a 4ª marca com 409 limit_reached', async () => {
    const { deps } = makeDeps();
    await createBrand(deps, USER_A, { name: 'B' });
    await createBrand(deps, USER_A, { name: 'C' });
    const res = await createBrand(deps, USER_A, { name: 'D' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'limit_reached', limit: 'brands' });
  });

  it('recusa nome inválido', async () => {
    const { deps } = makeDeps();
    expect((await createBrand(deps, USER_A, { name: '' })).status).toBe(400);
  });
});

describe('updateBrand', () => {
  it('renomeia e salva só as chaves conhecidas do kit', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const res = await updateBrand(deps, USER_A, {
      brandId: brand.id,
      name: 'Nova',
      kit: { preferredAgent: 'pov', lixo: 1 },
    });
    expect(res.status).toBe(200);
    expect(res.body.brand).toMatchObject({ name: 'Nova', kit: { preferredAgent: 'pov' } });
  });

  it('400 para kit inválido ou nada para atualizar', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await updateBrand(deps, USER_A, { brandId: brand.id, name: undefined, kit: { autoApply: 'x' } })).status).toBe(400);
    expect((await updateBrand(deps, USER_A, { brandId: brand.id, name: undefined, kit: undefined })).status).toBe(400);
  });

  it('404 para marca de outro usuário ou id inválido', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await updateBrand(deps, USER_B, { brandId: brand.id, name: 'X', kit: undefined })).status).toBe(404);
    expect((await updateBrand(deps, USER_A, { brandId: 'nao-e-uuid', name: 'X', kit: undefined })).status).toBe(404);
  });
});

describe('deleteBrand', () => {
  it('recusa apagar a única marca', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A, 'Única', true);
    const res = await deleteBrand(deps, USER_A, { brandId: brand.id });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'last_brand' });
  });

  it('apaga ativos, prompts e fotos da marca e promove a mais antiga restante a padrão', async () => {
    const { deps, repo, storage } = makeDeps();
    const main = await seedBrand(deps, USER_A, 'Principal', true);
    const second = await seedBrand(deps, USER_A, 'Segunda');
    await seedBrand(deps, USER_A, 'Terceira');
    const path = `${USER_A.id}/${main.id}/x/foto.jpg`;
    simulateUpload(storage, path);
    await seedAsset(deps, USER_A, main.id, { photos: [{ path, mime: 'image/jpeg', size: 1 }] });
    await repo.insertPrompt(USER_A.id, {
      brandId: main.id, mode: 'video', agent: null, title: 't', productName: null,
      deterministicPrompt: 'p', enhancedPrompt: null, state: null, assetIds: [], legacyId: null,
    });

    const res = await deleteBrand(deps, USER_A, { brandId: main.id });

    expect(res.status).toBe(200);
    expect(repo.assets).toHaveLength(0);
    expect(repo.prompts).toHaveLength(0);
    expect(storage.files.has(path)).toBe(false);
    expect(repo.brands.find((b) => b.id === second.id)?.isDefault).toBe(true);
  });

  it('falha ao apagar do Storage não impede apagar a marca', async () => {
    const { deps, repo, storage } = makeDeps();
    await seedBrand(deps, USER_A, 'A', true);
    const other = await seedBrand(deps, USER_A, 'B');
    await seedAsset(deps, USER_A, other.id, { photos: [{ path: 'p.jpg', mime: 'image/jpeg', size: 1 }] });
    storage.failRemove = true;
    expect((await deleteBrand(deps, USER_A, { brandId: other.id })).status).toBe(200);
    expect(repo.brands.some((b) => b.id === other.id)).toBe(false);
  });
});
