import { describe, it, expect } from 'vitest';
import { mergeStoragePaths, planPhotoSync, withStoragePaths } from './photoPlan';
import type { ReferenceImageItem } from '../../types';

const img = (id: string, extra: Partial<ReferenceImageItem> = {}): ReferenceImageItem => ({
  dataUrl: `data:image/jpeg;base64,${id}`, name: id, size: 1, mimeType: 'image/jpeg', ...extra,
});

describe('planPhotoSync', () => {
  it('fotos já salvas na mesma ordem: nada muda', () => {
    const plan = planPhotoSync([img('a', { storagePath: 'p/a' }), img('b', { storagePath: 'p/b' })], ['p/a', 'p/b']);
    expect(plan.unchanged).toBe(true);
  });
  it('galeria vazia nunca apaga as fotos salvas', () => {
    expect(planPhotoSync([], ['p/a']).unchanged).toBe(true);
  });
  it('mistura foto mantida e foto nova, na ordem da galeria', () => {
    const plan = planPhotoSync([img('a', { storagePath: 'p/a' }), img('n')], ['p/a', 'p/b']);
    expect(plan.unchanged).toBe(false);
    expect(plan.slots.map((s) => s.kind)).toEqual(['keep', 'new']);
  });
  it('ignora tipos não suportados (amostras SVG) e guarda só as 4 primeiras', () => {
    const images = [img('svg', { mimeType: 'image/svg+xml' }), img('1'), img('2'), img('3'), img('4'), img('5')];
    const plan = planPhotoSync(images, []);
    expect(plan.skippedUnsupported).toBe(1);
    expect(plan.truncated).toBe(true);
    expect(plan.slots).toHaveLength(4);
    expect(plan.slots.every((s) => s.kind === 'new' && s.image.name !== 'svg')).toBe(true);
  });
});

describe('storagePath de volta na galeria', () => {
  it('withStoragePaths grava por posição original', () => {
    const out = withStoragePaths([img('a'), img('b')], [{ index: 1, path: 'p/b' }]);
    expect(out.map((i) => i.storagePath)).toEqual([undefined, 'p/b']);
  });
  it('mergeStoragePaths casa por dataUrl, não por posição', () => {
    const current = [img('novo'), img('a')];
    const synced = [img('a', { storagePath: 'p/a' })];
    expect(mergeStoragePaths(current, synced).map((i) => i.storagePath)).toEqual([undefined, 'p/a']);
  });
});
