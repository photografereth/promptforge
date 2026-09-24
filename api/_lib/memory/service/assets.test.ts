import { describe, it, expect } from 'vitest';
import { deleteAsset, listAssets, updateAsset, useAsset } from './assets.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from '../testing/fixtures.js';

const product = (name: string, extra: Record<string, unknown> = {}) => ({
  kind: 'product',
  name,
  data: { nome: name },
  analysis: undefined,
  ...extra,
});

describe('listAssets', () => {
  it('devolve os ativos da marca com link assinado em cada foto', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    await seedAsset(deps, USER_A, brand.id, { photos: [{ path: 'a.jpg', mime: 'image/jpeg', size: 1 }] });
    const res = await listAssets(deps, USER_A, { brandId: brand.id });
    expect(res.status).toBe(200);
    const [asset] = res.body.assets as { photos: { url: string }[] }[];
    expect(asset.photos[0].url).toBe('https://storage.test/read/a.jpg');
  });

  it('404 para marca de outro usuário', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await listAssets(deps, USER_B, { brandId: brand.id })).status).toBe(404);
  });
});

describe('useAsset', () => {
  it('cria um recente na primeira vez', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const res = await useAsset(deps, USER_A, { brandId: brand.id, ...product('Sérum X') });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: true, asset: { name: 'Sérum X', pinned: false } });
  });

  it('atualiza (sem duplicar) quando o nome já existe, ignorando maiúsculas, e mantém a análise se não vier', async () => {
    const { deps, repo } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    await useAsset(deps, USER_A, { brandId: brand.id, ...product('Sérum X', { analysis: { resumo: 'ok' } }) });
    const res = await useAsset(deps, USER_A, { brandId: brand.id, ...product('sérum x', { data: { nome: 'v2' } }) });
    expect(res.body).toMatchObject({ created: false, asset: { data: { nome: 'v2' }, analysis: { resumo: 'ok' } } });
    expect(repo.assets).toHaveLength(1);
  });

  it('o 21º recente apaga o mais antigo e as fotos dele; fixados não são podados', async () => {
    const { deps, repo, storage } = makeDeps({ recentAssetsPerBrand: 2 });
    const brand = await seedBrand(deps, USER_A);
    await seedAsset(deps, USER_A, brand.id, { name: 'Fixado', pinned: true });
    simulateUpload(storage, 'velho.jpg');
    await seedAsset(deps, USER_A, brand.id, { name: 'Velho', photos: [{ path: 'velho.jpg', mime: 'image/jpeg', size: 1 }] });
    await seedAsset(deps, USER_A, brand.id, { name: 'Meio' });

    await useAsset(deps, USER_A, { brandId: brand.id, ...product('Novo') });

    expect(repo.assets.map((a) => a.name).sort()).toEqual(['Fixado', 'Meio', 'Novo']);
    expect(storage.files.has('velho.jpg')).toBe(false);
  });

  it('se outra requisição criou o mesmo nome no meio, atualiza em vez de falhar', async () => {
    const { deps, repo } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    await seedAsset(deps, USER_A, brand.id, { name: 'Sérum X' });
    const original = repo.findAssetByName;
    let calls = 0;
    repo.findAssetByName = async (...args) => (++calls === 1 ? null : original(...args));
    const res = await useAsset(deps, USER_A, { brandId: brand.id, ...product('Sérum X', { data: { nome: 'v2' } }) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: false, asset: { data: { nome: 'v2' } } });
    expect(repo.assets).toHaveLength(1);
  });

  it('400 para tipo, nome ou dados inválidos', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await useAsset(deps, USER_A, { brandId: brand.id, ...product('X', { kind: 'cenario' }) })).status).toBe(400);
    expect((await useAsset(deps, USER_A, { brandId: brand.id, ...product('') })).status).toBe(400);
    expect(
      (await useAsset(deps, USER_A, { brandId: brand.id, ...product('X', { data: { t: 'a'.repeat(21_000) } }) })).status
    ).toBe(400);
  });
});

describe('updateAsset', () => {
  it('fixar respeita o limite de fixados por marca', async () => {
    const { deps } = makeDeps({ pinnedAssetsPerBrand: 1 });
    const brand = await seedBrand(deps, USER_A);
    await seedAsset(deps, USER_A, brand.id, { name: 'Um', pinned: true });
    const dois = await seedAsset(deps, USER_A, brand.id, { name: 'Dois' });
    const res = await updateAsset(deps, USER_A, { assetId: dois.id, pinned: true, name: undefined, data: undefined, analysis: undefined });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'limit_reached', limit: 'pinnedAssets' });
  });

  it('desafixar com recentes cheios mantém o item desafixado e poda o recente mais antigo', async () => {
    const { deps, repo } = makeDeps({ recentAssetsPerBrand: 2 });
    const brand = await seedBrand(deps, USER_A);
    const fixado = await seedAsset(deps, USER_A, brand.id, { name: 'Fixado', pinned: true });
    await seedAsset(deps, USER_A, brand.id, { name: 'R1' });
    await seedAsset(deps, USER_A, brand.id, { name: 'R2' });
    const res = await updateAsset(deps, USER_A, { assetId: fixado.id, pinned: false, name: undefined, data: undefined, analysis: undefined });
    expect(res.status).toBe(200);
    expect(repo.assets.map((a) => a.name).sort()).toEqual(['Fixado', 'R2']);
  });

  it('409 ao renomear para um nome que já existe; analysis null zera a análise', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    await seedAsset(deps, USER_A, brand.id, { name: 'A' });
    const b = await seedAsset(deps, USER_A, brand.id, { name: 'B', analysis: { x: 1 } });
    expect((await updateAsset(deps, USER_A, { assetId: b.id, pinned: undefined, name: 'a', data: undefined, analysis: undefined })).body).toMatchObject({ code: 'name_taken' });
    const cleared = await updateAsset(deps, USER_A, { assetId: b.id, pinned: undefined, name: undefined, data: undefined, analysis: null });
    expect(cleared.body).toMatchObject({ asset: { analysis: null } });
  });
});

describe('deleteAsset', () => {
  it('apaga o ativo e as fotos; 404 para ativo de outro usuário', async () => {
    const { deps, repo, storage } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    simulateUpload(storage, 'f.jpg');
    const asset = await seedAsset(deps, USER_A, brand.id, { photos: [{ path: 'f.jpg', mime: 'image/jpeg', size: 1 }] });
    expect((await deleteAsset(deps, USER_B, { assetId: asset.id })).status).toBe(404);
    expect((await deleteAsset(deps, USER_A, { assetId: asset.id })).status).toBe(200);
    expect(repo.assets).toHaveLength(0);
    expect(storage.files.has('f.jpg')).toBe(false);
  });
});
