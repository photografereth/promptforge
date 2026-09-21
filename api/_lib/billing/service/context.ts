import { createHash } from 'node:crypto';
import type { EmailMessage, Mailer } from '../mailer.js';
import type { MpClient } from '../mercadopago.js';
import type { BillingRepo, Subscription } from '../types.js';

export interface Deps {
  mp: MpClient;
  repo: BillingRepo;
  mailer: Mailer;
  now: () => Date;
  appUrl: string;
  publicKey: string;
}

export interface User {
  id: string;
  email: string;
}

export interface Result {
  status: number;
  body: Record<string, unknown>;
}

export const MP_ERROR = 'Não foi possível concluir a operação com o Mercado Pago. Tente novamente em instantes.';

export const ok = (body: Record<string, unknown> = {}): Result => ({ status: 200, body: { ok: true, ...body } });

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}): Result => ({
  status,
  body: { error, ...extra },
});

export function idemKey(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

// Rate limit por usuário e ação, contado na própria trilha de auditoria.
// Retorna um Result 429 quando estourou; senão registra a tentativa e retorna null.
export async function guard(
  deps: Deps,
  userId: string,
  name: string,
  limit: number,
  windowMs: number
): Promise<Result | null> {
  const action = `rl:${name}`;
  const since = new Date(deps.now().getTime() - windowMs).toISOString();
  const count = await deps.repo.countEvents(userId, action, since);
  if (count >= limit) return fail(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  await deps.repo.recordEvent({ user_id: userId, actor: 'user', action });
  return null;
}

// E-mail nunca desfaz a operação: falhas são registradas e engolidas.
export async function safeSend(deps: Deps, userId: string, message: EmailMessage): Promise<void> {
  try {
    const to = await deps.repo.getProfileEmail(userId);
    if (!to) return;
    await deps.mailer.send(to, message);
  } catch {
    await deps.repo.recordEvent({ user_id: userId, actor: 'system', action: 'email.failed' }).catch(() => {});
  }
}

// Estado terminal de uma assinatura cancelada (usado por cancelamento, arrependimento, cron e webhook).
export function canceledState(sub: Subscription): Subscription {
  return {
    ...sub,
    status: 'canceled',
    grace_until: null,
    cancel_at_period_end: false,
    pending_plan: null,
    pending_plan_effective_at: null,
  };
}

export function cancelPreapproval(deps: Deps, sub: Subscription, tag: string): Promise<unknown> {
  const id = sub.mp_preapproval_id as string;
  return deps.mp.updatePreapproval(id, { status: 'cancelled' }, idemKey(sub.user_id, tag, id));
}
