import { fail, ok, type Result, type User } from '../../billing/service/context.js';
import {
  MAX_PROMPT_ASSETS,
  MAX_PROMPT_BYTES,
  MAX_QUERY_LENGTH,
  MAX_STATE_BYTES,
  MAX_TITLE_LENGTH,
  PROMPTS_PAGE_SIZE,
} from '../limits.js';
import { AGENTS, cleanName, cleanObject, cleanSearch, cleanText, isUuid } from '../validate.js';
import type { MemoryDeps } from '../types.js';
import { findAsset } from './assets.js';
import { BRAND_NOT_FOUND, findBrand } from './brands.js';

const PROMPT_NOT_FOUND = 'Prompt não encontrado.';

export interface ParsedPrompt {
  mode: 'video' | 'image';
  agent: string | null;
  title: string;
  productName: string | null;
  deterministicPrompt: string;
  enhancedPrompt: string | null;
  state: Record<string, unknown> | null;
}

const isBlank = (value: unknown) => value === undefined || value === null || value === '';

export function parsePrompt(raw: Record<string, unknown>): ParsedPrompt | { error: string } {
  if (raw.mode !== 'video' && raw.mode !== 'image') return { error: 'Modo inválido.' };
  let agent: string | null = null;
  if (!isBlank(raw.agent)) {
    if (typeof raw.agent !== 'string' || !AGENTS.has(raw.agent)) return { error: 'Agente inválido.' };
    agent = raw.agent;
  }
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) return { error: 'Título inválido.' };
  let productName: string | null = null;
  if (!isBlank(raw.productName)) {
    productName = cleanName(raw.productName);
    if (!productName) return { error: 'Nome do produto inválido.' };
  }
  const deterministicPrompt = cleanText(raw.deterministicPrompt, MAX_PROMPT_BYTES);
  if (!deterministicPrompt) return { error: 'Prompt inválido.' };
  let enhancedPrompt: string | null = null;
  if (!isBlank(raw.enhancedPrompt)) {
    enhancedPrompt = cleanText(raw.enhancedPrompt, MAX_PROMPT_BYTES);
    if (!enhancedPrompt) return { error: 'Prompt aprimorado inválido.' };
  }
  let state: Record<string, unknown> | null = null;
  if (raw.state !== undefined && raw.state !== null) {
    state = cleanObject(raw.state, MAX_STATE_BYTES);
    if (!state) return { error: 'Estado do prompt inválido.' };
  }
  return { mode: raw.mode, agent, title, productName, deterministicPrompt, enhancedPrompt, state };
}

export function encodeCursor(entry: { createdAt: string; id: string }): string {
  return `${entry.createdAt}|${entry.id}`;
}

// O cursor vira filtro do PostgREST: formato exato, porque Date.parse aceita texto entre parênteses.
const CURSOR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

export function decodeCursor(value: unknown): { createdAt: string; id: string } | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('|');
  if (parts.length !== 2) return null;
  const [createdAt, id] = parts;
  if (!isUuid(id) || !CURSOR_TIMESTAMP.test(createdAt) || Number.isNaN(Date.parse(createdAt))) return null;
  return { createdAt, id };
}

export async function listPrompts(
  deps: MemoryDeps,
  user: User,
  input: { brandId: unknown; q: unknown; favorite: unknown; cursor: unknown }
): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  let q: string | undefined;
  if (!isBlank(input.q)) {
    if (typeof input.q !== 'string' || input.q.length > MAX_QUERY_LENGTH) return fail(400, 'Busca inválida.');
    q = cleanSearch(input.q);
  }
  let before: { createdAt: string; id: string } | undefined;
  if (!isBlank(input.cursor)) {
    const decoded = decodeCursor(input.cursor);
    if (!decoded) return fail(400, 'Cursor inválido.');
    before = decoded;
  }
  const favorite = input.favorite === true || input.favorite === 'true' ? true : undefined;
  const rows = await deps.repo.listPrompts(user.id, brand.id, { q, favorite, before, limit: PROMPTS_PAGE_SIZE + 1 });
  const page = rows.slice(0, PROMPTS_PAGE_SIZE);
  const nextCursor = rows.length > PROMPTS_PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null;
  return ok({ prompts: page, nextCursor });
}

export async function savePrompt(deps: MemoryDeps, user: User, input: Record<string, unknown>): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  const parsed = parsePrompt(input);
  if ('error' in parsed) return fail(400, parsed.error);
  const assetIds: string[] = [];
  if (input.assetIds !== undefined) {
    if (!Array.isArray(input.assetIds) || input.assetIds.length > MAX_PROMPT_ASSETS) {
      return fail(400, 'Lista de itens inválida.');
    }
    for (const id of input.assetIds as unknown[]) {
      const asset = await findAsset(deps, user.id, id);
      if (asset && asset.brandId === brand.id && !assetIds.includes(asset.id)) assetIds.push(asset.id);
    }
  }
  const prompt = await deps.repo.insertPrompt(user.id, { ...parsed, brandId: brand.id, assetIds, legacyId: null });
  return ok({ prompt });
}

export async function setPromptFavorite(
  deps: MemoryDeps,
  user: User,
  input: { promptId: unknown; favorite: unknown }
): Promise<Result> {
  if (!isUuid(input.promptId)) return fail(404, PROMPT_NOT_FOUND);
  if (typeof input.favorite !== 'boolean') return fail(400, 'Valor inválido para favorito.');
  const prompt = await deps.repo.setPromptFavorite(user.id, input.promptId, input.favorite);
  return prompt ? ok({ prompt }) : fail(404, PROMPT_NOT_FOUND);
}

export async function deletePrompt(deps: MemoryDeps, user: User, input: { promptId: unknown }): Promise<Result> {
  if (!isUuid(input.promptId)) return fail(404, PROMPT_NOT_FOUND);
  const prompt = await deps.repo.getPrompt(user.id, input.promptId);
  if (!prompt) return fail(404, PROMPT_NOT_FOUND);
  await deps.repo.deletePrompt(user.id, prompt.id);
  return ok();
}
