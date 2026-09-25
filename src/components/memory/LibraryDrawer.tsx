import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, Star, Trash2, Copy, Check, ArrowUpRight, Library, Clapperboard, Image as ImageIcon } from 'lucide-react';
import { memoryApi } from '../../lib/memoryApi';
import type { LibraryPrompt } from '../../lib/memory/types';

interface LibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  brandId: string;
  brandName: string;
  onOpenPrompt: (prompt: LibraryPrompt) => void;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const LibraryDrawer: React.FC<LibraryDrawerProps> = ({ isOpen, onClose, brandId, brandName, onOpenPrompt }) => {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [items, setItems] = useState<LibraryPrompt[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (reset: boolean, fromCursor: string | null) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await memoryApi.listPrompts(brandId, { q: debounced, favorite: onlyFavorites, cursor: reset ? null : fromCursor });
        if (id !== requestId.current) return; // resposta de uma busca antiga
        setItems((prev) => (reset ? res.prompts : [...prev, ...res.prompts]));
        setCursor(res.nextCursor);
      } catch {
        if (id === requestId.current) setError('Não foi possível carregar a biblioteca. Tente novamente.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [brandId, debounced, onlyFavorites]
  );

  useEffect(() => {
    if (isOpen) void load(true, null);
  }, [isOpen, load]);

  useEffect(() => {
    const el = sentinel.current;
    // Depois de um erro não carrega sozinho de novo (senão repetiria em loop); o usuário usa "Tentar de novo".
    if (!el || !cursor || error) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading) void load(false, cursor);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loading, load, error]);

  if (!isOpen) return null;

  const toggleFavorite = async (item: LibraryPrompt) => {
    try {
      const { prompt } = await memoryApi.setFavorite(item.id, !item.favorite);
      setItems((prev) =>
        onlyFavorites && !prompt.favorite ? prev.filter((p) => p.id !== prompt.id) : prev.map((p) => (p.id === prompt.id ? prompt : p))
      );
    } catch {
      setError('Não foi possível atualizar o favorito.');
    }
  };

  const remove = async (item: LibraryPrompt) => {
    try {
      await memoryApi.deletePrompt(item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
    } catch {
      setError('Não foi possível apagar o prompt.');
    }
  };

  const copy = async (item: LibraryPrompt) => {
    try {
      await navigator.clipboard.writeText(item.enhancedPrompt || item.deterministicPrompt);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setError('Não foi possível copiar.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border-l border-neutral-800 h-full flex flex-col shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2 min-w-0">
            <Library className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-base font-bold text-neutral-100 font-display truncate">Biblioteca · {brandName}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 cursor-pointer" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-neutral-800 flex gap-2">
          <label className="flex-1 flex items-center gap-2 px-2 rounded-lg bg-neutral-950 border border-neutral-800">
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <input
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título ou produto"
              className="flex-1 bg-transparent py-1.5 text-xs text-neutral-100 outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            className={`flex items-center gap-1 px-2 rounded-lg text-xs border cursor-pointer ${
              onlyFavorites ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : 'border-neutral-800 text-neutral-400'
            }`}
          >
            <Star className="w-3.5 h-3.5" /> Favoritos
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {error && (
            <p className="text-xs text-red-300 flex items-center gap-2">
              {error}
              <button
                type="button"
                onClick={() => void load(items.length === 0, items.length === 0 ? null : cursor)}
                className="underline text-red-200 cursor-pointer"
              >
                Tentar de novo
              </button>
            </p>
          )}
          {!loading && items.length === 0 && !error && (
            <p className="text-xs text-neutral-500 p-3">
              {debounced || onlyFavorites ? 'Nada encontrado.' : 'Os prompts gerados nesta marca aparecem aqui.'}
            </p>
          )}
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-100 truncate">{item.title}</p>
                  <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                    {item.mode === 'video' ? <Clapperboard className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <button type="button" onClick={() => void toggleFavorite(item)} className="p-1 cursor-pointer" title="Favorito">
                  <Star className={`w-4 h-4 ${item.favorite ? 'text-amber-400 fill-amber-400' : 'text-neutral-600'}`} />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenPrompt(item);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> Reabrir
                </button>
                <button type="button" onClick={() => void copy(item)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-neutral-300 hover:bg-neutral-800 cursor-pointer">
                  {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                </button>
                <button
                  type="button"
                  onClick={() => (confirmDelete === item.id ? void remove(item) : setConfirmDelete(item.id))}
                  className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-red-300 hover:bg-red-950/40 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {confirmDelete === item.id ? 'Apagar?' : ''}
                </button>
              </div>
            </div>
          ))}
          {loading && <p className="text-xs text-neutral-500 p-2">Carregando…</p>}
          <div ref={sentinel} />
        </div>
      </div>
    </div>
  );
};
