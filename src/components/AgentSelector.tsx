import React from 'react';
import { Eye, Smartphone, PlaySquare, Sparkles, CheckCircle2 } from 'lucide-react';
import { AgentType } from '../types';

interface AgentSelectorProps {
  selectedAgent: AgentType;
  onAgentChange: (agent: AgentType) => void;
}

interface AgentCardInfo {
  id: AgentType;
  title: string;
  badge: string;
  icon: React.ElementType;
  description: string;
  characteristics: string[];
  recommendedCamera: string;
}

const AGENTS: AgentCardInfo[] = [
  {
    id: 'pov',
    title: 'Agente POV',
    badge: '1ª Pessoa & Textura',
    icon: Eye,
    description: 'Ponto de vista dos olhos do criador. Mãos interagindo diretamente com o produto em primeiro plano.',
    characteristics: ['Demonstração tátil e unboxing', 'Foco de profundidade no produto', 'Ângulo natural de uso real'],
    recommendedCamera: 'Plano médio/detalhe subjetivo (POV)',
  },
  {
    id: 'ugc',
    title: 'Agente UGC',
    badge: 'Criador Autêntico',
    icon: Smartphone,
    description: 'Estética de criador real gravando com smartphone 4K. Hook visual imediato e conexão com o público.',
    characteristics: ['Hook nos primeiros 2 segundos', 'Expressão espontânea de teste', 'Linguagem nativa do feed do TikTok'],
    recommendedCamera: 'Câmera frontal vertical na altura dos olhos',
  },
  {
    id: 'motion',
    title: 'Agente Movimento',
    badge: 'B-Roll & Dinâmico',
    icon: PlaySquare,
    description: 'Planos dinâmicos de produto com rotação 360°, slow-motion e iluminação comercial de alta conversão.',
    characteristics: ['Rotação 360° e travelling orbital', 'Reflexos de estúdio na embalagem', 'Foco macro nas texturas e acabamento'],
    recommendedCamera: 'Travelling fluido ou órbita suave',
  },
];

export const AgentSelector: React.FC<AgentSelectorProps> = ({ selectedAgent, onAgentChange }) => {
  return (
    <div className="bg-neutral-900/90 border border-neutral-800/90 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-amber-500/5 blur-3xl pointer-events-none rounded-full" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              3 Agentes Especialistas de Criativos
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-neutral-100 mt-0.5">
            Escolha o Agente para TikTok Shop
          </h2>
        </div>
        <div className="text-[11px] text-neutral-400 bg-neutral-950/80 px-2.5 py-1 rounded-full border border-neutral-800 w-fit flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Vídeo Ultra Realista Padronizado
        </div>
      </div>

      {/* 3 Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          const isSelected = selectedAgent === agent.id;

          return (
            <button
              key={agent.id}
              type="button"
              id={`agent-btn-${agent.id}`}
              onClick={() => onAgentChange(agent.id)}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40'
                  : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-950/90'
              }`}
            >
              {/* Active checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 text-amber-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-amber-500 text-neutral-950'
                        : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-100 leading-none">
                      {agent.title}
                    </h3>
                    <span className="text-[10px] text-amber-300/80 font-mono">
                      {agent.badge}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed mb-3">
                  {agent.description}
                </p>
              </div>

              <div className="pt-2.5 border-t border-neutral-800/80 mt-auto">
                <ul className="space-y-1">
                  {agent.characteristics.map((char, idx) => (
                    <li key={idx} className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-amber-400/80 shrink-0" />
                      <span className="truncate">{char}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
