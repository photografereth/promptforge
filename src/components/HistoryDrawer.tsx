import React from 'react';
import { X, Trash2, ArrowUpRight, Copy, Check, Clock, Clapperboard, Image as ImageIcon } from 'lucide-react';
import { PromptHistoryItem } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: PromptHistoryItem[];
  onLoadItem: (item: PromptHistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onLoadItem,
  onDeleteItem,
  onClearHistory,
}) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-neutral-900 border-l border-neutral-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-neutral-100 font-display">
              Últimos Prompts (Histórico)
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
              {history.length}/10
            </span>
          </div>

          <button
            id="btn-close-history"
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-neutral-500 gap-2">
              <Clock className="w-8 h-8 text-neutral-700" />
              <p className="text-xs">Nenhum prompt salvo ainda.</p>
              <p className="text-[11px] text-neutral-600">
                Gere seu primeiro prompt e ele será arquivado aqui automaticamente.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-neutral-950 rounded-xl p-3.5 border border-neutral-800/90 hover:border-neutral-700 transition-all space-y-2.5"
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.mode === 'video'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                      }`}
                    >
                      {item.mode === 'video' ? '🎬 Vídeo' : '🖼️ Imagem'}
                    </span>
                    <span className="text-neutral-500">{formatDate(item.timestamp)}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(item.id, item.deterministicPrompt)}
                      className="p-1 text-neutral-400 hover:text-amber-300 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Copiar prompt"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1 text-neutral-500 hover:text-red-400 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Excluir este item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Snippet */}
                <p className="text-xs text-neutral-300 line-clamp-3 font-mono leading-relaxed bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-850">
                  {item.deterministicPrompt}
                </p>

                {/* Load button */}
                <button
                  type="button"
                  onClick={() => {
                    onLoadItem(item);
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 rounded-lg transition-all cursor-pointer font-medium"
                >
                  <span>Reabrir e editar no formulário</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">
              Mantém até 10 prompts recentes
            </span>
            <button
              id="btn-clear-all-history"
              type="button"
              onClick={onClearHistory}
              className="text-xs text-neutral-400 hover:text-red-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar histórico</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
