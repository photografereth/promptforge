import React, { useState } from 'react';
import { VISUAL_STYLES } from '../data/options';
import { Sparkles, Palette, User, Move, MapPin, Edit3, ShieldCheck, Film } from 'lucide-react';
import { AgentType, ProductAnchor } from '../types';

interface EssentialSectionProps {
  sujeito: string;
  onSujeitoChange: (val: string) => void;
  acao: string;
  onAcaoChange: (val: string) => void;
  cenario: string;
  onCenarioChange: (val: string) => void;
  estilo: string;
  onEstiloChange: (val: string) => void;
  mode: 'video' | 'image';
  agent: AgentType;
  product: ProductAnchor;
}

export const EssentialSection: React.FC<EssentialSectionProps> = ({
  sujeito,
  onSujeitoChange,
  acao,
  onAcaoChange,
  cenario,
  onCenarioChange,
  estilo,
  onEstiloChange,
  mode,
  agent,
  product,
}) => {
  const [isCustomStyle, setIsCustomStyle] = useState<boolean>(() => {
    return Boolean(estilo && !VISUAL_STYLES.includes(estilo as any));
  });

  const handleStyleSelect = (val: string) => {
    if (val === '__custom__') {
      setIsCustomStyle(true);
      if (VISUAL_STYLES.includes(estilo as any)) {
        onEstiloChange('');
      }
    } else {
      setIsCustomStyle(false);
      onEstiloChange(val);
    }
  };

  const getSubjectPlaceholder = () => {
    if (product.nome.trim()) {
      return `Ex.: ${product.nome.trim()} sendo demonstrado com atenção aos detalhes`;
    }
    if (agent === 'pov') return 'Ex.: Mãos cuidadosas manuseando o frasco do produto em primeiro plano';
    if (agent === 'ugc') return 'Ex.: Criador comunicativo segurando o produto para a câmera';
    return 'Ex.: O produto em destaque comercial sobre pedestal com iluminação suave';
  };

  const getActionPlaceholder = () => {
    if (product.beneficioVisual.trim()) {
      return `Ex.: ${product.beneficioVisual.trim()}`;
    }
    if (agent === 'pov') return 'Ex.: Abrindo o conta-gotas e aplicando na pele com textura sedosa';
    if (agent === 'ugc') return 'Ex.: Mostrando o acabamento e reagindo com expressão autêntica de teste';
    return 'Ex.: Rotação suave de 360° em slow-motion revelando o relevo e acabamento';
  };

  return (
    <div id="section-essential" className="bg-neutral-900/90 rounded-2xl p-4 sm:p-5 border border-neutral-800 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800/80 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <h3 className="text-sm font-semibold text-neutral-200 uppercase tracking-wider">
            Direção de Cena Principal
          </h3>
          <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono uppercase">
            {agent === 'pov' ? '👁️ POV' : agent === 'ugc' ? '📱 UGC' : '⚡ MOVIMENTO'}
          </span>
        </div>

        {mode === 'video' && (
          <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 bg-cyan-950/40 border border-cyan-800/60 px-2.5 py-1 rounded-full w-fit">
            <Film className="w-3 h-3 text-cyan-400" />
            <span>Vídeo Ultra Realista Padronizado</span>
          </div>
        )}
      </div>

      {product.nome.trim() && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-amber-200">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            Produto Ancorado: <strong className="text-white">{product.nome}</strong>
          </span>
          <span className="text-[11px] text-amber-400/80">Trava invariável ativa</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 1. Sujeito Principal */}
        <div className="sm:col-span-1">
          <label htmlFor="input-sujeito" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
            <User className="w-3.5 h-3.5 text-amber-400/80" />
            <span>Sujeito principal ({agent.toUpperCase()})</span>
          </label>
          <input
            id="input-sujeito"
            type="text"
            value={sujeito}
            onChange={(e) => onSujeitoChange(e.target.value)}
            placeholder={getSubjectPlaceholder()}
            className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
          />
        </div>

        {/* 2. Ação / Pose */}
        <div className="sm:col-span-1">
          <label htmlFor="input-acao" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
            <Move className="w-3.5 h-3.5 text-amber-400/80" />
            <span>{mode === 'video' ? 'Ação / Movimento ultra realista' : 'Ação / Pose estática'}</span>
          </label>
          <input
            id="input-acao"
            type="text"
            value={acao}
            onChange={(e) => onAcaoChange(e.target.value)}
            placeholder={getActionPlaceholder()}
            className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
          />
        </div>

        {/* 3. Contexto / Cenário */}
        <div className="sm:col-span-2">
          <label htmlFor="input-cenario" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
            <MapPin className="w-3.5 h-3.5 text-amber-400/80" />
            <span>Cenário / Ambientação TikTok Shop</span>
          </label>
          <input
            id="input-cenario"
            type="text"
            value={cenario}
            onChange={(e) => onCenarioChange(e.target.value)}
            placeholder={
              agent === 'ugc'
                ? 'Ex.: quarto contemporâneo acolhedor com luz de janela suave ao fundo'
                : agent === 'pov'
                ? 'Ex.: bancada minimalista de banheiro moderno bem iluminada'
                : 'Ex.: estúdio comercial com base refletiva e fundo clean em tom neutro'
            }
            className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
          />
        </div>

        {/* 4. Estilo Visual */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="select-estilo" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
              <Palette className="w-3.5 h-3.5 text-amber-400/80" />
              <span>Estilo visual & Calibração de câmera</span>
            </label>
            <button
              type="button"
              onClick={() => setIsCustomStyle(!isCustomStyle)}
              className="text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              {isCustomStyle ? 'Voltar para opções recomendadas' : 'Digitar estilo personalizado'}
            </button>
          </div>

          {!isCustomStyle ? (
            <div className="space-y-2">
              <select
                id="select-estilo"
                value={VISUAL_STYLES.includes(estilo as any) ? estilo : '__custom__'}
                onChange={(e) => handleStyleSelect(e.target.value)}
                className="w-full bg-neutral-950 text-neutral-100 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all cursor-pointer"
              >
                {VISUAL_STYLES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
                <option value="__custom__">Outro estilo personalizado...</option>
              </select>

              {/* Quick style pills */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {VISUAL_STYLES.slice(0, 4).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onEstiloChange(st)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      estilo === st
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-medium'
                        : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border-neutral-800/80 hover:border-neutral-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <input
                id="input-custom-estilo"
                type="text"
                value={estilo}
                onChange={(e) => onEstiloChange(e.target.value)}
                placeholder="Ex.: Câmera cinema 4K real com micro-detalhes, iluminação difusa natural sem aberração de IA"
                className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-amber-500/50 focus:border-amber-400 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
