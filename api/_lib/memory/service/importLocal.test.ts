import { describe, it, expect } from 'vitest';
import { importLocal } from './importLocal.js';
import { makeDeps, USER_A } from '../testing/fixtures.js';

const item = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  timestamp: Date.UTC(2026, 3, 1),
  mode: 'image',
  agent: 'pov',
  productName: 'Sérum X',
  title: `Prompt ${id}`,
  deterministicPrompt: 'texto',
  imageState: { cenario: 'banheiro' },
  ...extra,
});

describe('importLocal', () => {
  it('importa na "Minha marca", preservando a data original, e pula itens inválidos', async () => {
    const { deps, repo } = makeDeps();
    const res = await importLocal(deps, USER_A, {
      items: [item('1'), item('2'), item('ruim', { mode: 'audio' }), 'lixo'],
      preferences: undefined,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ imported: 2, skipped: 2, kitImported: false });
    const brand = repo.brands[0];
    expect(brand).toMatchObject({ name: 'Minha marca', isDefault: true });
    expect(repo.prompts[0]).toMatchObject({ brandId: brand.id, legacyId: '1', createdAt: '2026-04-01T00:00:00.000Z', state: { cenario: 'banheiro' } });
  });

  it('segunda importação não duplica', async () => {
    const { deps, repo } = makeDeps();
    await importLocal(deps, USER_A, { items: [item('1')], preferences: undefined });
    const again = await importLocal(deps, USER_A, { items: [item('1'), item('1')], preferences: undefined });
    expect(again.body).toMatchObject({ imported: 0, skipped: 2 });
    expect(repo.prompts).toHaveLength(1);
  });

  it('usa as preferências como kit só se o kit ainda estiver vazio', async () => {
    const { deps, repo } = makeDeps();
    const first = await importLocal(deps, USER_A, { items: [], preferences: { autoApply: true, preferredAgent: 'ugc' } });
    expect(first.body).toMatchObject({ kitImported: true });
    const second = await importLocal(deps, USER_A, { items: [], preferences: { preferredAgent: 'pov' } });
    expect(second.body).toMatchObject({ kitImported: false });
    expect(repo.brands[0].kit).toEqual({ autoApply: true, preferredAgent: 'ugc' });
  });

  it('400 para lista que não é array ou grande demais', async () => {
    const { deps } = makeDeps();
    expect((await importLocal(deps, USER_A, { items: 'x', preferences: undefined })).status).toBe(400);
    expect((await importLocal(deps, USER_A, { items: Array.from({ length: 51 }, (_, i) => item(String(i))), preferences: undefined })).status).toBe(400);
  });
});
