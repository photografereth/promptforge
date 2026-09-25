import { apiFetch } from './apiFetch';
import { memoryUrl, type Query } from './memory/url';
import type {
  AssetKind,
  Brand,
  BrandKit,
  LibraryPrompt,
  LimitKind,
  MemoryAsset,
  SavePromptInput,
  UploadTicket,
} from './memory/types';

export class MemoryApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly limit?: LimitKind
  ) {
    super(message);
    this.name = 'MemoryApiError';
  }
}

async function request<T>(method: string, action: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const res = await apiFetch(memoryUrl(action, opts.query), {
    method,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new MemoryApiError(res.status, json.error ?? 'Algo deu errado. Tente novamente.', json.code, json.limit);
  }
  return json as T;
}

export const memoryApi = {
  listBrands: () => request<{ brands: Brand[] }>('GET', 'brands'),
  createBrand: (name: string) => request<{ brand: Brand }>('POST', 'brands', { body: { name } }),
  updateBrand: (brandId: string, patch: { name?: string; kit?: BrandKit }) =>
    request<{ brand: Brand }>('PATCH', 'brands', { body: { brandId, ...patch } }),
  deleteBrand: (brandId: string) => request<{ ok: true }>('DELETE', 'brands', { query: { brandId } }),

  listAssets: (brandId: string) => request<{ assets: MemoryAsset[] }>('GET', 'assets', { query: { brandId } }),
  updateAsset: (assetId: string, patch: { pinned?: boolean; name?: string }) =>
    request<{ asset: MemoryAsset }>('PATCH', 'assets', { body: { assetId, ...patch } }),
  deleteAsset: (assetId: string) => request<{ ok: true }>('DELETE', 'assets', { query: { assetId } }),
  useAsset: (input: {
    brandId: string;
    kind: AssetKind;
    name: string;
    data: Record<string, unknown>;
    analysis?: Record<string, unknown>;
  }) => request<{ asset: MemoryAsset; created: boolean }>('POST', 'use-asset', { body: input }),
  requestUploads: (assetId: string, files: { mime: string; size: number }[], replace: boolean) =>
    request<{ uploads: UploadTicket[] }>('POST', 'photo-upload', { body: { assetId, files, replace } }),
  confirmPhotos: (assetId: string, paths: string[], replace: boolean, analysis?: Record<string, unknown>) =>
    request<{ asset: MemoryAsset }>('POST', 'photo-confirm', {
      body: { assetId, paths, replace, ...(analysis ? { analysis } : {}) },
    }),

  listPrompts: (brandId: string, opts: { q?: string; favorite?: boolean; cursor?: string | null } = {}) =>
    request<{ prompts: LibraryPrompt[]; nextCursor: string | null }>('GET', 'prompts', {
      query: { brandId, q: opts.q, favorite: opts.favorite ? 'true' : undefined, cursor: opts.cursor ?? undefined },
    }),
  savePrompt: (input: SavePromptInput) => request<{ prompt: LibraryPrompt }>('POST', 'prompts', { body: input }),
  setFavorite: (promptId: string, favorite: boolean) =>
    request<{ prompt: LibraryPrompt }>('PATCH', 'prompts', { body: { promptId, favorite } }),
  deletePrompt: (promptId: string) => request<{ ok: true }>('DELETE', 'prompts', { query: { promptId } }),

  importLocal: (items: unknown[], preferences?: BrandKit) =>
    request<{ brandId: string; imported: number; skipped: number; kitImported: boolean }>('POST', 'import-local', {
      body: { items, ...(preferences ? { preferences } : {}) },
    }),
};

export type MemoryApi = typeof memoryApi;

export async function uploadToSignedUrl(signedUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
  if (!res.ok) throw new Error(`upload ${res.status}`);
}

// Fotos salvas voltam para a galeria como dataUrl, igual às enviadas pelo usuário,
// para a análise multimodal continuar funcionando com elas.
export async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`foto ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a foto.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
