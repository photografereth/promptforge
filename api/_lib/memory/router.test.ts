import { describe, it, expect } from 'vitest';
import { queryInput, routeMemory } from './router.js';
import { photoPath } from './paths.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from './testing/fixtures.js';

describe('routeMemory', () => {
  it('404 para ação desconhecida (inclusive chaves de protótipo) e 405 para método errado', async () => {
    const { deps } = makeDeps();
    expect((await routeMemory(deps, USER_A, 'nada', 'GET', {})).status).toBe(404);
    expect((await routeMemory(deps, USER_A, '__proto__', 'GET', {})).status).toBe(404);
    expect((await routeMemory(deps, USER_A, 'constructor', 'GET', {})).status).toBe(404);
    expect((await routeMemory(deps, USER_A, 'use-asset', 'GET', {})).status).toBe(405);
    expect((await routeMemory(deps, USER_A, 'import-local', 'DELETE', {})).status).toBe(405);
  });

  it('só repassa campos conhecidos: user_id no corpo é ignorado', async () => {
    const { deps, repo } = makeDeps();
    const res = await routeMemory(deps, USER_A, 'brands', 'POST', { name: 'Loja', user_id: USER_B.id, isDefault: true });
    expect(res.status).toBe(200);
    expect(repo.brands.find((b) => b.name === 'Loja')).toMatchObject({ userId: USER_A.id, isDefault: false });
  });
});

describe('photo-upload / photo-confirm', () => {
  it('repassam replace e analysis aos serviços', async () => {
    const { deps, storage } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const asset = await seedAsset(deps, USER_A, brand.id);
    const up = await routeMemory(deps, USER_A, 'photo-upload', 'POST', { assetId: asset.id, files: [{ mime: 'image/jpeg', size: 10 }], replace: 'x' });
    expect(up.status).toBe(400);
    const ok = await routeMemory(deps, USER_A, 'photo-upload', 'POST', { assetId: asset.id, files: [{ mime: 'image/jpeg', size: 10 }], replace: true });
    const [ticket] = ok.body.uploads as { path: string }[];
    simulateUpload(storage, ticket.path);
    const conf = await routeMemory(deps, USER_A, 'photo-confirm', 'POST', { assetId: asset.id, paths: [ticket.path], replace: true, analysis: { resumo: 'r' } });
    expect(conf.body.asset).toMatchObject({ analysis: { resumo: 'r' } });
  });
});

describe('queryInput', () => {
  it('pega o primeiro valor de cada parâmetro e ignora "action"', () => {
    expect(queryInput({ action: 'prompts', brandId: 'x', q: ['a', 'b'], vazio: undefined })).toEqual({ brandId: 'x', q: 'a' });
  });
});

describe('isolamento entre usuários', () => {
  async function scenario() {
    const ctx = makeDeps();
    const brand = await seedBrand(ctx.deps, USER_A, 'Marca A', true);
    await seedBrand(ctx.deps, USER_A, 'Marca A2');
    await seedBrand(ctx.deps, USER_B, 'Marca B', true);
    const asset = await seedAsset(ctx.deps, USER_A, brand.id, { pinned: true, analysis: { x: 1 } });
    const path = photoPath(USER_A.id, brand.id, asset.id, 'e0000000-0000-4000-8000-000000000001', 'image/jpeg');
    simulateUpload(ctx.storage, path);
    await ctx.repo.updateAsset(USER_A.id, asset.id, { photos: [{ path, mime: 'image/jpeg', size: 1 }] });
    const prompt = await ctx.repo.insertPrompt(USER_A.id, {
      brandId: brand.id, mode: 'video', agent: null, title: 'segredo', productName: null,
      deterministicPrompt: 'p', enhancedPrompt: null, state: null, assetIds: [], legacyId: null,
    });
    const snapshot = JSON.stringify({ b: ctx.repo.brands, a: ctx.repo.assets, p: ctx.repo.prompts });
    return { ...ctx, brand, asset, prompt, path, snapshot };
  }

  const attempts: [string, string, (s: Awaited<ReturnType<typeof scenario>>) => Record<string, unknown>][] = [
    ['brands', 'PATCH', (s) => ({ brandId: s.brand.id, name: 'hack' })],
    ['brands', 'DELETE', (s) => ({ brandId: s.brand.id })],
    ['assets', 'GET', (s) => ({ brandId: s.brand.id })],
    ['assets', 'PATCH', (s) => ({ assetId: s.asset.id, pinned: false })],
    ['assets', 'DELETE', (s) => ({ assetId: s.asset.id })],
    ['use-asset', 'POST', (s) => ({ brandId: s.brand.id, kind: 'product', name: 'Sérum X', data: { nome: 'hack' } })],
    ['photo-upload', 'POST', (s) => ({ assetId: s.asset.id, files: [{ mime: 'image/jpeg', size: 1 }] })],
    ['photo-confirm', 'POST', (s) => ({ assetId: s.asset.id, paths: [s.path] })],
    ['photo-remove', 'POST', (s) => ({ assetId: s.asset.id, path: s.path })],
    ['prompts', 'GET', (s) => ({ brandId: s.brand.id })],
    ['prompts', 'POST', (s) => ({ brandId: s.brand.id, mode: 'video', title: 't', deterministicPrompt: 'p' })],
    ['prompts', 'PATCH', (s) => ({ promptId: s.prompt.id, favorite: true })],
    ['prompts', 'DELETE', (s) => ({ promptId: s.prompt.id })],
  ];

  it.each(attempts)('%s %s com ids do usuário A responde 404 para o usuário B e não altera nada', async (action, method, build) => {
    const s = await scenario();
    const res = await routeMemory(s.deps, USER_B, action, method, build(s));
    expect(res.status).toBe(404);
    expect(JSON.stringify({ b: s.repo.brands, a: s.repo.assets, p: s.repo.prompts })).toBe(s.snapshot);
    expect(s.storage.files.has(s.path)).toBe(true);
  });

  it('GET brands de B mostra só as marcas de B', async () => {
    const s = await scenario();
    const res = await routeMemory(s.deps, USER_B, 'brands', 'GET', {});
    expect(res.body.brands).toMatchObject([{ name: 'Marca B' }]);
  });
});
