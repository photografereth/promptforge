import type { PhotoMime } from './types.js';

const EXT: Record<PhotoMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME: Record<string, PhotoMime> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function photoPath(userId: string, brandId: string, assetId: string, fileId: string, mime: PhotoMime): string {
  return `${userId}/${brandId}/${assetId}/${fileId}.${EXT[mime]}`;
}

// O caminho vem do cliente em photo-confirm/photo-remove: só vale o formato exato gerado pelo servidor.
export function isAssetPhotoPath(path: unknown, userId: string, brandId: string, assetId: string): path is string {
  if (typeof path !== 'string') return false;
  const prefix = `${userId}/${brandId}/${assetId}/`;
  return path.startsWith(prefix) && FILE.test(path.slice(prefix.length));
}

export function mimeFromPath(path: string): PhotoMime {
  return MIME[path.slice(path.lastIndexOf('.') + 1)] ?? 'image/jpeg';
}
