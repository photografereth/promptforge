import { formatDate } from '../../utils/format';

interface GraceBannerProps {
  graceUntil?: string | null;
  onUpdateCard: () => void;
}

export function GraceBanner({ graceUntil, onUpdateCard }: GraceBannerProps) {
  return (
    <div role="alert" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <span>
          Não conseguimos cobrar seu cartão. Atualize até <strong>{formatDate(graceUntil)}</strong> para não perder o
          acesso.
        </span>
        <button
          type="button"
          onClick={onUpdateCard}
          className="rounded-lg bg-amber-500 px-3 py-1 font-semibold text-neutral-950 hover:bg-amber-400 cursor-pointer"
        >
          Atualizar cartão
        </button>
      </div>
    </div>
  );
}
