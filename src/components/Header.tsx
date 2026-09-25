import React from 'react';
import { Settings, Library, Clapperboard, CreditCard, Lock } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenLanding?: () => void;
  hasAutoPreferences: boolean;
  userEmail?: string;
  onLogout?: () => void;
  onOpenSubscription?: () => void;
  brandSlot?: React.ReactNode;
  memoryLocked?: boolean; // visitante sem assinatura: Biblioteca e Kit abrem a assinatura
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenHistory,
  onOpenLanding,
  hasAutoPreferences,
  userEmail,
  onLogout,
  onOpenSubscription,
  brandSlot,
  memoryLocked = false,
}) => {
  return (
    <header className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 p-0.5 shadow-lg shadow-amber-950/40 flex items-center justify-center">
            <div className="h-full w-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
              <Clapperboard className="w-5 h-5 text-amber-400" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold font-display tracking-tight text-neutral-100 flex items-center gap-2">
                Flow Prompt Forge
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                Google Flow
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-normal hidden sm:block">
              Forja de prompts para Omni 1.1 Flash & Veo (vídeos até 10s) e Nano Banana (imagem)
            </p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {userEmail && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-neutral-800/50 border border-neutral-700/60">
              <span className="text-neutral-400 truncate max-w-[140px]">{userEmail}</span>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-neutral-500 hover:text-red-400 uppercase font-mono text-[10px] cursor-pointer"
                >
                  Sair
                </button>
              )}
            </div>
          )}
          {onOpenSubscription && (
            <button
              type="button"
              onClick={onOpenSubscription}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-200 bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700/60 hover:border-neutral-600 transition-all cursor-pointer"
              title="Gerenciar minha assinatura"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Minha assinatura</span>
            </button>
          )}
          {onOpenLanding && (
            <button
              type="button"
              onClick={onOpenLanding}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer"
              title="Ver Landing Page e Planos de Assinatura"
            >
              Planos & Assinatura
            </button>
          )}

          {brandSlot}

          {/* Library button */}
          <button
            id="btn-open-history"
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700/60 hover:border-neutral-600 transition-all cursor-pointer"
            title={memoryLocked ? 'Assine para salvar produtos, criadoras e prompts na nuvem' : 'Biblioteca de prompts da marca'}
          >
            {memoryLocked ? <Lock className="w-3.5 h-3.5 text-neutral-500" /> : <Library className="w-3.5 h-3.5 text-neutral-400" />}
            <span className="hidden md:inline">Biblioteca</span>
          </button>

          {/* Preferences gear button */}
          <button
            id="btn-open-settings"
            type="button"
            onClick={onOpenSettings}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700/60 hover:border-neutral-600 transition-all cursor-pointer"
            title={memoryLocked ? 'Assine para salvar o kit da sua marca' : 'Kit da marca (padrões visuais)'}
          >
            {memoryLocked ? <Lock className="w-4 h-4 text-neutral-500" /> : <Settings className="w-4 h-4 text-amber-400" />}
            <span className="hidden md:inline">Kit da marca</span>
            {hasAutoPreferences && (
              <span
                className="w-2 h-2 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5 shadow-sm shadow-amber-400/80"
                title="Padrões automáticos ativos"
              />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
