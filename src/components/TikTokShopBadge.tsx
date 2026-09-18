import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, ShoppingBag, Eye, Film, Info, X } from 'lucide-react';

interface TikTokShopBadgeProps {
  safeZoneActive: boolean;
  ultraRealistaActive: boolean;
  onToggleSafeZone?: () => void;
}

export const TikTokShopBadge: React.FC<TikTokShopBadgeProps> = ({
  safeZoneActive,
  ultraRealistaActive,
}) => {
  const [showPoliciesModal, setShowPoliciesModal] = useState<boolean>(false);

  return (
    <>
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/20 to-teal-500/20 border border-neutral-700 flex items-center justify-center text-neutral-200 shrink-0">
            <ShoppingBag className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                Blindagem para Políticas do TikTok Shop
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Anti-Rejeição Ativo
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Safe Zone 9:16 (Carrinho livre)
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Sem claims médicos/falsos
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                Vídeo Ultra Realista Padronizado
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPoliciesModal(true)}
          className="text-xs text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-auto sm:ml-0"
        >
          <Info className="w-3.5 h-3.5" />
          Ver Regras Ativas
        </button>
      </div>

      {/* Modal de Regras TikTok Shop */}
      {showPoliciesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl relative text-neutral-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-neutral-100">
                  Diretrizes TikTok Shop Incorporadas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPoliciesModal(false)}
                className="text-neutral-400 hover:text-neutral-100 p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-neutral-300">
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <h4 className="font-semibold text-neutral-100 flex items-center gap-1.5 mb-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  1. Proteção contra Rejeição de Anúncios e Conteúdo
                </h4>
                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  O TikTok Shop proíbe expressamente alegações de cura definitiva, promessas irreais de perda de peso, antes e depois manipulados ou promessas de ganhos financeiros rápidos. Nossos prompts forçam demonstração sensorial autêntica e descritiva.
                </p>
              </div>

              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <h4 className="font-semibold text-neutral-100 flex items-center gap-1.5 mb-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  2. Safe Zone 9:16 Vertical Rigorosa
                </h4>
                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  O rodapé e canto inferior esquerdo (onde aparece o ícone do carrinho amarelo / sacola do TikTok Shop) e a lateral direita (botões de curtir, comentar e compartilhar) são mantidos livres de elementos e textos vitais nos prompts gerados.
                </p>
              </div>

              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                <h4 className="font-semibold text-neutral-100 flex items-center gap-1.5 mb-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  3. Padrão "Vídeo Ultra Realista" (Até 10s)
                </h4>
                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  Calibrado para modelos de vídeo como Omni 1.1 Flash e Veo com ênfase em texturas táteis reais, microporos de pele, iluminação física e ausência de distorções de inteligência artificial ou look plástico de animação digital 3D.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPoliciesModal(false)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
