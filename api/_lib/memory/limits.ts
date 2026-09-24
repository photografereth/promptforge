import type { MemoryLimits } from './types.js';

// Limites por plano. Um futuro plano Agência é só uma nova entrada aqui.
export const MEMORY_LIMITS: Record<'default', MemoryLimits> = {
  default: { brands: 3, pinnedAssetsPerBrand: 30, recentAssetsPerBrand: 20, photosPerAsset: 4 },
};

export const MAX_NAME_LENGTH = 80;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DATA_BYTES = 20 * 1024;
export const MAX_STATE_BYTES = 50 * 1024;
export const MAX_PROMPT_BYTES = 20 * 1024;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PROMPTS_PAGE_SIZE = 20;
export const READ_URL_TTL_SECONDS = 3600;
export const MAX_IMPORT_ITEMS = 50;
export const MAX_KIT_TEXT = 200;
export const MAX_QUERY_LENGTH = 100;
export const MAX_PROMPT_ASSETS = 10;
