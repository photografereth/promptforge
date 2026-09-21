export function BillingLoading() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-sm text-neutral-400">
      Carregando sua assinatura...
    </div>
  );
}

interface BillingLoadErrorProps {
  message: string | null;
  onRetry: () => void;
  onLogout: () => void;
}

export function BillingLoadError({ message, onRetry, onLogout }: BillingLoadErrorProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4 px-4">
      <p role="alert" className="text-sm text-red-400 text-center max-w-md">
        {message ?? 'Não foi possível carregar sua assinatura.'}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-amber-500 text-neutral-950 text-sm font-semibold hover:bg-amber-400 cursor-pointer"
        >
          Tentar novamente
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 cursor-pointer"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
