import React, { useState } from 'react';
import { ChevronDown, Check, Plus, Settings2, Trash2 } from 'lucide-react';
import { MemoryApiError } from '../../lib/memoryApi';
import type { BrandMemory } from '../../hooks/useBrandMemory';

interface BrandSwitcherProps {
  memory: BrandMemory;
  onLimit: (error: MemoryApiError) => void;
}

export const BrandSwitcher: React.FC<BrandSwitcherProps> = ({ memory, onLimit }) => {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof MemoryApiError && e.code === 'limit_reached') onLimit(e);
      else setError(e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.');
    }
  };

  if (memory.status === 'error') {
    return (
      <button
        type="button"
        onClick={() => void memory.reload()}
        className="px-3 py-1.5 rounded-lg text-xs text-red-300 bg-red-950/40 border border-red-800/60 cursor-pointer"
        title="Não foi possível carregar suas marcas"
      >
        Marcas indisponíveis · tentar de novo
      </button>
    );
  }
  if (!memory.currentBrand) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-100 bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700/60 cursor-pointer max-w-[180px]"
        title="Trocar de marca"
      >
        <span className="truncate">{memory.currentBrand.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl p-2 z-40 space-y-1">
          {memory.brands.map((brand) => (
            <button
              key={brand.id}
              type="button"
              onClick={() => {
                memory.selectBrand(brand.id);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-neutral-200 hover:bg-neutral-800 cursor-pointer"
            >
              <span className="truncate">{brand.name}</span>
              {brand.id === memory.currentBrand?.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
            </button>
          ))}
          <form
            className="flex gap-1 pt-1 border-t border-neutral-800"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newName.trim();
              if (!name) return;
              void run(async () => {
                await memory.createBrand(name);
                setNewName('');
                setOpen(false);
              });
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
              placeholder="Nova marca"
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100"
            />
            <button type="submit" className="px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 cursor-pointer" title="Criar marca">
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setManaging(true);
              setOpen(false);
            }}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-neutral-400 hover:bg-neutral-800 cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" /> Gerenciar marcas
          </button>
          {error && <p className="px-2 text-[11px] text-red-300">{error}</p>}
        </div>
      )}

      {managing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-bold text-neutral-100 font-display">Gerenciar marcas</h3>
            {memory.brands.map((brand) => (
              <div key={brand.id} className="flex items-center gap-2">
                {renaming?.id === brand.id ? (
                  <form
                    className="flex-1 flex gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await memory.renameBrand(brand.id, renaming.name.trim());
                        setRenaming(null);
                      });
                    }}
                  >
                    <input
                      autoFocus
                      value={renaming.name}
                      maxLength={80}
                      onChange={(e) => setRenaming({ id: brand.id, name: e.target.value })}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100"
                    />
                    <button type="submit" className="px-2 text-xs text-amber-400 cursor-pointer">Salvar</button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRenaming({ id: brand.id, name: brand.name })}
                    className="flex-1 text-left text-sm text-neutral-200 truncate cursor-pointer"
                    title="Renomear"
                  >
                    {brand.name}
                    {brand.isDefault && <span className="ml-2 text-[10px] text-neutral-500">padrão</span>}
                  </button>
                )}
                {memory.brands.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      confirmDelete === brand.id
                        ? void run(async () => {
                            await memory.deleteBrand(brand.id);
                            setConfirmDelete(null);
                          })
                        : setConfirmDelete(brand.id)
                    }
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-red-300 hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmDelete === brand.id ? 'Apagar tudo desta marca?' : ''}
                  </button>
                )}
              </div>
            ))}
            {error && <p className="text-[11px] text-red-300">{error}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setManaging(false);
                  setRenaming(null);
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-800 text-neutral-200 hover:bg-neutral-700 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
