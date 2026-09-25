import type { CharacterAnchor, ProductAnchor, ReferenceImageItem } from '../../types';
import { assetName } from './assetForm';
import { dataUrlToBlob } from './dataUrl';
import { planPhotoSync, withStoragePaths } from './photoPlan';
import type { AssetKind, MemoryAsset, SavePromptInput, UploadTicket } from './types';

export interface SaveGenerationApi {
  useAsset(input: {
    brandId: string;
    kind: AssetKind;
    name: string;
    data: Record<string, unknown>;
    analysis?: Record<string, unknown>;
  }): Promise<{ asset: MemoryAsset; created: boolean }>;
  requestUploads(assetId: string, files: { mime: string; size: number }[], replace: boolean): Promise<{ uploads: UploadTicket[] }>;
  confirmPhotos(assetId: string, paths: string[], replace: boolean, analysis?: Record<string, unknown>): Promise<{ asset: MemoryAsset }>;
  savePrompt(input: SavePromptInput): Promise<unknown>;
}

export type UploadFile = (signedUrl: string, blob: Blob) => Promise<void>;

export interface GenerationInput {
  brandId: string;
  prompt: Omit<SavePromptInput, 'brandId' | 'assetIds'>;
  product: ProductAnchor;
  productImages: ReferenceImageItem[];
  character?: CharacterAnchor;
  characterImages: ReferenceImageItem[];
  // Análise da IA feita nesta sessão (não a que veio de um item salvo).
  analysis?: { product?: Record<string, unknown>; character?: Record<string, unknown> };
}

export interface AssetSaveResult {
  asset: MemoryAsset;
  created: boolean;
  images: ReferenceImageItem[];
  truncated: boolean;
  skippedUnsupported: number;
}

export interface GenerationResult {
  promptSaved: boolean;
  product?: AssetSaveResult;
  character?: AssetSaveResult;
  errors: string[];
}

async function saveAsset(
  api: SaveGenerationApi,
  upload: UploadFile,
  brandId: string,
  kind: AssetKind,
  name: string,
  data: Record<string, unknown>,
  images: ReferenceImageItem[],
  analysis: Record<string, unknown> | undefined
): Promise<AssetSaveResult> {
  const { asset, created } = await api.useAsset({ brandId, kind, name, data, ...(analysis ? { analysis } : {}) });
  const plan = planPhotoSync(images, asset.photos.map((p) => p.path));
  const summary = { truncated: plan.truncated, skippedUnsupported: plan.skippedUnsupported };
  if (plan.unchanged) return { asset, created, images, ...summary };

  const fresh = plan.slots.flatMap((s) => (s.kind === 'new' ? [s] : []));
  const blobs = fresh.map((s) => dataUrlToBlob(s.image.dataUrl));
  let newPaths: string[] = [];
  if (fresh.length > 0) {
    const { uploads } = await api.requestUploads(asset.id, blobs.map((b) => ({ mime: b.type, size: b.size })), true);
    await Promise.all(uploads.map((ticket, i) => upload(ticket.signedUrl, blobs[i])));
    newPaths = uploads.map((t) => t.path);
  }
  let next = 0;
  const paths = plan.slots.map((s) => (s.kind === 'keep' ? s.path : newPaths[next++]));
  const confirmed = await api.confirmPhotos(asset.id, paths, true, analysis);
  next = 0;
  const updates = plan.slots.flatMap((s) => (s.kind === 'new' ? [{ index: s.index, path: newPaths[next++] }] : []));
  return { asset: confirmed.asset, created, images: withStoragePaths(images, updates), ...summary };
}

// Salva produto, criadora e prompt, nessa ordem; uma falha em um não impede os outros.
export async function saveGeneration(
  api: SaveGenerationApi,
  upload: UploadFile,
  input: GenerationInput
): Promise<GenerationResult> {
  const errors: string[] = [];
  const attempt = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch {
      errors.push(label);
      return undefined;
    }
  };

  const result: GenerationResult = { promptSaved: false, errors };
  const productName = assetName(input.product.nome);
  if (productName) {
    result.product = await attempt('produto', () =>
      saveAsset(api, upload, input.brandId, 'product', productName, { ...input.product }, input.productImages, input.analysis?.product)
    );
  }
  const characterName = input.character ? assetName(input.character.nomeOuDescricao) : '';
  if (input.character && characterName) {
    const character = input.character;
    result.character = await attempt('criadora', () =>
      saveAsset(api, upload, input.brandId, 'character', characterName, { ...character }, input.characterImages, input.analysis?.character)
    );
  }
  const assetIds = [result.product?.asset.id, result.character?.asset.id].filter((id): id is string => Boolean(id));
  const saved = await attempt('prompt', () => api.savePrompt({ ...input.prompt, brandId: input.brandId, assetIds }));
  result.promptSaved = saved !== undefined;
  return result;
}
