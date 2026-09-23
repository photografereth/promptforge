import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedUser } from '../auth.js';
import { decideQuota } from '../quota/decideQuota.js';
import { createSupabaseUsageRepo } from '../quota/usageRepo.js';
import { nextMidnightSaoPaulo } from '../quota/timezone.js';
import type { UsageRepo } from '../quota/types.js';

// Chamar logo após `requireActiveSubscription`: `if (!(await requireQuota(user, res))) return;`
export async function requireQuota(
  user: AuthenticatedUser,
  res: VercelResponse,
  repo: UsageRepo = createSupabaseUsageRepo(),
  now: Date = new Date()
): Promise<boolean> {
  const decision = await decideQuota(repo, user.id, now);
  if (decision === 'ok') return true;
  if (decision === 'exceeded') {
    res.status(429).json({
      error: 'Limite diário de gerações atingido. Volta à meia-noite.',
      code: 'quota_exceeded',
      resetAt: nextMidnightSaoPaulo(now).toISOString(),
    });
  } else {
    res.status(503).json({ error: 'Não foi possível verificar sua cota de uso. Tente novamente.' });
  }
  return false;
}
