import { ALLOWED_PHOTO_MIMES, MAX_KIT_TEXT, MAX_NAME_LENGTH } from './limits.js';
import type { BrandKit, PhotoMime } from './types.js';

export const AGENTS: ReadonlySet<string> = new Set(['pov', 'ugc', 'motion']);

export function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= MAX_NAME_LENGTH ? name : null;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export function cleanObject(value: unknown, maxBytes: number): Record<string, unknown> | null {
  if (!isPlainObject(value)) return null;
  return jsonBytes(value) <= maxBytes ? value : null;
}

export function cleanText(value: unknown, maxBytes: number): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return Buffer.byteLength(value, 'utf8') <= maxBytes ? value : null;
}

// Só as chaves conhecidas sobrevivem; um valor inválido anula o kit inteiro.
export function cleanKit(value: unknown): BrandKit | null {
  if (!isPlainObject(value)) return null;
  const kit: BrandKit = {};
  if (value.autoApply !== undefined) {
    if (typeof value.autoApply !== 'boolean') return null;
    kit.autoApply = value.autoApply;
  }
  if (value.preferredAgent !== undefined) {
    if (typeof value.preferredAgent !== 'string' || !AGENTS.has(value.preferredAgent)) return null;
    kit.preferredAgent = value.preferredAgent as BrandKit['preferredAgent'];
  }
  for (const key of ['preferredStyle', 'preferredPalette', 'preferredCamera'] as const) {
    const text = value[key];
    if (text === undefined) continue;
    if (typeof text !== 'string' || text.length > MAX_KIT_TEXT) return null;
    kit[key] = text;
  }
  return kit;
}

// A busca vira filtro `.or(...)` do PostgREST: só letras, números e espaços passam.
export function cleanSearch(value: string): string | undefined {
  const cleaned = value.replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function isAllowedMime(value: unknown): value is PhotoMime {
  return typeof value === 'string' && (ALLOWED_PHOTO_MIMES as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
