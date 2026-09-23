import type { VercelRequest, VercelResponse } from '@vercel/node';
import { decideIpRateLimit } from './decideIpRateLimit.js';
import { createSupabaseRepo } from './repo.js';
import { getClientIp } from './getClientIp.js';
import type { IpRateLimitRepo } from './types.js';

// Chamar como a PRIMEIRA linha do handler, antes de `authenticate`:
// `if (!(await requireIpRateLimit(req, res))) return;`
export async function requireIpRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  repo: IpRateLimitRepo = createSupabaseRepo(),
  now: Date = new Date()
): Promise<boolean> {
  const ip = getClientIp(req);
  const decision = await decideIpRateLimit(repo, ip, now);
  if (decision === 'ok') return true;
  if (decision === 'limited') {
    res.status(429).json({
      error: 'Muitas requisições. Tente novamente em alguns minutos.',
      code: 'rate_limited',
    });
  } else {
    res.status(503).json({ error: 'Não foi possível processar a requisição. Tente novamente.' });
  }
  return false;
}
