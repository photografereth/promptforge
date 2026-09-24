import type { VercelRequest, VercelResponse } from '@vercel/node';
import { decideIpRateLimit } from './decideIpRateLimit.js';
import { createSupabaseRepo } from './repo.js';
import { getClientIp } from './getClientIp.js';
import type { IpRateLimitRepo } from './types.js';
import { logError } from '../logging/logger.js';
import { errorName } from '../logging/errorName.js';
import { createSupabaseRepo as createSupabaseLogRepo } from '../logging/repo.js';
import type { LogRepo } from '../logging/types.js';

// Chamar como a PRIMEIRA linha do handler, antes de `authenticate`:
// `if (!(await requireIpRateLimit(req, res))) return;`
export async function requireIpRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  repo: IpRateLimitRepo = createSupabaseRepo(),
  now: Date = new Date(),
  logRepo: LogRepo = createSupabaseLogRepo()
): Promise<boolean> {
  const ip = getClientIp(req);
  let failure = 'unknown';
  const decision = await decideIpRateLimit(repo, ip, now, (err) => {
    failure = errorName(err);
  });
  if (decision === 'ok') return true;
  if (decision === 'limited') {
    res.status(429).json({
      error: 'Muitas requisições. Tente novamente em alguns minutos.',
      code: 'rate_limited',
    });
  } else {
    // Sem IP: dado pessoal (LGPD) e irrelevante pra uma falha do banco.
    await logError('ip_rate_limit_check_failed', { errorName: failure }, logRepo);
    res.status(503).json({ error: 'Não foi possível processar a requisição. Tente novamente.' });
  }
  return false;
}
