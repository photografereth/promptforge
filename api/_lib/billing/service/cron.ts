import { addDays } from '../access';
import { emails } from '../mailer';
import type { Subscription } from '../types';
import { canceledState, cancelPreapproval, safeSend, type Deps } from './context';

export interface CronSummary {
  canceledAtPeriodEnd: number;
  graceExpired: number;
  reconciled: number;
  errors: number;
}

// Canceladas recentemente continuam na reconciliação para corrigir um cancelamento
// que falhou no MP (ex.: arrependimento com reembolso já concluído).
const RECENT_CANCEL_DAYS = 3;

async function cancelEverywhere(deps: Deps, sub: Subscription, tag: string, action: string): Promise<void> {
  await cancelPreapproval(deps, sub, tag);
  const next = canceledState(sub);
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: sub.user_id,
    actor: 'cron',
    action,
    before: sub,
    after: next,
    mp_id: sub.mp_preapproval_id,
  });
  await safeSend(deps, sub.user_id, emails.subscriptionCanceled({ accessUntil: null }));
}

// Retorna true se corrigiu alguma divergência entre o banco e o MP.
async function reconcile(deps: Deps, sub: Subscription): Promise<boolean> {
  if (!sub.mp_preapproval_id) return false;
  const pre = await deps.mp.getPreapproval(sub.mp_preapproval_id);

  if (sub.status === 'canceled') {
    if (pre.status === 'cancelled') return false;
    await cancelPreapproval(deps, sub, 'reconcile-cancel');
    await deps.repo.recordEvent({
      user_id: sub.user_id,
      actor: 'cron',
      action: 'reconcile.cancel_in_mp',
      mp_id: sub.mp_preapproval_id,
    });
    return true;
  }

  if (pre.status === 'cancelled') {
    const next = canceledState(sub);
    await deps.repo.save(next);
    await deps.repo.recordEvent({
      user_id: sub.user_id,
      actor: 'cron',
      action: 'reconcile.local_canceled',
      before: sub,
      after: next,
      mp_id: sub.mp_preapproval_id,
    });
    await safeSend(deps, sub.user_id, emails.subscriptionCanceled({ accessUntil: null }));
    return true;
  }

  if (sub.status === 'pending' && pre.status === 'authorized') {
    const next: Subscription = { ...sub, status: 'active', current_period_end: pre.next_payment_date ?? sub.current_period_end };
    await deps.repo.save(next);
    await deps.repo.recordEvent({
      user_id: sub.user_id,
      actor: 'cron',
      action: 'reconcile.activated',
      before: sub,
      after: next,
      mp_id: sub.mp_preapproval_id,
    });
    return true;
  }

  return false;
}

export async function runBillingCron(deps: Deps): Promise<CronSummary> {
  const now = deps.now();
  const summary: CronSummary = { canceledAtPeriodEnd: 0, graceExpired: 0, reconciled: 0, errors: 0 };

  // Falha em um usuário é registrada e não interrompe o lote; tenta de novo no dia seguinte.
  const each = async (subs: Subscription[], work: (sub: Subscription) => Promise<void>) => {
    for (const sub of subs) {
      try {
        await work(sub);
      } catch {
        summary.errors++;
        await deps.repo
          .recordEvent({ user_id: sub.user_id, actor: 'cron', action: 'cron.error', mp_id: sub.mp_preapproval_id })
          .catch(() => {});
      }
    }
  };

  await each(await deps.repo.listCancellationsDue(now.toISOString()), async (sub) => {
    await cancelEverywhere(deps, sub, 'cron-cancel', 'cron.cancel_at_period_end');
    summary.canceledAtPeriodEnd++;
  });

  await each(await deps.repo.listGraceExpired(now.toISOString()), async (sub) => {
    await cancelEverywhere(deps, sub, 'cron-grace', 'cron.grace_expired');
    summary.graceExpired++;
  });

  await each(await deps.repo.listReconcilable(addDays(now, -RECENT_CANCEL_DAYS).toISOString()), async (sub) => {
    if (await reconcile(deps, sub)) summary.reconciled++;
  });

  return summary;
}
