import type { ReferenceImageItem } from '../../types';

export const SAVABLE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_SAVED_PHOTOS = 4;

export type PhotoSlot = { kind: 'keep'; path: string } | { kind: 'new'; image: ReferenceImageItem; index: number };

export interface PhotoPlan {
  unchanged: boolean;
  slots: PhotoSlot[];
  truncated: boolean;
  skippedUnsupported: number;
}

// `index` é a posição da imagem na galeria original, para gravar o storagePath de volta.
// Galeria vazia conta como "sem mudança": nunca apaga as fotos já salvas.
export function planPhotoSync(images: ReferenceImageItem[], savedPaths: string[]): PhotoPlan {
  const savable = images
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => SAVABLE_MIMES.includes(image.mimeType));
  const chosen = savable.slice(0, MAX_SAVED_PHOTOS);
  const saved = new Set(savedPaths);
  const slots: PhotoSlot[] = chosen.map(({ image, index }) =>
    image.storagePath && saved.has(image.storagePath)
      ? { kind: 'keep', path: image.storagePath }
      : { kind: 'new', image, index }
  );
  const sameAsSaved =
    slots.length === savedPaths.length && slots.every((s, i) => s.kind === 'keep' && s.path === savedPaths[i]);
  return {
    unchanged: slots.length === 0 || sameAsSaved,
    slots,
    truncated: savable.length > MAX_SAVED_PHOTOS,
    skippedUnsupported: images.length - savable.length,
  };
}

export function withStoragePaths(
  images: ReferenceImageItem[],
  updates: { index: number; path: string }[]
): ReferenceImageItem[] {
  const byIndex = new Map(updates.map((u) => [u.index, u.path]));
  return images.map((image, index) => (byIndex.has(index) ? { ...image, storagePath: byIndex.get(index) } : image));
}

// A galeria pode ter mudado enquanto o salvamento rodava: casa por dataUrl, não por posição.
export function mergeStoragePaths(current: ReferenceImageItem[], synced: ReferenceImageItem[]): ReferenceImageItem[] {
  const byDataUrl = new Map(synced.filter((i) => i.storagePath).map((i) => [i.dataUrl, i.storagePath as string]));
  return current.map((image) =>
    !image.storagePath && byDataUrl.has(image.dataUrl) ? { ...image, storagePath: byDataUrl.get(image.dataUrl) } : image
  );
}
