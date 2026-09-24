import { fail, ok, type Result, type User } from '../../billing/service/context.js';
import { MAX_PHOTO_BYTES } from '../limits.js';
import { isAssetPhotoPath, mimeFromPath, photoPath } from '../paths.js';
import { isAllowedMime, isPlainObject } from '../validate.js';
import type { MemoryDeps, Photo, PhotoMime } from '../types.js';
import { ASSET_NOT_FOUND, findAsset } from './assets.js';
import { removePhotosQuietly } from './shared.js';

const INVALID_LIST = 'Lista de fotos inválida.';

function photoLimit(deps: MemoryDeps): Result {
  return fail(409, `Cada item pode ter até ${deps.limits.photosPerAsset} fotos.`, {
    code: 'limit_reached',
    limit: 'photos',
  });
}

export async function requestPhotoUploads(
  deps: MemoryDeps,
  user: User,
  input: { assetId: unknown; files: unknown }
): Promise<Result> {
  const asset = await findAsset(deps, user.id, input.assetId);
  if (!asset) return fail(404, ASSET_NOT_FOUND);
  if (!Array.isArray(input.files) || input.files.length === 0 || input.files.length > deps.limits.photosPerAsset) {
    return fail(400, INVALID_LIST);
  }
  const files: { mime: PhotoMime; size: number }[] = [];
  for (const file of input.files as unknown[]) {
    if (
      !isPlainObject(file) ||
      !isAllowedMime(file.mime) ||
      typeof file.size !== 'number' ||
      !Number.isInteger(file.size) ||
      file.size <= 0 ||
      file.size > MAX_PHOTO_BYTES
    ) {
      return fail(400, 'Foto inválida: use JPEG, PNG ou WebP de até 2 MB.');
    }
    files.push({ mime: file.mime, size: file.size });
  }
  if (asset.photos.length + files.length > deps.limits.photosPerAsset) return photoLimit(deps);

  // Envios pendentes nunca confirmados deste ativo são descartados a cada novo pedido,
  // para pedidos repetidos não acumularem arquivos no Storage.
  const confirmed = new Set(asset.photos.map((p) => p.path));
  const stale = (await deps.storage.listFiles(`${user.id}/${asset.brandId}/${asset.id}`)).filter(
    (p) => !confirmed.has(p)
  );
  await removePhotosQuietly(deps, stale);

  const paths = files.map((f) => photoPath(user.id, asset.brandId, asset.id, deps.newId(), f.mime));
  return ok({ uploads: await deps.storage.createUploadUrls(paths) });
}

export async function confirmPhotos(
  deps: MemoryDeps,
  user: User,
  input: { assetId: unknown; paths: unknown }
): Promise<Result> {
  const asset = await findAsset(deps, user.id, input.assetId);
  if (!asset) return fail(404, ASSET_NOT_FOUND);
  if (!Array.isArray(input.paths) || input.paths.length === 0 || input.paths.length > deps.limits.photosPerAsset) {
    return fail(400, INVALID_LIST);
  }
  const known = new Set(asset.photos.map((p) => p.path));
  const fresh: string[] = [];
  for (const path of input.paths as unknown[]) {
    if (!isAssetPhotoPath(path, user.id, asset.brandId, asset.id)) return fail(400, 'Caminho de foto inválido.');
    if (!known.has(path) && !fresh.includes(path)) fresh.push(path);
  }
  if (fresh.length === 0) return ok({ asset });
  if (asset.photos.length + fresh.length > deps.limits.photosPerAsset) return photoLimit(deps);

  const added: Photo[] = [];
  for (const path of fresh) {
    const info = await deps.storage.stat(path);
    if (!info) return fail(400, 'Foto não encontrada. Envie de novo.', { code: 'photo_missing' });
    if (info.size > MAX_PHOTO_BYTES) {
      await removePhotosQuietly(deps, [path]);
      return fail(400, 'Foto acima de 2 MB.');
    }
    added.push({ path, mime: info.mime ?? mimeFromPath(path), size: info.size });
  }
  const updated = await deps.repo.updateAsset(user.id, asset.id, {
    photos: [...asset.photos, ...added],
    analysis: null,
  });
  return updated ? ok({ asset: updated }) : fail(404, ASSET_NOT_FOUND);
}

export async function removePhoto(
  deps: MemoryDeps,
  user: User,
  input: { assetId: unknown; path: unknown }
): Promise<Result> {
  const asset = await findAsset(deps, user.id, input.assetId);
  if (!asset) return fail(404, ASSET_NOT_FOUND);
  if (typeof input.path !== 'string' || !asset.photos.some((p) => p.path === input.path)) {
    return fail(404, 'Foto não encontrada.');
  }
  const path = input.path;
  await removePhotosQuietly(deps, [path]);
  const updated = await deps.repo.updateAsset(user.id, asset.id, {
    photos: asset.photos.filter((p) => p.path !== path),
    analysis: null,
  });
  return updated ? ok({ asset: updated }) : fail(404, ASSET_NOT_FOUND);
}
