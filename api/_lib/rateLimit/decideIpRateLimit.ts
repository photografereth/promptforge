import { windowStart } from './window.js';
import { IP_RATE_LIMIT, type IpRateLimitRepo } from './types.js';

// Falha fechada: qualquer erro ao incrementar o contador nunca libera a requisição.
export async function decideIpRateLimit(
  repo: IpRateLimitRepo,
  ip: string,
  now: Date
): Promise<'ok' | 'limited' | 'error'> {
  try {
    const bucket = windowStart(now).toISOString();
    const count = await repo.incrementAndGetCount(ip, bucket);
    return count <= IP_RATE_LIMIT ? 'ok' : 'limited';
  } catch (err) {
    console.error('Aviso: falha ao verificar rate limit por IP:', ip, err);
    return 'error';
  }
}
