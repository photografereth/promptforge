import { errorName } from './errorName.js';
import type { LogRepo } from './types.js';
import { createSupabaseRepo } from './repo.js';

export function logInfo(event: string, details?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: 'info', event, ...details }));
}

export function logWarn(event: string, details?: Record<string, unknown>): void {
  console.warn(JSON.stringify({ level: 'warn', event, ...details }));
}

// Awaited: Vercel pode descartar uma escrita fire-and-forget depois que a resposta sai.
export async function logError(
  event: string,
  details?: Record<string, unknown>,
  repo: LogRepo = createSupabaseRepo()
): Promise<void> {
  console.error(JSON.stringify({ level: 'error', event, ...details }));
  try {
    await repo.insertLog('error', event, details ?? null);
  } catch (err) {
    console.error(
      JSON.stringify({ level: 'error', event: 'log_persist_failed', errorName: errorName(err) })
    );
  }
}
