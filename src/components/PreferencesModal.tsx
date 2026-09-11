import React, { useState } from 'react';
import { X, Check, Sliders, Palette, Camera, Sparkles, RotateCcw } from 'lucide-react';
import { UserPreferences } from '../types';
import { VISUAL_STYLES, VIDEO_LENSES, VIDEO_FRAMINGS } from '../data/options';

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onSavePreferences: (prefs: UserPreferences) => void;
  onApplyToCurrent: () => void;
}

export const PreferencesModal: React.FC<PreferencesModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onSavePreferences,
  onApplyToCurrent,
}) => {
  const [localPrefs, setLocalPrefs] = useState<UserPreferences>({ ...preferences });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSavePreferences(localPrefs);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleReset = () => {
    const defaultPrefs: UserPreferences = {
      autoApply: false,
      preferredStyle: '',
      preferredPalette: '',
      preferredCamera: '',
    };
    setLocalPrefs(defaultPrefs);
    onSavePreferences(defaultPrefs);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-850 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Sliders className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100 font-display">
                Meus padrões visuais
              </h3>
              <p className="text-xs text-neutral-400">
                Guarde suas preferências autorais para não repetir configurações
              </p>
            </div>
          </div>

          <button
            id="btn-close-preferences"
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Estilo visual preferido */}
          <div>
            <label htmlFor="pref-style" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
              <span>Estilo visual preferido</span>
            </label>
            <input
              id="pref-style"
              type="text"
              value={localPrefs.preferredStyle}
              onChange={(e) =>
                setLocalPrefs({ ...localPrefs, preferredStyle: e.target.value })
              }
              placeholder="ex.: Filme 35mm granulado com estética nostálgica"
              className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 outline-none"
            />
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {['Filme 35mm granulado', 'Cinematográfico realista', 'Editorial/revista', 'Documentário'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setLocalPrefs({ ...localPrefs, preferredStyle: st })}
                  className="text-[11px] text-neutral-400 hover:text-amber-300 bg-neutral-950 px-2 py-0.5 rounded-md border border-neutral-800 transition-colors cursor-pointer"
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Paleta de cores preferida */}
          <div>
            <label htmlFor="pref-palette" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
              <Palette className="w-3.5 h-3.5 text-amber-400/80" />
              <span>Paleta de cores preferida</span>
            </label>
            <input
              id="pref-palette"
              type="text"
              value={localPrefs.preferredPalette}
              onChange={(e) =>
                setLocalPrefs({ ...localPrefs, preferredPalette: e.target.value })
              }
              placeholder="ex.: tons quentes âmbar, dourado e sombras ciano frias"
              className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 outline-none"
            />
          </div>

          {/* Lente / Câmera preferida */}
          <div>
            <label htmlFor="pref-camera" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
              <Camera className="w-3.5 h-3.5 text-amber-400/80" />
              <span>Lente / câmera preferida</span>
            </label>
            <input
              id="pref-camera"
              type="text"
              value={localPrefs.preferredCamera}
              onChange={(e) =>
                setLocalPrefs({ ...localPrefs, preferredCamera: e.target.value })
              }
              placeholder="ex.: Profundidade de campo rasa (bokeh suave e óptico)"
              className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 outline-none"
            />
          </div>

          {/* Checkbox: Aplicar automaticamente */}
          <div className="pt-3 border-t border-neutral-800">
            <label className="flex items-start gap-3 p-3 rounded-xl bg-neutral-950/70 border border-neutral-800/80 cursor-pointer hover:border-amber-500/30 transition-colors">
              <input
                id="checkbox-auto-apply"
                type="checkbox"
                checked={localPrefs.autoApply}
                onChange={(e) =>
                  setLocalPrefs({ ...localPrefs, autoApply: e.target.checked })
                }
                className="mt-0.5 rounded text-amber-500 focus:ring-amber-500/50 bg-neutral-900 border-neutral-700"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-neutral-200 block">
                  Aplicar meus padrões automaticamente
                </span>
                <span className="text-[11px] text-neutral-400 block leading-normal">
                  Quando ativo, estes valores pré-preenchem os campos correspondentes em todo novo prompt ou ao limpar o formulário.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between gap-2">
          <button
            id="btn-reset-preferences"
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 px-3 py-2 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Redefinir</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              id="btn-apply-to-current"
              type="button"
              onClick={() => {
                onSavePreferences(localPrefs);
                onApplyToCurrent();
                onClose();
              }}
              className="text-xs text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-3 py-2 rounded-xl transition-all cursor-pointer font-medium"
            >
              Aplicar agora na tela
            </button>

            <button
              id="btn-save-preferences"
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 text-xs font-bold text-neutral-950 bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvo!</span>
                </>
              ) : (
                <span>Salvar padrões</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
