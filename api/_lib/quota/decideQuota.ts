import { todaySaoPauloDateString } from './timezone.js';
import { DAILY_LIMIT, type UsageRepo } from './types.js';

// Falha fechada: qualquer erro ao incrementar a cota nunca libera a chamada de IA.
export async function decideQuota(repo: UsageRepo, userId: string, now: Date): Promise<'ok' | 'exceeded' | 'error'> {
  try {
    const dateStr = todaySaoPauloDateString(now);
    const count = await repo.incrementAndGetUsage(userId, dateStr);
    return count <= DAILY_LIMIT ? 'ok' : 'exceeded';
  } catch {
    return 'error';
  }
}
