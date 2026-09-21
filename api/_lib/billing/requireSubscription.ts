import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedUser } from '../auth.js';
import { decideAccess } from './accessGate.js';
import { createSupabaseRepo } from './repo.js';

// Chamar logo após `authenticate`: `if (!(await requireActiveSubscription(user, res))) return;`
export async function requireActiveSubscription(
  user: AuthenticatedUser,
  res: VercelResponse
): Promise<boolean> {
  const decision = await decideAccess(createSupabaseRepo(), user.id, new Date());
  if (decision === 'ok') return true;
  if (decision === 'denied') {
    res.status(403).json({ error: 'Assinatura necessária para usar este recurso.', code: 'subscription_required' });
  } else {
    res.status(503).json({ error: 'Não foi possível verificar sua assinatura. Tente novamente.' });
  }
  return false;
}
