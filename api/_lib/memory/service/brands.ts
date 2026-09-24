import { fail, ok, type Result, type User } from '../../billing/service/context.js';
import { cleanKit, cleanName, isUuid } from '../validate.js';
import type { Brand, BrandKit, MemoryDeps } from '../types.js';
import { removePhotosQuietly } from './shared.js';

export const DEFAULT_BRAND_NAME = 'Minha marca';
export const BRAND_NOT_FOUND = 'Marca não encontrada.';

export async function ensureBrands(deps: MemoryDeps, userId: string): Promise<Brand[]> {
  const brands = await deps.repo.listBrands(userId);
  if (brands.length > 0) return brands;
  try {
    await deps.repo.insertBrand(userId, { name: DEFAULT_BRAND_NAME, kit: {}, isDefault: true });
  } catch {
    // Uma requisição simultânea já criou a marca padrão (índice único de is_default).
  }
  return deps.repo.listBrands(userId);
}

export async function findBrand(deps: MemoryDeps, userId: string, brandId: unknown): Promise<Brand | null> {
  return isUuid(brandId) ? deps.repo.getBrand(userId, brandId) : null;
}

export async function listBrands(deps: MemoryDeps, user: User): Promise<Result> {
  return ok({ brands: await ensureBrands(deps, user.id) });
}

export async function createBrand(deps: MemoryDeps, user: User, input: { name: unknown }): Promise<Result> {
  const name = cleanName(input.name);
  if (!name) return fail(400, 'Nome da marca inválido.');
  const brands = await ensureBrands(deps, user.id);
  if (brands.length >= deps.limits.brands) {
    return fail(409, `Seu plano permite até ${deps.limits.brands} marcas.`, {
      code: 'limit_reached',
      limit: 'brands',
    });
  }
  const brand = await deps.repo.insertBrand(user.id, { name, kit: {}, isDefault: false });
  return ok({ brand });
}

export async function updateBrand(
  deps: MemoryDeps,
  user: User,
  input: { brandId: unknown; name: unknown; kit: unknown }
): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  const patch: { name?: string; kit?: BrandKit } = {};
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    if (!name) return fail(400, 'Nome da marca inválido.');
    patch.name = name;
  }
  if (input.kit !== undefined) {
    const kit = cleanKit(input.kit);
    if (!kit) return fail(400, 'Kit da marca inválido.');
    patch.kit = kit;
  }
  if (Object.keys(patch).length === 0) return fail(400, 'Nada para atualizar.');
  const updated = await deps.repo.updateBrand(user.id, brand.id, patch);
  return updated ? ok({ brand: updated }) : fail(404, BRAND_NOT_FOUND);
}

export async function deleteBrand(deps: MemoryDeps, user: User, input: { brandId: unknown }): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  const brands = await deps.repo.listBrands(user.id);
  if (brands.length <= 1) {
    return fail(409, 'Não é possível apagar a única marca da conta.', { code: 'last_brand' });
  }
  const assets = await deps.repo.listAssets(user.id, brand.id);
  await removePhotosQuietly(deps, assets.flatMap((a) => a.photos.map((p) => p.path)));
  await deps.repo.deleteBrand(user.id, brand.id);
  if (brand.isDefault) {
    const oldest = brands.find((b) => b.id !== brand.id);
    if (oldest) await deps.repo.updateBrand(user.id, oldest.id, { isDefault: true });
  }
  return ok();
}
