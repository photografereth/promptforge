import { describe, it, expect } from 'vitest';
import { decodeCursor, deletePrompt, listPrompts, savePrompt, setPromptFavorite } from './prompts.js';
import { makeDeps, seedAsset, seedBrand, USER_A, USER_B } from '../testing/fixtures.js';
import type { PromptEntry } from '../types.js';

const base = { mode: 'video', agent: 'ugc', title: 'Sérum X — UGC', productName: 'Sérum X', deterministicPrompt: 'prompt', enhancedPrompt: undefined, state: { acao: 'aplica' } };
const list = (deps: Parameters<typeof listPrompts>[0], brandId: string, extra: Record<string, unknown> = {}) =>
  listPrompts(deps, USER_A, { brandId, q: undefined, favorite: undefined, cursor: undefined, ...extra });

describe('savePrompt', () => {
  it('salva e aparece no topo da lista', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const res = await savePrompt(deps, USER_A, { brandId: brand.id, ...base });
    expect(res.status).toBe(200);
    const listed = await list(deps, brand.id);
    expect(listed.body.prompts).toMatchObject([{ title: 'Sérum X — UGC', mode: 'video', agent: 'ugc' }]);
  });

  it('400 para modo, agente ou prompt inválidos', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await savePrompt(deps, USER_A, { brandId: brand.id, ...base, mode: 'audio' })).status).toBe(400);
    expect((await savePrompt(deps, USER_A, { brandId: brand.id, ...base, agent: 'x' })).status).toBe(400);
    expect((await savePrompt(deps, USER_A, { brandId: brand.id, ...base, deterministicPrompt: '' })).status).toBe(400);
  });

  it('descarta assetIds de outra marca ou de outro usuário', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const other = await seedBrand(deps, USER_A, 'Outra');
    const mine = await seedAsset(deps, USER_A, brand.id);
    const elsewhere = await seedAsset(deps, USER_A, other.id);
    const foreignBrand = await seedBrand(deps, USER_B);
    const foreign = await seedAsset(deps, USER_B, foreignBrand.id);
    const res = await savePrompt(deps, USER_A, { brandId: brand.id, ...base, assetIds: [mine.id, elsewhere.id, foreign.id, 'x'] });
    expect((res.body.prompt as PromptEntry).assetIds).toEqual([mine.id]);
  });
});

describe('listPrompts', () => {
  it('pagina de 20 em 20 com cursor, sem repetir', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    for (let i = 0; i < 25; i += 1) await savePrompt(deps, USER_A, { brandId: brand.id, ...base, title: `P${i}` });
    const first = await list(deps, brand.id);
    const page1 = first.body.prompts as PromptEntry[];
    expect(page1).toHaveLength(20);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await list(deps, brand.id, { cursor: first.body.nextCursor });
    const page2 = second.body.prompts as PromptEntry[];
    expect(page2).toHaveLength(5);
    expect(second.body.nextCursor).toBeNull();
    expect(new Set([...page1, ...page2].map((p) => p.id)).size).toBe(25);
  });

  it('busca por título ou produto, ignorando caracteres especiais, e filtra favoritos', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    await savePrompt(deps, USER_A, { brandId: brand.id, ...base, title: 'Batom', productName: 'Batom Vermelho' });
    const fav = await savePrompt(deps, USER_A, { brandId: brand.id, ...base, title: 'Creme', productName: 'Creme Noite' });
    await setPromptFavorite(deps, USER_A, { promptId: (fav.body.prompt as PromptEntry).id, favorite: true });
    expect((await list(deps, brand.id, { q: 'vermelho,()' })).body.prompts).toMatchObject([{ title: 'Batom' }]);
    expect((await list(deps, brand.id, { favorite: 'true' })).body.prompts).toMatchObject([{ title: 'Creme' }]);
  });

  it('400 para cursor adulterado ou busca longa demais', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await list(deps, brand.id, { cursor: 'x|y|z' })).status).toBe(400);
    expect((await list(deps, brand.id, { q: 'a'.repeat(101) })).status).toBe(400);
    expect(decodeCursor('2026-01-01T00:00:00.000Z|nao-uuid')).toBeNull();
  });
});

describe('setPromptFavorite / deletePrompt', () => {
  it('404 para prompt de outro usuário; o dono consegue favoritar e apagar', async () => {
    const { deps, repo } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const saved = await savePrompt(deps, USER_A, { brandId: brand.id, ...base });
    const id = (saved.body.prompt as PromptEntry).id;
    expect((await setPromptFavorite(deps, USER_B, { promptId: id, favorite: true })).status).toBe(404);
    expect((await deletePrompt(deps, USER_B, { promptId: id })).status).toBe(404);
    expect((await setPromptFavorite(deps, USER_A, { promptId: id, favorite: 'sim' })).status).toBe(400);
    expect((await setPromptFavorite(deps, USER_A, { promptId: id, favorite: true })).body).toMatchObject({ prompt: { favorite: true } });
    expect((await deletePrompt(deps, USER_A, { promptId: id })).status).toBe(200);
    expect(repo.prompts).toHaveLength(0);
  });
});
