import { fail, ok, type Result, type User } from '../../billing/service/context.js';
import { MAX_DATA_BYTES, READ_URL_TTL_SECONDS } from '../limits.js';
import { cleanName, cleanObject, isUuid } from '../validate.js';
import type { Asset, AssetKind, AssetPatch, MemoryDeps } from '../types.js';
import { BRAND_NOT_FOUND, findBrand } from './brands.js';
import { removePhotosQuietly } from './shared.js';

export const ASSET_NOT_FOUND = 'Item não encontrado.';
const KINDS: ReadonlySet<string> = new Set(['product', 'character']);

export async function findAsset(deps: MemoryDeps, userId: string, assetId: unknown): Promise<Asset | null> {
  return isUuid(assetId) ? deps.repo.getAsset(userId, assetId) : null;
}

async function withReadUrls(deps: MemoryDeps, assets: Asset[]) {
  const paths = assets.flatMap((a) => a.photos.map((p) => p.path));
  const urls = paths.length > 0 ? await deps.storage.createReadUrls(paths, READ_URL_TTL_SECONDS) : {};
  return assets.map((a) => ({ ...a, photos: a.photos.map((p) => ({ ...p, url: urls[p.path] ?? null })) }));
}

async function pruneRecents(deps: MemoryDeps, userId: string, brandId: string): Promise<void> {
  const recents = (await deps.repo.listAssets(userId, brandId))
    .filter((a) => !a.pinned)
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  for (const stale of recents.slice(deps.limits.recentAssetsPerBrand)) {
    await removePhotosQuietly(deps, stale.photos.map((p) => p.path));
    await deps.repo.deleteAsset(userId, stale.id);
  }
}

export async function listAssets(deps: MemoryDeps, user: User, input: { brandId: unknown }): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  const assets = await deps.repo.listAssets(user.id, brand.id);
  return ok({ assets: await withReadUrls(deps, assets) });
}

export async function useAsset(
  deps: MemoryDeps,
  user: User,
  input: { brandId: unknown; kind: unknown; name: unknown; data: unknown; analysis: unknown }
): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  if (typeof input.kind !== 'string' || !KINDS.has(input.kind)) return fail(400, 'Tipo de item inválido.');
  const kind = input.kind as AssetKind;
  const name = cleanName(input.name);
  if (!name) return fail(400, 'Nome do item inválido.');
  const data = cleanObject(input.data, MAX_DATA_BYTES);
  if (!data) return fail(400, 'Dados do item inválidos.');
  // Ausente ou null = manter a análise que já existe.
  let analysis: Record<string, unknown> | undefined;
  if (input.analysis !== undefined && input.analysis !== null) {
    const parsed = cleanObject(input.analysis, MAX_DATA_BYTES);
    if (!parsed) return fail(400, 'Análise inválida.');
    analysis = parsed;
  }

  const lastUsedAt = deps.now().toISOString();
  const patch: AssetPatch = { data, lastUsedAt, ...(analysis ? { analysis } : {}) };
  const existing = await deps.repo.findAssetByName(user.id, brand.id, kind, name);
  if (existing) {
    return ok({ asset: await deps.repo.updateAsset(user.id, existing.id, patch), created: false });
  }

  let asset: Asset;
  try {
    asset = await deps.repo.insertAsset(user.id, {
      brandId: brand.id,
      kind,
      name,
      data,
      analysis: analysis ?? null,
      photos: [],
      pinned: false,
      lastUsedAt,
    });
  } catch (err) {
    // Requisição simultânea com o mesmo nome venceu a corrida (índice único): atualiza o dela.
    const winner = await deps.repo.findAssetByName(user.id, brand.id, kind, name);
    if (!winner) throw err;
    return ok({ asset: await deps.repo.updateAsset(user.id, winner.id, patch), created: false });
  }
  await pruneRecents(deps, user.id, brand.id);
  return ok({ asset, created: true });
}

export async function updateAsset(
  deps: MemoryDeps,
  user: User,
  input: { assetId: unknown; pinned: unknown; name: unknown; data: unknown; analysis: unknown }
): Promise<Result> {
  const asset = await findAsset(deps, user.id, input.assetId);
  if (!asset) return fail(404, ASSET_NOT_FOUND);
  const patch: AssetPatch = {};
  let unpinned = false;

  if (input.pinned !== undefined) {
    if (typeof input.pinned !== 'boolean') return fail(400, 'Valor inválido para fixar.');
    if (input.pinned && !asset.pinned) {
      const pinnedCount = (await deps.repo.listAssets(user.id, asset.brandId)).filter((a) => a.pinned).length;
      if (pinnedCount >= deps.limits.pinnedAssetsPerBrand) {
        return fail(
          409,
          `Você atingiu ${deps.limits.pinnedAssetsPerBrand} itens fixados nesta marca. Desafixe algum para continuar.`,
          { code: 'limit_reached', limit: 'pinnedAssets' }
        );
      }
    }
    if (!input.pinned && asset.pinned) {
      // Vira o recente mais novo, para a poda não apagá-lo logo em seguida.
      patch.lastUsedAt = deps.now().toISOString();
      unpinned = true;
    }
    patch.pinned = input.pinned;
  }
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    if (!name) return fail(400, 'Nome do item inválido.');
    if (
      name.toLowerCase() !== asset.name.toLowerCase() &&
      (await deps.repo.findAssetByName(user.id, asset.brandId, asset.kind, name))
    ) {
      return fail(409, 'Já existe um item com esse nome nesta marca.', { code: 'name_taken' });
    }
    patch.name = name;
  }
  if (input.data !== undefined) {
    const data = cleanObject(input.data, MAX_DATA_BYTES);
    if (!data) return fail(400, 'Dados do item inválidos.');
    patch.data = data;
  }
  if (input.analysis !== undefined) {
    if (input.analysis === null) {
      patch.analysis = null;
    } else {
      const analysis = cleanObject(input.analysis, MAX_DATA_BYTES);
      if (!analysis) return fail(400, 'Análise inválida.');
      patch.analysis = analysis;
    }
  }
  if (Object.keys(patch).length === 0) return fail(400, 'Nada para atualizar.');

  const updated = await deps.repo.updateAsset(user.id, asset.id, patch);
  if (!updated) return fail(404, ASSET_NOT_FOUND);
  if (unpinned) await pruneRecents(deps, user.id, asset.brandId);
  return ok({ asset: updated });
}

export async function deleteAsset(deps: MemoryDeps, user: User, input: { assetId: unknown }): Promise<Result> {
  const asset = await findAsset(deps, user.id, input.assetId);
  if (!asset) return fail(404, ASSET_NOT_FOUND);
  await removePhotosQuietly(deps, asset.photos.map((p) => p.path));
  await deps.repo.deleteAsset(user.id, asset.id);
  return ok();
}
