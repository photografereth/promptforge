import React, { useState } from 'react';
import { ChevronDown, Pin, PinOff, Trash2, Package, User } from 'lucide-react';
import type { AssetKind, MemoryAsset } from '../../lib/memory/types';

interface AssetPickerProps {
  kind: AssetKind;
  label: string;
  assets: MemoryAsset[];
  onSelect: (asset: MemoryAsset) => void;
  onTogglePin: (asset: MemoryAsset) => void;
  onDelete: (asset: MemoryAsset) => void;
  onImagesExpired: () => void; // links assinados valem 1h
}

export const AssetPicker: React.FC<AssetPickerProps> = ({
  kind,
  label,
  assets,
  onSelect,
  onTogglePin,
  onDelete,
  onImagesExpired,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'pinned' | 'recent'>('pinned');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const ofKind = assets.filter((a) => a.kind === kind);
  const pinned = ofKind.filter((a) => a.pinned);
  const recent = ofKind.filter((a) => !a.pinned);
  const shown = tab === 'pinned' ? pinned : recent;
  const Icon = kind === 'product' ? Package : User;

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setTab(pinned.length > 0 ? 'pinned' : 'recent');
        }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-neutral-200 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-amber-400" />
          {label}: escolher
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-2 z-30 rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl p-2">
          <div className="flex gap-1 mb-2">
            {(['pinned', 'recent'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  tab === t ? 'bg-amber-500/15 text-amber-300' : 'text-neutral-400 hover:bg-neutral-800'
                }`}
              >
                {t === 'pinned' ? `Fixados (${pinned.length})` : `Recentes (${recent.length})`}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="px-2 py-3 text-[11px] text-neutral-500">
              {tab === 'pinned'
                ? 'Nada fixado ainda. Fixe um item dos Recentes com o alfinete.'
                : 'Os itens usados ao gerar um prompt aparecem aqui.'}
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto space-y-1">
              {shown.map((asset) => (
                <li key={asset.id} className="flex items-center gap-2 rounded-lg hover:bg-neutral-800 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(asset);
                      setOpen(false);
                    }}
                    className="flex-1 flex items-center gap-2 py-1.5 text-left min-w-0 cursor-pointer"
                  >
                    {asset.photos[0]?.url ? (
                      <img
                        src={asset.photos[0].url}
                        alt=""
                        onError={onImagesExpired}
                        className="w-8 h-8 rounded-md object-cover bg-neutral-800 shrink-0"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-md bg-neutral-800 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-neutral-500" />
                      </span>
                    )}
                    <span className="text-xs text-neutral-200 truncate">{asset.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTogglePin(asset)}
                    className="p-1 text-neutral-400 hover:text-amber-300 cursor-pointer"
                    title={asset.pinned ? 'Desafixar' : 'Fixar'}
                  >
                    {asset.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDelete === asset.id) {
                        onDelete(asset);
                        setConfirmDelete(null);
                      } else {
                        setConfirmDelete(asset.id);
                      }
                    }}
                    className="p-1 text-neutral-500 hover:text-red-300 cursor-pointer text-[10px]"
                    title="Apagar"
                  >
                    {confirmDelete === asset.id ? 'Apagar?' : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
