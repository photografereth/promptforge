import React from 'react';
import { AppMode } from '../types';
import { Video, Image as ImageIcon, Sparkles } from 'lucide-react';

interface ModeSelectorProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, onModeChange }) => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-2">
      <div className="bg-neutral-900/90 p-1.5 rounded-2xl border border-neutral-800 shadow-xl flex items-center gap-2">
        {/* Video Mode Tab */}
        <button
          id="tab-mode-video"
          type="button"
          onClick={() => onModeChange('video')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            mode === 'video'
              ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/15 to-amber-600/10 text-amber-300 border border-amber-500/40 shadow-inner'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 border border-transparent'
          }`}
        >
          <span className="text-lg leading-none">🎬</span>
          <span className="tracking-wide">Vídeo (Omni 1.1 Flash / Veo)</span>
          {mode === 'video' && (
            <span className="hidden sm:inline-block text-[11px] font-normal px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300/90 border border-amber-400/20">
              Até 10s • Câmera & Movimento
            </span>
          )}
        </button>

        {/* Image Mode Tab */}
        <button
          id="tab-mode-image"
          type="button"
          onClick={() => onModeChange('image')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            mode === 'image'
              ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/15 to-amber-600/10 text-amber-300 border border-amber-500/40 shadow-inner'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 border border-transparent'
          }`}
        >
          <span className="text-lg leading-none">🖼️</span>
          <span className="tracking-wide">Imagem (Nano Banana)</span>
          {mode === 'image' && (
            <span className="hidden sm:inline-block text-[11px] font-normal px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300/90 border border-amber-400/20">
              Linguagem Natural
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
