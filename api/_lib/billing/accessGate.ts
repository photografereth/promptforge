import { hasAccess } from './access';
import type { BillingRepo } from './types';

// Falha fechada: qualquer erro ao consultar o banco nunca libera acesso.
export async function decideAccess(repo: BillingRepo, userId: string, now: Date): Promise<'ok' | 'denied' | 'error'> {
  try {
    return hasAccess(await repo.getByUser(userId), now) ? 'ok' : 'denied';
  } catch {
    return 'error';
  }
}
