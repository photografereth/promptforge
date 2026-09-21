import { PLANS } from '../../plans';
import { checkWithdraw } from '../access';
import { emails } from '../mailer';
import type { Subscription } from '../types';
import {
  canceledState,
  cancelPreapproval,
  fail,
  guard,
  idemKey,
  MP_ERROR,
  ok,
  safeSend,
  type Deps,
  type Result,
  type User,
} from './context';

const HOUR = 3_600_000;

const MESSAGES = {
  not_active: 'Você não tem uma assinatura ativa para exercer o arrependimento.',
  no_charge: 'Ainda não há uma cobrança confirmada para reembolsar.',
  already_refunded: 'O reembolso desta assinatura já foi realizado.',
  expired: 'O prazo de 7 dias para arrependimento já passou.',
} as const;

export async function withdraw(deps: Deps, user: User): Promise<Result> {
  const limited = await guard(deps, user.id, 'withdraw', 3, HOUR);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  const check = checkWithdraw(sub, deps.now());
  if (check.ok === false) return fail(409, MESSAGES[check.reason], { reason: check.reason });

  const current = sub as Subscription;
  const paymentId = current.first_payment_id as string;

  // Reembolsa primeiro: se falhar, nada muda (nunca cancelamos sem reembolsar).
  try {
    await deps.mp.refundPayment(paymentId, idemKey(user.id, 'withdraw', paymentId));
  } catch {
    return fail(502, MP_ERROR);
  }

  const next: Subscription = { ...canceledState(current), refunded_at: deps.now().toISOString() };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'withdraw',
    before: current,
    after: next,
    mp_id: paymentId,
  });

  // Se o cancelamento no MP falhar, o dinheiro já voltou e o acesso já foi revogado:
  // o cron de reconciliação cancela a preapproval remanescente.
  try {
    await cancelPreapproval(deps, current, 'withdraw-cancel');
  } catch {
    await deps.repo.recordEvent({
      user_id: user.id,
      actor: 'system',
      action: 'withdraw.cancel_failed',
      mp_id: current.mp_preapproval_id,
    });
  }

  await safeSend(deps, user.id, emails.refundDone({ amount: PLANS[current.plan].amount }));
  return ok({ status: 'canceled' });
}
