import React, { useState } from 'react';
import {
  Copy,
  Check,
  Sparkles,
  Loader2,
  Trash2,
  RefreshCw,
  Info,
  ShieldCheck,
  Film,
  ShoppingBag,
  User,
} from 'lucide-react';
import { AppMode, AgentType, ProductAnchor, CharacterAnchor } from '../types';

interface PromptOutputProps {
  mode: AppMode;
  agent: AgentType;
  product: ProductAnchor;
  character?: CharacterAnchor;
  deterministicPrompt: string;
  enhancedPrompt: string;
  isEnhancing: boolean;
  onGenerate: () => void;
  onEnhance: () => void;
  onClear: () => void;
  hasInput: boolean;
}

export const PromptOutput: React.FC<PromptOutputProps> = ({
  mode,
  agent,
  product,
  character,
  deterministicPrompt,
  enhancedPrompt,
  isEnhancing,
  onGenerate,
  onEnhance,
  onClear,
  hasInput,
}) => {
  const [copiedDeterministic, setCopiedDeterministic] = useState(false);
  const [copiedEnhanced, setCopiedEnhanced] = useState(false);

  const handleCopy = async (text: string, type: 'det' | 'enh') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'det') {
        setCopiedDeterministic(true);
        setTimeout(() => setCopiedDeterministic(false), 2000);
      } else {
        setCopiedEnhanced(true);
        setTimeout(() => setCopiedEnhanced(false), 2000);
      }
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const wordCount = (text: string) => {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const getAgentBadge = () => {
    switch (agent) {
      case 'pov':
        return { label: 'Agente POV (1ª Pessoa)', color: 'border-amber-500/40 text-amber-300 bg-amber-500/10' };
      case 'ugc':
        return { label: 'Agente UGC (Criador)', color: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' };
      case 'motion':
        return { label: 'Agente Movimento (B-Roll)', color: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10' };
    }
  };

  const agentBadge = getAgentBadge();

  return (
    <div className="space-y-4">
      {/* Top Action Bar: Gerar prompt & Limpar */}
      <div className="flex items-center gap-3">
        <button
          id="btn-generate-prompt"
          type="button"
          onClick={onGenerate}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 text-neutral-950 shadow-lg shadow-amber-950/40 active:scale-[0.99] transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-neutral-950" />
          <span>Atualizar / Gerar prompt</span>
        </button>

        <button
          id="btn-clear-form"
          type="button"
          onClick={onClear}
          className="flex items-center gap-1.5 py-3 px-3.5 rounded-xl text-xs font-semibold text-neutral-400 hover:text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-all cursor-pointer"
          title="Limpar todos os campos do formulário"
        >
          <Trash2 className="w-4 h-4 text-neutral-400" />
          <span className="hidden sm:inline">Limpar</span>
        </button>
      </div>

      {/* Primary Result Box: Deterministic Prompt */}
      <div className="bg-neutral-900/90 rounded-2xl border border-neutral-800 shadow-xl overflow-hidden">
        {/* Box Header */}
        <div className="p-4 border-b border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between bg-neutral-950/40 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h3 className="text-sm font-semibold text-neutral-200">
              Prompt TikTok Shop Estruturado
            </h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${agentBadge.color}`}>
              {agentBadge.label}
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[11px] text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded-md font-mono">
              {wordCount(deterministicPrompt)} palavras
            </span>

            {/* Copy Button */}
            <button
              id="btn-copy-deterministic"
              type="button"
              disabled={!deterministicPrompt}
              onClick={() => handleCopy(deterministicPrompt, 'det')}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                copiedDeterministic
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30'
              }`}
            >
              {copiedDeterministic ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar prompt</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Prompt Text Body */}
        <div className="p-4 sm:p-5">
          <div
            id="output-deterministic-text"
            className="w-full min-h-[140px] max-h-[300px] overflow-y-auto bg-neutral-950 rounded-xl p-4 text-neutral-200 text-sm font-mono leading-relaxed border border-neutral-800/80 select-all whitespace-pre-wrap break-words shadow-inner"
          >
            {deterministicPrompt || (
              <span className="text-neutral-600 font-sans italic">
                Selecione o agente, preencha o produto ancorado e os campos à esquerda para gerar seu prompt com padronização ultra realista e conformidade com o TikTok Shop...
              </span>
            )}
          </div>

          {/* Active Protection Pills */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
            <span className="flex items-center gap-1 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800 text-cyan-300">
              <Film className="w-3 h-3 text-cyan-400" />
              Ultra Realista Padronizado
            </span>
            <span className="flex items-center gap-1 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800 text-emerald-300">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Safe Zone TikTok Shop 9:16
            </span>
            {product.nome && (
              <span className="flex items-center gap-1 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800 text-amber-300">
                <ShoppingBag className="w-3 h-3 text-amber-400" />
                Produto: {product.nome}
              </span>
            )}
            {character?.nomeOuDescricao && (
              <span className="flex items-center gap-1 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800 text-sky-300">
                <User className="w-3 h-3 text-sky-400" />
                Modelo: {character.nomeOuDescricao.split(',')[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Button: Aprimorar com Gemini */}
      <div className="flex justify-center">
        <button
          id="btn-enhance-prompt"
          type="button"
          disabled={isEnhancing || !deterministicPrompt}
          onClick={onEnhance}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${
            isEnhancing || !deterministicPrompt
              ? 'bg-neutral-800/50 text-neutral-500 border-neutral-800 cursor-not-allowed'
              : 'bg-neutral-900 hover:bg-neutral-850 text-amber-300 hover:text-amber-200 border-amber-500/40 hover:border-amber-500/70 shadow-lg shadow-amber-950/20 active:scale-[0.99]'
          }`}
        >
          {isEnhancing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>Calibrando para {agent.toUpperCase()} & TikTok Shop...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>✨ Aprimorar com IA (Versão Ultra Realista Autoral)</span>
            </>
          )}
        </button>
      </div>

      {/* Secondary Result Box: Enhanced Prompt (if generated or enhancing) */}
      {(enhancedPrompt || isEnhancing) && (
        <div className="bg-neutral-900/90 rounded-2xl border border-amber-500/30 shadow-2xl shadow-amber-950/20 overflow-hidden animate-in fade-in duration-300">
          <div className="p-4 border-b border-amber-500/20 flex items-center justify-between bg-amber-500/5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-amber-200">
                Prompt Aprimorado Ultra Realista (TikTok Shop)
              </h3>
            </div>

            {enhancedPrompt && (
              <button
                id="btn-copy-enhanced"
                type="button"
                onClick={() => handleCopy(enhancedPrompt, 'enh')}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  copiedEnhanced
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500 text-neutral-950 hover:bg-amber-400 shadow-sm'
                }`}
              >
                {copiedEnhanced ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-950" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar aprimorado</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="p-4 sm:p-5">
            {isEnhancing ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-neutral-400 text-sm">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                <span>Otimizando ótica cinematográfica e consistência do produto...</span>
              </div>
            ) : (
              <div
                id="output-enhanced-text"
                className="w-full min-h-[120px] max-h-[300px] overflow-y-auto bg-neutral-950 rounded-xl p-4 text-neutral-100 text-sm font-mono leading-relaxed border border-amber-500/20 select-all whitespace-pre-wrap break-words"
              >
                {enhancedPrompt}
              </div>
            )}
            <p className="mt-2.5 text-[11px] text-neutral-400 leading-relaxed">
              Esta versão aprofunda o realismo tátil, microporos e reflexos de materiais reais, mantendo as características do produto 100% ancoradas e conformidade com as regras de anúncio do TikTok Shop.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
