import type { AppMode, UserPreferences } from '../../types';

export type AssetKind = 'product' | 'character';
export type LimitKind = 'brands' | 'pinnedAssets' | 'photos';

export type BrandKit = Partial<
  Pick<UserPreferences, 'autoApply' | 'preferredAgent' | 'preferredStyle' | 'preferredPalette' | 'preferredCamera'>
>;

export interface Brand {
  id: string;
  name: string;
  kit: BrandKit;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetPhoto {
  path: string;
  mime: string;
  size: number;
  url?: string | null;
}

export interface MemoryAsset {
  id: string;
  brandId: string;
  kind: AssetKind;
  name: string;
  data: Record<string, unknown>;
  analysis: Record<string, unknown> | null;
  photos: AssetPhoto[];
  pinned: boolean;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryPrompt {
  id: string;
  brandId: string;
  mode: AppMode;
  agent: string | null;
  title: string;
  productName: string | null;
  deterministicPrompt: string;
  enhancedPrompt: string | null;
  state: Record<string, unknown> | null;
  assetIds: string[];
  favorite: boolean;
  createdAt: string;
}

export interface UploadTicket {
  path: string;
  signedUrl: string;
  token: string;
}

export interface SavePromptInput {
  brandId: string;
  mode: AppMode;
  agent?: string;
  title: string;
  productName?: string;
  deterministicPrompt: string;
  enhancedPrompt?: string;
  state?: Record<string, unknown>;
  assetIds?: string[];
}
