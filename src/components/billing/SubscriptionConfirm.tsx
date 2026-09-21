import { useEffect, useState } from 'react';

interface SubscriptionConfirmProps {
  hasAccess: boolean;
  refresh: () => Promise<void>;
  onDone: () => void;
}

const POLL_MS = 3000;
const MAX_ATTEMPTS = 10;

// O acesso só é liberado quando o webhook do Mercado Pago confirma o pagamento:
// aqui apenas aguardamos (polling do estado vindo do backend).
export function SubscriptionConfirm({ hasAccess, refresh, onDone }: SubscriptionConfirmProps) {
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (hasAccess) onDone();
  }, [hasAccess, onDone]);

  useEffect(() => {
    if (hasAccess || attempts >= MAX_ATTEMPTS) return;
    const timer = setTimeout(async () => {
      await refresh();
      setAttempts((a) => a + 1);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [hasAccess, attempts, refresh]);

  const timedOut = attempts >= MAX_ATTEMPTS && !hasAccess;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">
        {timedOut ? 'Ainda estamos confirmando seu pagamento' : 'Confirmando seu pagamento...'}
      </h1>
      <p className="max-w-md text-sm text-neutral-400">
        {timedOut
          ? 'A confirmação pode levar alguns minutos. Você pode verificar novamente agora ou atualizar a página mais tarde.'
          : 'Isso costuma levar poucos segundos. Não feche esta página.'}
      </p>
      {timedOut && (
        <button
          type="button"
          onClick={() => setAttempts(0)}
          className="px-4 py-2 rounded-lg bg-amber-500 text-neutral-950 text-sm font-semibold hover:bg-amber-400 cursor-pointer"
        >
          Verificar novamente
        </button>
      )}
    </div>
  );
}
