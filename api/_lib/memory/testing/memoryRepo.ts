import type { Asset, AssetKind, Brand, MemoryRepo, PromptEntry } from '../types.js';

export interface InMemoryRepo extends MemoryRepo {
  brands: Brand[];
  assets: Asset[];
  prompts: PromptEntry[];
}

const clone = <T>(value: T): T => structuredClone(value);

function removeWhere<T>(list: T[], predicate: (item: T) => boolean): void {
  for (let i = list.length - 1; i >= 0; i -= 1) if (predicate(list[i])) list.splice(i, 1);
}

// Imita as restrições do banco de que o serviço depende: uma marca padrão por usuário
// e nome único (sem diferenciar maiúsculas) por marca e tipo.
export function createMemoryRepo(): InMemoryRepo {
  const brands: Brand[] = [];
  const assets: Asset[] = [];
  const prompts: PromptEntry[] = [];
  let seq = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++seq * 1000).toISOString();

  const ownBrand = (userId: string, brandId: string) => brands.find((b) => b.userId === userId && b.id === brandId);
  const ownAsset = (userId: string, assetId: string) => assets.find((a) => a.userId === userId && a.id === assetId);
  const ownPrompt = (userId: string, promptId: string) => prompts.find((p) => p.userId === userId && p.id === promptId);
  const nameTaken = (userId: string, brandId: string, kind: AssetKind, name: string, exceptId?: string) =>
    assets.some(
      (a) =>
        a.userId === userId &&
        a.brandId === brandId &&
        a.kind === kind &&
        a.name.toLowerCase() === name.toLowerCase() &&
        a.id !== exceptId
    );

  return {
    brands,
    assets,
    prompts,

    async listBrands(userId) {
      return brands
        .filter((b) => b.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(clone);
    },
    async getBrand(userId, brandId) {
      const brand = ownBrand(userId, brandId);
      return brand ? clone(brand) : null;
    },
    async insertBrand(userId, input) {
      if (input.isDefault && brands.some((b) => b.userId === userId && b.isDefault)) {
        throw new Error('duplicate default brand');
      }
      const at = stamp();
      const brand: Brand = { id: nextId(), userId, ...clone(input), createdAt: at, updatedAt: at };
      brands.push(brand);
      return clone(brand);
    },
    async updateBrand(userId, brandId, patch) {
      const brand = ownBrand(userId, brandId);
      if (!brand) return null;
      Object.assign(brand, clone(patch), { updatedAt: stamp() });
      return clone(brand);
    },
    async deleteBrand(userId, brandId) {
      if (!ownBrand(userId, brandId)) return;
      removeWhere(brands, (b) => b.id === brandId);
      removeWhere(assets, (a) => a.brandId === brandId);
      removeWhere(prompts, (p) => p.brandId === brandId);
    },

    async listAssets(userId, brandId) {
      return assets
        .filter((a) => a.userId === userId && a.brandId === brandId)
        .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
        .map(clone);
    },
    async listAllAssets(userId) {
      return assets.filter((a) => a.userId === userId).map(clone);
    },
    async getAsset(userId, assetId) {
      const asset = ownAsset(userId, assetId);
      return asset ? clone(asset) : null;
    },
    async findAssetByName(userId, brandId, kind, name) {
      const asset = assets.find(
        (a) =>
          a.userId === userId && a.brandId === brandId && a.kind === kind && a.name.toLowerCase() === name.toLowerCase()
      );
      return asset ? clone(asset) : null;
    },
    async insertAsset(userId, input) {
      if (nameTaken(userId, input.brandId, input.kind, input.name)) throw new Error('duplicate asset name');
      const at = stamp();
      const asset: Asset = { id: nextId(), userId, ...clone(input), createdAt: at, updatedAt: at };
      assets.push(asset);
      return clone(asset);
    },
    async updateAsset(userId, assetId, patch) {
      const asset = ownAsset(userId, assetId);
      if (!asset) return null;
      if (patch.name !== undefined && nameTaken(userId, asset.brandId, asset.kind, patch.name, asset.id)) {
        throw new Error('duplicate asset name');
      }
      Object.assign(asset, clone(patch), { updatedAt: stamp() });
      return clone(asset);
    },
    async deleteAsset(userId, assetId) {
      removeWhere(assets, (a) => a.userId === userId && a.id === assetId);
    },

    async listPrompts(userId, brandId, query) {
      const q = query.q?.toLowerCase();
      const before = query.before;
      return prompts
        .filter((p) => p.userId === userId && p.brandId === brandId)
        .filter((p) => !query.favorite || p.favorite)
        .filter((p) => !q || p.title.toLowerCase().includes(q) || (p.productName ?? '').toLowerCase().includes(q))
        .filter(
          (p) => !before || p.createdAt < before.createdAt || (p.createdAt === before.createdAt && p.id < before.id)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, query.limit)
        .map(clone);
    },
    async getPrompt(userId, promptId) {
      const prompt = ownPrompt(userId, promptId);
      return prompt ? clone(prompt) : null;
    },
    async insertPrompt(userId, input) {
      const { createdAt, ...rest } = clone(input);
      const prompt: PromptEntry = { id: nextId(), userId, favorite: false, createdAt: createdAt ?? stamp(), ...rest };
      prompts.push(prompt);
      return clone(prompt);
    },
    async setPromptFavorite(userId, promptId, favorite) {
      const prompt = ownPrompt(userId, promptId);
      if (!prompt) return null;
      prompt.favorite = favorite;
      return clone(prompt);
    },
    async deletePrompt(userId, promptId) {
      removeWhere(prompts, (p) => p.userId === userId && p.id === promptId);
    },
    async existingLegacyIds(userId, legacyIds) {
      return prompts
        .filter((p) => p.userId === userId && p.legacyId !== null && legacyIds.includes(p.legacyId))
        .map((p) => p.legacyId as string);
    },
    async deleteAllBrands(userId) {
      removeWhere(brands, (b) => b.userId === userId);
      removeWhere(assets, (a) => a.userId === userId);
      removeWhere(prompts, (p) => p.userId === userId);
    },
  };
}
