import React from 'react';
import type { MemoryApiError } from '../../lib/memoryApi';

interface MemoryLimitModalProps {
  error: MemoryApiError | null;
  onClose: () => void;
}

const HINT: Record<string, string> = {
  brands: 'Apague uma marca que não usa mais. Em breve teremos um plano para criadores e agências com mais marcas.',
  pinnedAssets: 'Desafixe algum item desta marca para liberar espaço.',
  photos: 'Remova alguma foto deste item antes de adicionar outra.',
};

export const MemoryLimitModal: React.FC<MemoryLimitModalProps> = ({ error, onClose }) => {
  if (!error) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl space-y-3">
        <h3 className="text-base font-bold text-neutral-100 font-display">Limite do seu plano</h3>
        <p className="text-sm text-neutral-300">{error.message}</p>
        {error.limit && <p className="text-xs text-neutral-400">{HINT[error.limit]}</p>}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-neutral-950 hover:bg-amber-400 cursor-pointer"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
