import type { ALLOWED_PHOTO_MIMES } from './limits.js';

export type AssetKind = 'product' | 'character';
export type PhotoMime = (typeof ALLOWED_PHOTO_MIMES)[number];

// Mesmo formato de UserPreferences do frontend (src/types.ts).
export interface BrandKit {
  autoApply?: boolean;
  preferredAgent?: 'pov' | 'ugc' | 'motion';
  preferredStyle?: string;
  preferredPalette?: string;
  preferredCamera?: string;
}

export interface Brand {
  id: string;
  userId: string;
  name: string;
  kit: BrandKit;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  path: string;
  mime: string;
  size: number;
}

export interface Asset {
  id: string;
  brandId: string;
  userId: string;
  kind: AssetKind;
  name: string;
  data: Record<string, unknown>;
  analysis: Record<string, unknown> | null;
  photos: Photo[];
  pinned: boolean;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type NewAsset = Pick<Asset, 'brandId' | 'kind' | 'name' | 'data' | 'analysis' | 'photos' | 'pinned' | 'lastUsedAt'>;
export type AssetPatch = Partial<Pick<Asset, 'name' | 'data' | 'analysis' | 'photos' | 'pinned' | 'lastUsedAt'>>;

export interface PromptEntry {
  id: string;
  brandId: string;
  userId: string;
  mode: 'video' | 'image';
  agent: string | null;
  title: string;
  productName: string | null;
  deterministicPrompt: string;
  enhancedPrompt: string | null;
  state: Record<string, unknown> | null;
  assetIds: string[];
  favorite: boolean;
  legacyId: string | null;
  createdAt: string;
}

export type NewPrompt = Omit<PromptEntry, 'id' | 'userId' | 'favorite' | 'createdAt'> & { createdAt?: string };

export interface PromptQuery {
  q?: string;
  favorite?: boolean;
  before?: { createdAt: string; id: string };
  limit: number;
}

// Toda operação recebe userId e só enxerga dados desse usuário.
export interface MemoryRepo {
  listBrands(userId: string): Promise<Brand[]>; // mais antiga primeiro
  getBrand(userId: string, brandId: string): Promise<Brand | null>;
  insertBrand(userId: string, input: { name: string; kit: BrandKit; isDefault: boolean }): Promise<Brand>;
  updateBrand(userId: string, brandId: string, patch: Partial<Pick<Brand, 'name' | 'kit' | 'isDefault'>>): Promise<Brand | null>;
  deleteBrand(userId: string, brandId: string): Promise<void>; // cascata: ativos e prompts
  listAssets(userId: string, brandId: string): Promise<Asset[]>; // usado mais recentemente primeiro
  listAllAssets(userId: string): Promise<Asset[]>;
  getAsset(userId: string, assetId: string): Promise<Asset | null>;
  findAssetByName(userId: string, brandId: string, kind: AssetKind, name: string): Promise<Asset | null>; // sem diferenciar maiúsculas
  insertAsset(userId: string, input: NewAsset): Promise<Asset>; // lança se o nome já existe na marca e tipo
  updateAsset(userId: string, assetId: string, patch: AssetPatch): Promise<Asset | null>;
  deleteAsset(userId: string, assetId: string): Promise<void>;
  listPrompts(userId: string, brandId: string, query: PromptQuery): Promise<PromptEntry[]>; // mais novo primeiro
  getPrompt(userId: string, promptId: string): Promise<PromptEntry | null>;
  insertPrompt(userId: string, input: NewPrompt): Promise<PromptEntry>;
  setPromptFavorite(userId: string, promptId: string, favorite: boolean): Promise<PromptEntry | null>;
  deletePrompt(userId: string, promptId: string): Promise<void>;
  existingLegacyIds(userId: string, legacyIds: string[]): Promise<string[]>;
  deleteAllBrands(userId: string): Promise<void>;
}

export interface UploadTicket {
  path: string;
  signedUrl: string;
  token: string;
}

export interface StoredFileInfo {
  size: number;
  mime: string | null;
}

export interface StoragePort {
  createUploadUrls(paths: string[]): Promise<UploadTicket[]>;
  createReadUrls(paths: string[], expiresInSeconds: number): Promise<Record<string, string>>;
  stat(path: string): Promise<StoredFileInfo | null>; // null = não existe
  remove(paths: string[]): Promise<void>;
  listFiles(folder: string): Promise<string[]>; // caminhos completos dos arquivos diretamente na pasta
  removeUnder(prefix: string): Promise<void>; // tudo sob o prefixo, recursivo
}

export interface MemoryLimits {
  brands: number;
  pinnedAssetsPerBrand: number;
  recentAssetsPerBrand: number;
  photosPerAsset: number;
}

export interface MemoryDeps {
  repo: MemoryRepo;
  storage: StoragePort;
  limits: MemoryLimits;
  now: () => Date;
  newId: () => string;
}
