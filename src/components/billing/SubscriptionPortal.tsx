import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { PLAN_INFO } from '../../data/plans';
import { billingApi, type BillingStatus, type Invoice, type PlanId } from '../../lib/billingApi';
import { formatBRL, formatDate } from '../../utils/format';
import { CardBrickForm } from './CardBrickForm';

interface SubscriptionPortalProps {
  isOpen: boolean;
  status: BillingStatus;
  startWithCard: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

const STATUS_LABEL: Record<BillingStatus['status'], string> = {
  none: 'Sem assinatura',
  pending: 'Confirmando pagamento',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
};

const INVOICE_LABEL: Record<Invoice['status'], string> = {
  paid: 'Paga',
  failed: 'Não aprovada',
  scheduled: 'Agendada',
};

const buttonBase =
  'rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
const primary = `${buttonBase} bg-amber-500 text-neutral-950 hover:bg-amber-400`;
const secondary = `${buttonBase} border border-neutral-700 text-neutral-200 hover:bg-neutral-800`;
const danger = `${buttonBase} bg-red-600 text-white hover:bg-red-500`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-neutral-800 pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">{title}</h3>
      {children}
    </section>
  );
}

export function SubscriptionPortal({ isOpen, status, startWithCard, onClose, onChanged }: SubscriptionPortalProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState<'cancel' | 'withdraw' | null>(null);
  const [showCard, setShowCard] = useState(startWithCard);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setShowCard(startWithCard);
    setConfirming(null);
    setMessage(null);
    billingApi
      .invoices()
      .then((r) => setInvoices(r.invoices))
      .catch(() => setInvoices([]));
  }, [isOpen, startWithCard]);

  useEffect(() => {
    if (!showCard || publicKey) return;
    billingApi
      .config()
      .then((c) => setPublicKey(c.publicKey))
      .catch(() => setMessage({ kind: 'error', text: 'Não foi possível carregar o formulário de cartão.' }));
  }, [showCard, publicKey]);

  const run = useCallback(
    async (successText: string, action: () => Promise<unknown>) => {
      setBusy(true);
      setMessage(null);
      try {
        await action();
        await onChanged();
        setMessage({ kind: 'ok', text: successText });
        setConfirming(null);
      } catch (e) {
        setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.' });
      } finally {
        setBusy(false);
      }
    },
    [onChanged]
  );

  const handleCardToken = async (token: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await billingApi.updateCard(token);
      await onChanged();
      setMessage({ kind: 'ok', text: 'Cartão atualizado. A próxima cobrança usará o novo cartão.' });
      setShowCard(false);
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Não foi possível atualizar o cartão.' });
      throw e; // o Brick também exibe o erro
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const plan: PlanId = status.plan ?? 'monthly';
  const otherPlan: PlanId = plan === 'monthly' ? 'annual' : 'monthly';
  const isActive = status.status === 'active';
  const canManage = isActive || status.status === 'past_due';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Minha assinatura"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Minha assinatura</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              message.kind === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {message.text}
          </p>
        )}

        <Section title="Resumo">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-400">Situação</dt>
              <dd>{STATUS_LABEL[status.status]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-400">Plano</dt>
              <dd>
                {PLAN_INFO[plan].label} · {PLAN_INFO[plan].priceLabel} {PLAN_INFO[plan].period}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-400">
                {status.cancelAtPeriodEnd ? 'Acesso até' : status.status === 'past_due' ? 'Carência até' : 'Próxima cobrança'}
              </dt>
              <dd>{formatDate(status.status === 'past_due' ? status.graceUntil : status.currentPeriodEnd)}</dd>
            </div>
          </dl>
        </Section>

        {isActive && !status.cancelAtPeriodEnd && (
          <Section title="Trocar de plano">
            {status.pendingPlan ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>
                  Seu plano mudará para <strong>{PLAN_INFO[status.pendingPlan].label}</strong> em{' '}
                  <strong>{formatDate(status.pendingPlanEffectiveAt)}</strong>.
                </span>
                <button type="button" disabled={busy} className={secondary} onClick={() => run('Troca desfeita.', billingApi.undoPlanChange)}>
                  Desfazer
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-neutral-300">
                  A mudança vale a partir da próxima renovação ({formatDate(status.currentPeriodEnd)}), sem cobrança extra agora.
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className={secondary}
                  onClick={() => run('Troca agendada para a próxima renovação.', () => billingApi.changePlan(otherPlan))}
                >
                  Mudar para {PLAN_INFO[otherPlan].label}
                </button>
              </div>
            )}
          </Section>
        )}

        {canManage && (
          <Section title="Cartão">
            {showCard ? (
              publicKey ? (
                <CardBrickForm amount={PLAN_INFO[plan].price} publicKey={publicKey} onToken={handleCardToken} />
              ) : (
                <p className="text-sm text-neutral-400">Carregando formulário...</p>
              )
            ) : (
              <button type="button" className={secondary} onClick={() => setShowCard(true)}>
                Trocar cartão
              </button>
            )}
          </Section>
        )}

        {canManage && (
          <Section title="Cancelamento">
            {status.cancelAtPeriodEnd ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Cancelamento agendado. Você tem acesso até {formatDate(status.currentPeriodEnd)}.</span>
                <button type="button" disabled={busy} className={primary} onClick={() => run('Assinatura retomada.', billingApi.resume)}>
                  Retomar
                </button>
              </div>
            ) : confirming === 'cancel' ? (
              <div className="space-y-2 text-sm">
                <p>
                  {isActive
                    ? `Você mantém o acesso até ${formatDate(status.currentPeriodEnd)}. Confirmar cancelamento?`
                    : 'O acesso será encerrado agora. Confirmar cancelamento?'}
                </p>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} className={danger} onClick={() => run('Cancelamento confirmado.', billingApi.cancel)}>
                    Confirmar cancelamento
                  </button>
                  <button type="button" disabled={busy} className={secondary} onClick={() => setConfirming(null)}>
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={secondary} onClick={() => setConfirming('cancel')}>
                Cancelar assinatura
              </button>
            )}
          </Section>
        )}

        {status.canWithdraw && (
          <Section title="Direito de arrependimento">
            <p className="text-sm text-neutral-300">
              Você pode desistir até <strong>{formatDate(status.withdrawDeadline)}</strong> e receber o reembolso total.
              O acesso é encerrado na hora.
            </p>
            {confirming === 'withdraw' ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className={danger}
                  onClick={() => run('Reembolso solicitado. O valor pode levar alguns dias para aparecer na fatura.', billingApi.withdraw)}
                >
                  Sim, cancelar e reembolsar
                </button>
                <button type="button" disabled={busy} className={secondary} onClick={() => setConfirming(null)}>
                  Voltar
                </button>
              </div>
            ) : (
              <button type="button" className={`${secondary} mt-2`} onClick={() => setConfirming('withdraw')}>
                Desistir e receber reembolso
              </button>
            )}
          </Section>
        )}

        <Section title="Faturas">
          {invoices === null ? (
            <p className="text-sm text-neutral-400">Carregando...</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhuma cobrança ainda.</p>
          ) : (
            <ul className="divide-y divide-neutral-800 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex justify-between py-1.5">
                  <span>{formatDate(inv.date)}</span>
                  <span>{formatBRL(inv.amount)}</span>
                  <span className="text-neutral-400">{INVOICE_LABEL[inv.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
