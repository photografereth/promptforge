import { describe, it, expect } from 'vitest';
import { isAssetPhotoPath, mimeFromPath, photoPath } from './paths.js';

const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = '00000000-0000-4000-8000-000000000001';
const A = '00000000-0000-4000-8000-000000000002';
const F = 'f0000000-0000-4000-8000-000000000001';

describe('photoPath', () => {
  it('monta usuário/marca/ativo/arquivo.ext', () => {
    expect(photoPath(U, B, A, F, 'image/png')).toBe(`${U}/${B}/${A}/${F}.png`);
  });
});

describe('isAssetPhotoPath', () => {
  it('aceita um caminho gerado para aquele ativo', () => {
    expect(isAssetPhotoPath(photoPath(U, B, A, F, 'image/jpeg'), U, B, A)).toBe(true);
  });
  it('recusa outro usuário, outro ativo, travessia, segmento extra e extensão estranha', () => {
    const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    expect(isAssetPhotoPath(`${other}/${B}/${A}/${F}.jpg`, U, B, A)).toBe(false);
    expect(isAssetPhotoPath(`${U}/${B}/${other}/${F}.jpg`, U, B, A)).toBe(false);
    expect(isAssetPhotoPath(`${U}/${B}/${A}/../${F}.jpg`, U, B, A)).toBe(false);
    expect(isAssetPhotoPath(`${U}/${B}/${A}/x/${F}.jpg`, U, B, A)).toBe(false);
    expect(isAssetPhotoPath(`${U}/${B}/${A}/${F}.svg`, U, B, A)).toBe(false);
    expect(isAssetPhotoPath(42, U, B, A)).toBe(false);
  });
});

describe('mimeFromPath', () => {
  it('deduz o tipo pela extensão', () => {
    expect(mimeFromPath(`${U}/${B}/${A}/${F}.webp`)).toBe('image/webp');
    expect(mimeFromPath(`${U}/${B}/${A}/${F}.jpg`)).toBe('image/jpeg');
  });
});
