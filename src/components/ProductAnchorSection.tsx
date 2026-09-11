import React, { useState } from 'react';
import {
  Package,
  ShieldCheck,
  Lock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  User,
  CheckCircle2,
} from 'lucide-react';
import { ProductAnchor, CharacterAnchor } from '../types';

interface ProductAnchorSectionProps {
  product: ProductAnchor;
  character?: CharacterAnchor;
  onChange: (key: keyof ProductAnchor, value: string) => void;
  onCharacterChange?: (key: keyof CharacterAnchor, value: string) => void;
  onApplyPreset: (preset: ProductAnchor) => void;
  onApplyCharacterPreset?: (preset: CharacterAnchor) => void;
}

const PRODUCT_PRESETS: Array<{ label: string; data: ProductAnchor }> = [
  {
    label: '🧴 Sérum Vitamina C Âmbar',
    data: {
      nome: 'Sérum Facial Vitamina C Radiance',
      categoria: 'Skincare & Beleza',
      caracteristicasVisuais:
        'Frasco cilíndrico de vidro âmbar fosco de 30ml com conta-gotas metálico dourado, rótulo branco minimalista com tipografia preta limpa e líquido translúcido dourado',
      beneficioVisual:
        'Três gotas límpidas caindo e se espalhando na pele com acabamento luminoso e sem oleosidade',
    },
  },
  {
    label: '🎧 Fone TWS Matte Black',
    data: {
      nome: 'Fones TWS Pro Sound Air',
      categoria: 'Tecnologia & Gadgets',
      caracteristicasVisuais:
        'Estojo de carregamento oval preto fosco com detalhe em LED sutil âmbar, fones intra-auriculares ergonômicos com acabamento acetinado anti-marcas de dedos',
      beneficioVisual:
        'Estojo se abrindo com encaixe magnético suave e fones sendo retirados com precisão',
    },
  },
  {
    label: '💧 Garrafa Térmica Olive',
    data: {
      nome: 'Garrafa Térmica HydroPure 750ml',
      categoria: 'Casa & Fitness',
      caracteristicasVisuais:
        'Garrafa cilíndrica em aço inoxidável com textura texturizada verde-oliva fosca, tampa rosqueável em madeira de bambu com alça de metal escovado',
      beneficioVisual:
        'Gotículas de condensação fria escorrendo levemente pela textura externa em close-up',
    },
  },
  {
    label: '🧥 Corta-Vento Streetwear',
    data: {
      nome: 'Jaqueta Corta-Vento Urban Shield',
      categoria: 'Moda & Vestuário',
      caracteristicasVisuais:
        'Jaqueta em nylon ripstop preto fosco resistente à água, zíper selado contrastante em grafite, caimento oversized moderno com capuz estruturado',
      beneficioVisual:
        'Gotas d’água deslizando suavemente pela superfície do tecido repelente em movimento fluido',
    },
  },
];

const CHARACTER_PRESETS: Array<{ label: string; data: CharacterAnchor }> = [
  {
    label: '✨ Mariana (UGC & Beleza)',
    data: {
      nomeOuDescricao: 'Mariana, criadora brasileira de 25 anos, estilo autêntico e expressivo',
      caracteristicasFisicas:
        'Pele viçosa e bem cuidada, traços suaves e harmoniosos, olhos castanhos amendoados e sorriso comunicativo',
      cabelo: 'Cabelo castanho médio ondulado com mechas suaves e movimento natural',
      estiloVestuario: 'Blusa de gola alta canelada off-white com microfone de lapela discreto',
      expressaoMarcante:
        'Espontânea, acolhedora e olhando diretamente para a câmera como numa conversa real com a comunidade',
    },
  },
  {
    label: '🎧 Lucas (Tech & Gadgets)',
    data: {
      nomeOuDescricao: 'Lucas, criador de tecnologia de 27 anos com visual contemporâneo',
      caracteristicasFisicas:
        'Tom de pele moreno claro, barba curta alinhada, traços marcantes e olhar focado nos detalhes práticos',
      cabelo: 'Corte fade moderno texturizado preto',
      estiloVestuario: 'Camiseta oversized preta premium com estética limpa e minimalista',
      expressaoMarcante: 'Entusiasmado e seguro, demonstrando cada recurso com destreza manual',
    },
  },
  {
    label: '🌿 Sofia (Clean Girl & Wellness)',
    data: {
      nomeOuDescricao: 'Sofia, modelo de lifestyle de 24 anos com estética natural',
      caracteristicasFisicas:
        'Pele luminosa sem maquiagem pesada, olhar sereno e expressão leve',
      cabelo: 'Cabelo longo loiro-escuro preso em rabo de cavalo despojado',
      estiloVestuario: 'Conjunto esportivo casual em linho cru ou algodão orgânico neutro',
      expressaoMarcante: 'Movimentos calmos e precisos, transmitindo credibilidade e bem-estar',
    },
  },
];

