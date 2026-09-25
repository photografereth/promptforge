import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface Notice {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface MemoryNoticeProps {
  notice: Notice | null;
  onDismiss: () => void;
}

export const MemoryNotice: React.FC<MemoryNoticeProps> = ({ notice, onDismiss }) => {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-neutral-700 bg-neutral-900/95 px-4 py-3 text-xs text-neutral-200 shadow-2xl flex items-start gap-3">
      <span className="flex-1">{notice.message}</span>
      {notice.actionLabel && notice.onAction && (
        <button
          type="button"
          onClick={() => {
            notice.onAction?.();
            onDismiss();
          }}
          className="font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap cursor-pointer"
        >
          {notice.actionLabel}
        </button>
      )}
      <button type="button" onClick={onDismiss} className="text-neutral-500 hover:text-neutral-300 cursor-pointer" aria-label="Fechar aviso">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
