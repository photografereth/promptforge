import { fail, type Result, type User } from '../billing/service/context.js';
import type { MemoryDeps } from './types.js';
import { createBrand, deleteBrand, listBrands, updateBrand } from './service/brands.js';
import { deleteAsset, listAssets, updateAsset, useAsset } from './service/assets.js';
import { confirmPhotos, removePhoto, requestPhotoUploads } from './service/photos.js';
import { deletePrompt, listPrompts, savePrompt, setPromptFavorite } from './service/prompts.js';
import { importLocal } from './service/importLocal.js';

type Input = Record<string, unknown>;
type Handler = (deps: MemoryDeps, user: User, input: Input) => Promise<Result>;

// Só campos conhecidos chegam aos serviços; o resto (inclusive user_id) é descartado.
const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  brands: {
    GET: (d, u) => listBrands(d, u),
    POST: (d, u, i) => createBrand(d, u, { name: i.name }),
    PATCH: (d, u, i) => updateBrand(d, u, { brandId: i.brandId, name: i.name, kit: i.kit }),
    DELETE: (d, u, i) => deleteBrand(d, u, { brandId: i.brandId }),
  },
  assets: {
    GET: (d, u, i) => listAssets(d, u, { brandId: i.brandId }),
    PATCH: (d, u, i) =>
      updateAsset(d, u, { assetId: i.assetId, pinned: i.pinned, name: i.name, data: i.data, analysis: i.analysis }),
    DELETE: (d, u, i) => deleteAsset(d, u, { assetId: i.assetId }),
  },
  'use-asset': {
    POST: (d, u, i) =>
      useAsset(d, u, { brandId: i.brandId, kind: i.kind, name: i.name, data: i.data, analysis: i.analysis }),
  },
  'photo-upload': { POST: (d, u, i) => requestPhotoUploads(d, u, { assetId: i.assetId, files: i.files }) },
  'photo-confirm': { POST: (d, u, i) => confirmPhotos(d, u, { assetId: i.assetId, paths: i.paths }) },
  'photo-remove': { POST: (d, u, i) => removePhoto(d, u, { assetId: i.assetId, path: i.path }) },
  prompts: {
    GET: (d, u, i) => listPrompts(d, u, { brandId: i.brandId, q: i.q, favorite: i.favorite, cursor: i.cursor }),
    POST: (d, u, i) =>
      savePrompt(d, u, {
        brandId: i.brandId,
        mode: i.mode,
        agent: i.agent,
        title: i.title,
        productName: i.productName,
        deterministicPrompt: i.deterministicPrompt,
        enhancedPrompt: i.enhancedPrompt,
        state: i.state,
        assetIds: i.assetIds,
      }),
    PATCH: (d, u, i) => setPromptFavorite(d, u, { promptId: i.promptId, favorite: i.favorite }),
    DELETE: (d, u, i) => deletePrompt(d, u, { promptId: i.promptId }),
  },
  'import-local': { POST: (d, u, i) => importLocal(d, u, { items: i.items, preferences: i.preferences }) },
};

export async function routeMemory(
  deps: MemoryDeps,
  user: User,
  action: string,
  method: string,
  input: Input
): Promise<Result> {
  const route = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : undefined;
  if (!route) return fail(404, 'Rota não encontrada.');
  const handler = Object.prototype.hasOwnProperty.call(route, method) ? route[method] : undefined;
  if (!handler) return fail(405, 'Método não permitido.');
  return handler(deps, user, input);
}

// GET e DELETE recebem os parâmetros pela query string.
export function queryInput(query: Record<string, string | string[] | undefined>): Input {
  const input: Input = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === 'action') continue;
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') input[key] = first;
  }
  return input;
}
