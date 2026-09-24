import { fail, ok, type Result, type User } from '../../billing/service/context.js';
import { MAX_IMPORT_ITEMS } from '../limits.js';
import { cleanKit, isPlainObject } from '../validate.js';
import type { MemoryDeps } from '../types.js';
import { ensureBrands } from './brands.js';
import { parsePrompt, type ParsedPrompt } from './prompts.js';

function toIso(timestamp: unknown, fallback: Date): string {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback.toISOString();
}

// Importação única do histórico do navegador (PromptHistoryItem do frontend) para a marca padrão.
export async function importLocal(
  deps: MemoryDeps,
  user: User,
  input: { items: unknown; preferences: unknown }
): Promise<Result> {
  if (!Array.isArray(input.items) || input.items.length > MAX_IMPORT_ITEMS) return fail(400, 'Histórico inválido.');
  const brands = await ensureBrands(deps, user.id);
  const target = brands.find((b) => b.isDefault) ?? brands[0];

  const candidates: { legacyId: string; createdAt: string; value: ParsedPrompt }[] = [];
  let skipped = 0;
  for (const raw of input.items as unknown[]) {
    if (!isPlainObject(raw) || typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 100) {
      skipped += 1;
      continue;
    }
    const parsed = parsePrompt({
      mode: raw.mode,
      agent: raw.agent,
      title: raw.title,
      productName: raw.productName,
      deterministicPrompt: raw.deterministicPrompt,
      enhancedPrompt: raw.enhancedPrompt,
      state: raw.videoState ?? raw.imageState,
    });
    if ('error' in parsed) {
      skipped += 1;
      continue;
    }
    candidates.push({ legacyId: raw.id, createdAt: toIso(raw.timestamp, deps.now()), value: parsed });
  }

  const seen = new Set(await deps.repo.existingLegacyIds(user.id, candidates.map((c) => c.legacyId)));
  let imported = 0;
  for (const candidate of candidates) {
    if (seen.has(candidate.legacyId)) {
      skipped += 1;
      continue;
    }
    seen.add(candidate.legacyId);
    await deps.repo.insertPrompt(user.id, {
      ...candidate.value,
      brandId: target.id,
      assetIds: [],
      legacyId: candidate.legacyId,
      createdAt: candidate.createdAt,
    });
    imported += 1;
  }

  let kitImported = false;
  if (input.preferences !== undefined && Object.keys(target.kit).length === 0) {
    const kit = cleanKit(input.preferences);
    if (kit && Object.keys(kit).length > 0) {
      await deps.repo.updateBrand(user.id, target.id, { kit });
      kitImported = true;
    }
  }
  return ok({ brandId: target.id, imported, skipped, kitImported });
}
