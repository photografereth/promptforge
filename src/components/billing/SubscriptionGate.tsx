import { useEffect, useState } from 'react';
import { PLAN_INFO } from '../../data/plans';
import { billingApi, type PlanId } from '../../lib/billingApi';
import { CardBrickForm } from './CardBrickForm';

interface SubscriptionGateProps {
  onSubscribed: () => void;
  onLogout: () => void;
  wasCanceled: boolean;
}

export function SubscriptionGate({ onSubscribed, onLogout, wasCanceled }: SubscriptionGateProps) {
  const [plan, setPlan] = useState<PlanId>('annual');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    billingApi
      .config()
      .then((c) => setPublicKey(c.publicKey))
      .catch(() => setError('Pagamentos indisponíveis no momento. Tente novamente em instantes.'));
  }, []);

  const handleToken = async (token: string) => {
    setError(null);
    try {
      await billingApi.subscribe(plan, token);
      onSubscribed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir a assinatura.');
      throw e; // o Brick também exibe o erro no formulário
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center px-4 py-10 font-sans">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
          Assine para liberar o Flow Prompt Forge
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          {wasCanceled
            ? 'Sua assinatura anterior foi encerrada. Escolha um plano para voltar a usar.'
            : 'Escolha seu plano e comece a gerar prompts profissionais agora mesmo.'}
        </p>

        <div role="radiogroup" aria-label="Plano" className="mt-6 grid gap-4 sm:grid-cols-2">
          {(Object.keys(PLAN_INFO) as PlanId[]).map((id) => {
            const info = PLAN_INFO[id];
            const selected = plan === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPlan(id)}
                className={`text-left rounded-2xl border p-5 transition-all cursor-pointer ${
                  selected
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-600'
                }`}
              >
                <div className="text-sm font-semibold text-amber-400">{info.label}</div>
                <div className="mt-1 text-2xl font-bold">
                  {info.priceLabel} <span className="text-sm font-normal text-neutral-400">{info.period}</span>
                </div>
                <p className="mt-2 text-xs text-neutral-400">{info.note}</p>
              </button>
            );
          })}
        </div>

        <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold text-neutral-200">Dados do cartão</h2>
          {error && (
            <p role="alert" className="mb-3 text-sm text-red-400">
              {error}
            </p>
          )}
          {publicKey ? (
            // A key remonta o Brick ao trocar de plano (o valor inicial do Brick é fixo).
            <div key={plan}>
              <CardBrickForm amount={PLAN_INFO[plan].price} publicKey={publicKey} onToken={handleToken} />
            </div>
          ) : (
            !error && <p className="text-sm text-neutral-400">Carregando formulário de pagamento...</p>
          )}
        </section>

        <p className="mt-4 text-xs text-neutral-500">
          Garantia de 7 dias: cancele em até 7 dias da primeira cobrança e receba o reembolso total, direto pelo app.
          Pagamento processado pelo Mercado Pago; os dados do cartão não passam pelos nossos servidores.
        </p>

        <button
          type="button"
          onClick={onLogout}
          className="mt-6 text-xs text-neutral-400 underline hover:text-neutral-200 cursor-pointer"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