export const ProductAnchorSection: React.FC<ProductAnchorSectionProps> = ({
  product,
  character,
  onChange,
  onCharacterChange,
  onApplyPreset,
  onApplyCharacterPreset,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'product' | 'character'>('product');

  const hasProductData = Boolean(
    product.nome.trim() || product.caracteristicasVisuais.trim()
  );

  const hasCharacterData = Boolean(
    character && (character.nomeOuDescricao?.trim() || character.caracteristicasFisicas?.trim())
  );

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl transition-all">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-neutral-100">
                Travas Invariáveis de Consistência
              </h3>
              <span className="text-[10px] font-semibold tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Anti-Mutação de IA
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Mantém a mesma modelo e o mesmo produto idênticos em todas as cenas geradas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          aria-label={isOpen ? 'Recolher seção' : 'Expandir seção'}
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-neutral-800/80 space-y-4">
          {/* Sub-tabs: Produto vs Modelo */}
          <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('product')}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'product'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Âncora do Produto</span>
              {hasProductData && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('character')}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'character'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Âncora da Modelo / Personagem</span>
              {hasCharacterData && (
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
              )}
            </button>
          </div>

          {/* TAB 1: PRODUTO */}
          {activeTab === 'product' && (
            <div className="space-y-4">
              {/* Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-400 font-medium flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Exemplos de produtos para teste rápido:
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onApplyPreset(preset.data)}
                      className="text-xs bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-850 px-3 py-1.5 rounded-lg text-neutral-300 hover:text-amber-200 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="product-name"
                    className="block text-xs font-semibold text-neutral-300 mb-1"
                  >
                    Nome do Produto <span className="text-amber-400">*</span>
                  </label>
                  <input
                    id="product-name"
                    type="text"
                    value={product.nome}
                    onChange={(e) => onChange('nome', e.target.value)}
                    placeholder="Ex: Sérum Glow Vitamina C, Fone TWS Pro..."
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl px-3.5 py-2 text-xs text-neutral-100 placeholder-neutral-500 transition-colors outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="product-category"
                    className="block text-xs font-semibold text-neutral-300 mb-1"
                  >
                    Nicho / Categoria no TikTok Shop
                  </label>
                  <input
                    id="product-category"
                    type="text"
                    value={product.categoria}
                    onChange={(e) => onChange('categoria', e.target.value)}
                    placeholder="Ex: Skincare & Beleza, Gadgets & Tecnologia, Moda..."
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl px-3.5 py-2 text-xs text-neutral-100 placeholder-neutral-500 transition-colors outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="product-visual-traits"
                    className="block text-xs font-semibold text-neutral-300"
                  >
                    Características Físicas Invariáveis (Embalagem, Cor, Material, Detalhes)
                  </label>
                  <span className="text-[11px] text-amber-400/80">Trava anti-mutação</span>
                </div>
                <textarea
                  id="product-visual-traits"
                  rows={2}
                  value={product.caracteristicasVisuais}
                  onChange={(e) => onChange('caracteristicasVisuais', e.target.value)}
                  placeholder="Ex: Frasco cilíndrico de vidro âmbar fosco de 30ml com conta-gotas dourado metálico, tampa de borracha preta, rótulo branco fosco minimalista com tipografia preta..."
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl p-3 text-xs text-neutral-100 placeholder-neutral-500 transition-colors outline-none resize-none leading-relaxed"
                />
              </div>

              <div>
                <label
                  htmlFor="product-benefit"
                  className="block text-xs font-semibold text-neutral-300 mb-1"
                >
                  Ação Visual do Produto (Uso prático ou textura a ser demonstrada)
                </label>
                <input
                  id="product-benefit"
                  type="text"
                  value={product.beneficioVisual}
                  onChange={(e) => onChange('beneficioVisual', e.target.value)}
                  placeholder="Ex: Textura sedosa sendo espalhada na pele com rápida absorção e viço luminoso..."
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl px-3.5 py-2 text-xs text-neutral-100 placeholder-neutral-500 transition-colors outline-none"
                />
              </div>

              {hasProductData && (
                <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-400">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Âncora do produto ativa: atributos preservados em todos os prompts.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onChange('nome', '');
                      onChange('categoria', '');
                      onChange('caracteristicasVisuais', '');
                      onChange('beneficioVisual', '');
                    }}
                    className="text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                  >
                    Limpar produto
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MODELO / PERSONAGEM */}
          {activeTab === 'character' && (
            <div className="space-y-4">
              {/* Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-400 font-medium flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    Exemplos de perfis de modelo / criador:
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CHARACTER_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onApplyCharacterPreset && onApplyCharacterPreset(preset.data)}
                      className="text-xs bg-neutral-950 border border-neutral-800 hover:border-sky-500/50 hover:bg-neutral-850 px-3 py-1.5 rounded-lg text-neutral-300 hover:text-sky-200 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Character Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="char-name"
                    className="block text-xs font-semibold text-neutral-300 mb-1"
                  >
                    Identificação / Nome da Modelo / Criador
                  </label>
                  <input
                    id="char-name"
                    type="text"
                    value={character?.nomeOuDescricao || ''}
                    onChange={(e) => onCharacterChange && onCharacterChange('nomeOuDescricao', e.target.value)}
                    placeholder="Ex: Mariana, criadora brasileira ~25 anos..."
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 rounded-xl px-3.5 py-2 text-xs text-neutral-100 placeholder-neutral-500 transition-colors outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="char-hair"
                    className="block text-xs font-semibold text-neutral-300 mb-1"
                  >
                    Cabelo (Cor, Corte, Comprimento)
                  </label>
                  <input
                    id="char-hair"
                    type="text"
                    value={character?.cabelo || ''}
                    onChange={(e) => onCharacterChange && onCharacterChange('cabelo', e.target.value)}
                    placeholder="Ex: Castanho médio com ondas naturais soltas..."
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 rounded-xl px-3.5 py-2 text-xs text-neutral-100 placeholder-neutral-500 transition-colors outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="char-features"
                    className="block text-xs font-semibold text-neutral-300"
                  >
                    Traços Faciais e Físicos Distintivos (Tom de pele, olhos, formato do rosto)
                  </label>
                  <span className="text-[11px] text-sky-400/80">Trava de Identidade Facial</span>
                </div>
                <textarea
                  id="char-features"
                  rows={2}
                  value={character?.caracteristicasFisicas || ''}
                  onChange={(e) => onCharacterChange && onCharacterChange('caracteristicasFisicas', e.target.value)}
                  placeholder="Ex: Pele viçosa e bem cuidada, olhos amendoados expressivos, nariz fino, traços faciais naturais..."
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 rounded-xl p-3 text-xs text-neutral-100 placeholder-neutral-500 transition-colors outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="char-outfit"
                    className="block text-xs font-semibold text-neutral-300 mb-1"
                  >
                    Figurino & Estilo de Vestimenta
                  </label>
                  <input
                    id="char-outfit"
                    type="text"
                    value={character?.estiloVestuario || ''}
                    onChange={(e) => onCharacterChange && onCharacterChange('estiloVestuario', e.target.value)}
                    placeholder="Ex: Blusa canelada off-white com microfone lapela..."
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 rounded-xl px-3.5 py-2 text-xs text-neutral-100 placeholder-neutral-500 transition-colors outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="char-expression"
                    className="block text-xs font-semibold text-neutral-300 mb-1"
                  >
                    Expressão Marcante & Atitude Cênica
                  </label>
                  <input
                    id="char-expression"
                    type="text"
                    value={character?.expressaoMarcante || ''}
                    onChange={(e) => onCharacterChange && onCharacterChange('expressaoMarcante', e.target.value)}
                    placeholder="Ex: Espontânea, comunicativa, olhar direto para a lente..."
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 rounded-xl px-3.5 py-2 text-xs text-neutral-100 placeholder-neutral-500 transition-colors outline-none"
                  />
                </div>
              </div>

              {hasCharacterData && (
                <div className="flex items-center justify-between pt-1 text-[11px] text-neutral-400">
                  <span className="flex items-center gap-1 text-sky-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Âncora da modelo ativa: a mesma pessoa será preservada nos cortes e cenas.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onCharacterChange) {
                        onCharacterChange('nomeOuDescricao', '');
                        onCharacterChange('caracteristicasFisicas', '');
                        onCharacterChange('cabelo', '');
                        onCharacterChange('estiloVestuario', '');
                        onCharacterChange('expressaoMarcante', '');
                      }
                    }}
                    className="text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                  >
                    Limpar modelo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
