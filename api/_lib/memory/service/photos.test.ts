import { describe, it, expect } from 'vitest';
import { confirmPhotos, removePhoto, requestPhotoUploads } from './photos.js';
import { photoPath } from '../paths.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from '../testing/fixtures.js';
import type { UploadTicket } from '../types.js';

async function setup(photoCount = 0) {
  const ctx = makeDeps();
  const brand = await seedBrand(ctx.deps, USER_A);
  const photos = Array.from({ length: photoCount }, (_, i) => ({
    path: photoPath(USER_A.id, brand.id, '00000000-0000-4000-8000-0000000000ff', `e0000000-0000-4000-8000-00000000000${i}`, 'image/jpeg'),
    mime: 'image/jpeg',
    size: 1,
  }));
  const asset = await seedAsset(ctx.deps, USER_A, brand.id, { photos, analysis: { resumo: 'antiga' } });
  return { ...ctx, brand, asset };
}

const jpeg = { mime: 'image/jpeg', size: 300_000 };

describe('requestPhotoUploads', () => {
  it('devolve um link por foto, com caminho gerado no prefixo do ativo', async () => {
    const { deps, brand, asset } = await setup();
    const res = await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [jpeg, { mime: 'image/png', size: 10 }] });
    expect(res.status).toBe(200);
    const uploads = res.body.uploads as UploadTicket[];
    expect(uploads).toHaveLength(2);
    expect(uploads[0].path.startsWith(`${USER_A.id}/${brand.id}/${asset.id}/`)).toBe(true);
    expect(uploads[1].path.endsWith('.png')).toBe(true);
  });

  it('400 para tipo não permitido, tamanho acima de 2 MB ou lista vazia', async () => {
    const { deps, asset } = await setup();
    expect((await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [{ mime: 'image/gif', size: 1 }] })).status).toBe(400);
    expect((await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [{ mime: 'image/jpeg', size: 3_000_000 }] })).status).toBe(400);
    expect((await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [] })).status).toBe(400);
  });

  it('409 quando passaria de 4 fotos no ativo', async () => {
    const { deps, asset } = await setup(3);
    const res = await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [jpeg, jpeg] });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'limit_reached', limit: 'photos' });
  });
});

describe('confirmPhotos', () => {
  it('registra as fotos enviadas e zera a análise; repetir não duplica', async () => {
    const { deps, storage, asset } = await setup();
    const { body } = await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [jpeg] });
    const [ticket] = body.uploads as UploadTicket[];
    simulateUpload(storage, ticket.path, 250_000, 'image/jpeg');

    const res = await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: [ticket.path] });
    expect(res.status).toBe(200);
    expect(res.body.asset).toMatchObject({ analysis: null, photos: [{ path: ticket.path, mime: 'image/jpeg', size: 250_000 }] });

    const again = await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: [ticket.path] });
    expect((again.body.asset as { photos: unknown[] }).photos).toHaveLength(1);
  });

  it('400 para caminho fora do prefixo do ativo (inclusive de outro usuário)', async () => {
    const { deps, storage, brand, asset } = await setup();
    const foreign = photoPath(USER_B.id, brand.id, asset.id, 'e0000000-0000-4000-8000-000000000001', 'image/jpeg');
    simulateUpload(storage, foreign);
    expect((await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: [foreign] })).status).toBe(400);
    expect((await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: ['../../x.jpg'] })).status).toBe(400);
  });

  it('400 photo_missing quando o arquivo não foi enviado', async () => {
    const { deps, asset } = await setup();
    const { body } = await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [jpeg] });
    const [ticket] = body.uploads as UploadTicket[];
    const res = await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: [ticket.path] });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'photo_missing' });
  });

  it('400 e remove o arquivo quando o tamanho real passa de 2 MB', async () => {
    const { deps, storage, asset } = await setup();
    const { body } = await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [jpeg] });
    const [ticket] = body.uploads as UploadTicket[];
    simulateUpload(storage, ticket.path, 5_000_000);
    expect((await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: [ticket.path] })).status).toBe(400);
    expect(storage.files.has(ticket.path)).toBe(false);
  });
});

describe('removePhoto', () => {
  it('remove do Storage e do ativo e zera a análise', async () => {
    const { deps, storage, asset } = await setup(1);
    const path = asset.photos[0].path;
    simulateUpload(storage, path);
    const res = await removePhoto(deps, USER_A, { assetId: asset.id, path });
    expect(res.status).toBe(200);
    expect(res.body.asset).toMatchObject({ photos: [], analysis: null });
    expect(storage.files.has(path)).toBe(false);
  });

  it('404 para foto que não pertence ao ativo ou ativo de outro usuário', async () => {
    const { deps, asset } = await setup(1);
    expect((await removePhoto(deps, USER_A, { assetId: asset.id, path: 'outra.jpg' })).status).toBe(404);
    expect((await removePhoto(deps, USER_B, { assetId: asset.id, path: asset.photos[0].path })).status).toBe(404);
  });
});
