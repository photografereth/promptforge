import { describe, it, expect } from 'vitest';
import { saveGeneration, type GenerationInput, type SaveGenerationApi } from './saveGeneration';
import type { MemoryAsset } from './types';
import type { ReferenceImageItem } from '../../types';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
// Todas usam o mesmo PNG válido; o plano de fotos distingue por storagePath e posição.
const img = (name: string, extra: Partial<ReferenceImageItem> = {}): ReferenceImageItem => ({
  dataUrl: PNG, name, size: 8, mimeType: 'image/png', ...extra,
});

function fakeApi(savedPhotos: Record<string, string[]> = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  let seq = 0;
  const asset = (kind: string, name: string, photos: string[], analysis: Record<string, unknown> | null = null): MemoryAsset => ({
    id: `${kind}-id`, brandId: 'b1', kind: kind as MemoryAsset['kind'], name, data: {}, analysis,
    photos: photos.map((path) => ({ path, mime: 'image/png', size: 8 })), pinned: false,
    lastUsedAt: '', createdAt: '', updatedAt: '',
  });
  const api: SaveGenerationApi = {
    async useAsset(input) {
      calls.push({ name: 'useAsset', args: [input] });
      return { asset: asset(input.kind, input.name, savedPhotos[input.kind] ?? []), created: !savedPhotos[input.kind] };
    },
    async requestUploads(assetId, files, replace) {
      calls.push({ name: 'requestUploads', args: [assetId, files, replace] });
      return { uploads: files.map(() => ({ path: `new/${++seq}`, signedUrl: `https://up/${seq}`, token: 't' })) };
    },
    async confirmPhotos(assetId, paths, replace, analysis) {
      calls.push({ name: 'confirmPhotos', args: [assetId, paths, replace, analysis] });
      return { asset: asset(assetId.split('-')[0], 'x', paths, analysis ?? null) };
    },
    async savePrompt(input) {
      calls.push({ name: 'savePrompt', args: [input] });
      return { prompt: { id: 'prompt-1' } };
    },
  };
  const uploads: string[] = [];
  const upload = async (url: string) => {
    uploads.push(url);
  };
  return { api, calls, uploads, upload };
}

const base = (extra: Partial<GenerationInput> = {}): GenerationInput => ({
  brandId: 'b1',
  prompt: { mode: 'video', agent: 'ugc', title: 'Sérum (UGC)', productName: 'Sérum', deterministicPrompt: 'p', state: {} },
  product: { nome: 'Sérum', categoria: '', caracteristicasVisuais: '', beneficioVisual: '' },
  productImages: [],
  character: { nomeOuDescricao: '', caracteristicasFisicas: '', cabelo: '', estiloVestuario: '', expressaoMarcante: '' },
  characterImages: [],
  ...extra,
});

describe('saveGeneration', () => {
  it('produto novo com 2 fotos: salva o item, envia as fotos com replace e confirma com a análise', async () => {
    const { api, calls, uploads, upload } = fakeApi();
    const res = await saveGeneration(api, upload, base({
      productImages: [img('a'), img('b')],
      analysis: { product: { resumo: 'ok' } },
    }));
    expect(calls.map((c) => c.name)).toEqual(['useAsset', 'requestUploads', 'confirmPhotos', 'savePrompt']);
    expect(calls[0].args[0]).toMatchObject({ kind: 'product', name: 'Sérum', analysis: { resumo: 'ok' } });
    expect(calls[1].args[2]).toBe(true);
    expect(uploads).toHaveLength(2);
    expect(calls[2].args).toEqual(['product-id', ['new/1', 'new/2'], true, { resumo: 'ok' }]);
    expect(res.product?.images.map((i) => i.storagePath)).toEqual(['new/1', 'new/2']);
    expect(calls[3].args[0]).toMatchObject({ brandId: 'b1', assetIds: ['product-id'] });
    expect(res.promptSaved).toBe(true);
  });

  it('fotos já salvas e iguais: não envia nem confirma nada', async () => {
    const { api, calls, upload } = fakeApi({ product: ['p/a'] });
    await saveGeneration(api, upload, base({ productImages: [img('a', { storagePath: 'p/a' })] }));
    expect(calls.map((c) => c.name)).toEqual(['useAsset', 'savePrompt']);
  });

  it('mantém a foto antiga e envia só a nova, na ordem da galeria', async () => {
    const { api, calls, upload } = fakeApi({ product: ['p/a', 'p/b'] });
    await saveGeneration(api, upload, base({ productImages: [img('a', { storagePath: 'p/a' }), img('n')] }));
    const req = calls.find((c) => c.name === 'requestUploads')!;
    expect((req.args[1] as unknown[]).length).toBe(1);
    expect(calls.find((c) => c.name === 'confirmPhotos')!.args[1]).toEqual(['p/a', 'new/1']);
  });

  it('pula amostras SVG, guarda só 4 fotos e avisa', async () => {
    const { api, upload, uploads } = fakeApi();
    const images = [img('svg', { mimeType: 'image/svg+xml' }), img('1'), img('2'), img('3'), img('4'), img('5')];
    const res = await saveGeneration(api, upload, base({ productImages: images }));
    expect(uploads).toHaveLength(4);
    expect(res.product).toMatchObject({ truncated: true, skippedUnsupported: 1 });
  });

  it('criadora sem nome não é salva; nomes longos são cortados em 80', async () => {
    const { api, calls, upload } = fakeApi();
    await saveGeneration(api, upload, base({ product: { nome: 'x'.repeat(100), categoria: '', caracteristicasVisuais: '', beneficioVisual: '' } }));
    const uses = calls.filter((c) => c.name === 'useAsset');
    expect(uses).toHaveLength(1);
    expect((uses[0].args[0] as { name: string }).name).toHaveLength(80);
  });

  it('falha no produto não impede salvar o prompt', async () => {
    const { api, calls, upload } = fakeApi();
    api.useAsset = async () => {
      throw new Error('rede');
    };
    const res = await saveGeneration(api, upload, base());
    expect(res.errors).toEqual(['produto']);
    expect(res.promptSaved).toBe(true);
    expect(calls.find((c) => c.name === 'savePrompt')!.args[0]).toMatchObject({ assetIds: [] });
  });
});
