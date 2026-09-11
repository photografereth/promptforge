import React from 'react';
import { Sparkles, Loader2, Wand2, Lightbulb, ArrowDown, Bot, ShieldCheck } from 'lucide-react';
import { EXAMPLE_IDEAS } from '../data/options';
import { AppMode, AgentType, ProductAnchor } from '../types';

interface QuickFillSectionProps {
  idea: string;
  onIdeaChange: (val: string) => void;
  onAutofill: () => void;
  isLoading: boolean;
  mode: AppMode;
  agent: AgentType;
  product: ProductAnchor;
  onJumpToManual: () => void;
}

export const QuickFillSection: React.FC<QuickFillSectionProps> = ({
  idea,
  onIdeaChange,
  onAutofill,
  isLoading,
  mode,
  agent,
  product,
  onJumpToManual,
}) => {
  const getAgentLabel = () => {
    switch (agent) {
      case 'pov':
        return 'Agente POV (1ª Pessoa)';
      case 'ugc':
        return 'Agente UGC (Criador Autêntico)';
      case 'motion':
        return 'Agente Movimento (B-Roll Dinâmico)';
    }
  };

  const getPlaceholder = () => {
    if (product.nome) {
      return `Descreva a cena para o ${product.nome} (ex.: unboxing em close-up com luz de janela revelando o acabamento...)`;
    }
    if (agent === 'pov') {
      return 'Ex.: mãos abrindo o frasco do cosmético e aplicando na pele com textura sedosa e iluminação suave';
    }
    if (agent === 'ugc') {
      return 'Ex.: criador no quarto testando o produto e reagindo com entusiasmo genuíno nos primeiros 2 segundos';
    }
    return 'Ex.: produto girando em 360 graus com iluminação de estúdio comercial e slow-motion fluido';
  };

  return (
    <div className="bg-neutral-900/90 rounded-2xl p-4 sm:p-5 border border-neutral-800 shadow-xl relative overflow-hidden">
      {/* Subtle decorative glow */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-amber-500/5 blur-3xl pointer-events-none rounded-full" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <h2 className="text-sm font-semibold text-neutral-200 tracking-wide uppercase">
            Criar com {getAgentLabel()}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {product.nome ? (
            <span className="text-[11px] text-amber-300 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              Produto ancorado
            </span>
          ) : (
            <span className="text-[11px] text-neutral-400">
              {mode === 'video' ? 'Vídeo Ultra Realista (Veo 3)' : 'Foto Ultra Realista (Nano Banana)'}
            </span>
          )}
        </div>
      </div>

      <label htmlFor="input-quick-idea" className="block text-xs font-medium text-neutral-300 mb-1.5">
        Descreva sua ideia em 1-2 frases para o agente decompor para o TikTok Shop:
      </label>

      <div className="relative">
        <textarea
          id="input-quick-idea"
          rows={3}
          value={idea}
          onChange={(e) => onIdeaChange(e.target.value)}
          placeholder={getPlaceholder()}
          className="w-full bg-neutral-950/90 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl p-3.5 border border-neutral-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all resize-none shadow-inner leading-relaxed"
        />
      </div>

      {/* Suggested quick pills */}
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-neutral-500 flex items-center gap-1">
          <Lightbulb className="w-3 h-3 text-amber-400/70" />
          Sugestões rápidas:
        </span>
        {EXAMPLE_IDEAS.slice(0, 2).map((example, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onIdeaChange(example)}
            className="text-[11px] text-neutral-400 hover:text-amber-300 bg-neutral-800/60 hover:bg-neutral-800 px-2 py-0.5 rounded-md border border-neutral-700/50 transition-colors cursor-pointer truncate max-w-[280px] text-left"
          >
            "{example.substring(0, 42)}..."
          </button>
        ))}
      </div>

      {/* Main Action Bar */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-800/80">
        <button
          id="btn-autofill-ai"
          type="button"
          disabled={isLoading || !idea.trim()}
          onClick={onAutofill}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shadow-lg ${
            isLoading || !idea.trim()
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
              : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-neutral-950 hover:brightness-110 shadow-amber-950/40 active:scale-[0.99]'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
              <span>Gerando com {getAgentLabel()}...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>✨ Decompor com {getAgentLabel()}</span>
            </>
          )}
        </button>

        <button
          id="btn-jump-manual"
          type="button"
          onClick={onJumpToManual}
          className="text-xs text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1 self-center sm:self-auto underline-offset-4 hover:underline"
        >
          <span>preenchimento manual</span>
          <ArrowDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
