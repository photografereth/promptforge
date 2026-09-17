import React, { useState, useMemo, useEffect } from 'react';
import {
  Flame,
  TrendingUp,
  Sparkles,
  Zap,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  DollarSign,
  ShoppingBag,
  ShieldCheck,
  Layers,
  Link2,
  Plus,
  Trash2,
} from 'lucide-react';
import { TikTokWinningProduct, AgentType, ProductAnchor } from '../types';
import { TIKTOK_WINNING_PRODUCTS } from '../data/winningProducts';
import { ImportProductModal } from './ImportProductModal';

const CUSTOM_PRODUCTS_STORAGE_KEY = 'flow_prompt_custom_tiktok_products';

interface TikTokWinningCatalogProps {
  currentAgent: AgentType;
  onInjectProduct: (
    product: ProductAnchor,
    agentScenario: {
      sujeito: string;
      acao: string;
      cenario: string;
      hookVisual: string;
      suggestedAgent?: AgentType;
    }
  ) => void;
}

export const TikTokWinningCatalog: React.FC<TikTokWinningCatalogProps> = ({
  currentAgent,
  onInjectProduct,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNiche, setSelectedNiche] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'commission' | 'volume' | 'status'>('commission');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [injectedId, setInjectedId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [customProducts, setCustomProducts] = useState<TikTokWinningProduct[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PRODUCTS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist custom products
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PRODUCTS_STORAGE_KEY, JSON.stringify(customProducts));
    } catch (e) {
      console.warn('Erro ao salvar produtos customizados no localStorage:', e);
    }
  }, [customProducts]);

  const handleAddCustomProduct = (newProduct: TikTokWinningProduct, autoInject = false) => {
    setCustomProducts((prev) => [newProduct, ...prev]);
    if (autoInject) {
      handleInject(newProduct);
    }
  };

  const handleDeleteCustomProduct = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Deseja remover este produto importado do seu catálogo?')) {
      setCustomProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // Filter and sort products (combining custom imported products at the top with catalog)
  const filteredProducts = useMemo(() => {
    let list = [...customProducts, ...TIKTOK_WINNING_PRODUCTS];

    if (selectedNiche !== 'all') {
      list = list.filter((p) => p.niche === selectedNiche);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.productAnchor.caracteristicasVisuais.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      // Prioritize user's custom products
      if (a.isCustom && !b.isCustom) return -1;
      if (!a.isCustom && b.isCustom) return 1;

      if (sortBy === 'commission') {
        const valA = parseFloat(a.commissionValue.replace(/[^0-9,]/g, '').replace(',', '.'));
        const valB = parseFloat(b.commissionValue.replace(/[^0-9,]/g, '').replace(',', '.'));
        return valB - valA;
      }
      if (sortBy === 'volume') {
        const volA = parseInt(a.salesVolume.replace(/[^0-9]/g, ''), 10) || 0;
        const volB = parseInt(b.salesVolume.replace(/[^0-9]/g, ''), 10) || 0;
        return volB - volA;
      }
      return a.status.localeCompare(b.status);
    });

    return list;
  }, [customProducts, selectedNiche, searchQuery, sortBy]);

  const handleCopyLink = (product: TikTokWinningProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(product.affiliateUrl);
    setCopiedId(product.id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === product.id ? null : curr));
    }, 2000);
  };

  const handleInject = (product: TikTokWinningProduct, targetAgent?: AgentType) => {
    const agentToUse = targetAgent || currentAgent;
    const hook = product.suggestedHooks[agentToUse];
    const action = product.suggestedActions[agentToUse];
    const scenario = product.suggestedScenarios[agentToUse];

    onInjectProduct(product.productAnchor, {
      sujeito: `${product.productAnchor.nome} sendo apresentado com iluminação comercial focada em conversão`,
      acao: action,
      cenario: scenario,
      hookVisual: hook,
      suggestedAgent: agentToUse,
    });

    setInjectedId(product.id);
    setTimeout(() => {
      setInjectedId((curr) => (curr === product.id ? null : curr));
    }, 3500);
  };

  return (
    <section className="bg-neutral-900/90 border border-amber-500/30 rounded-2xl overflow-hidden shadow-xl shadow-amber-950/20 transition-all">
      {/* Header Strip */}
      <div className="bg-gradient-to-r from-amber-500/10 via-neutral-900 to-neutral-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400 shrink-0 shadow-inner">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] tracking-widest uppercase bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-400/30">
                TIKTOK SHOP VALIDATION ENGINE
              </span>
              <span className="hidden sm:inline-block font-mono text-[10px] text-neutral-500 uppercase">
                FEED CURADO EM TEMPO REAL
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black uppercase text-neutral-100 tracking-tight mt-0.5">
              Máquina de Produtos Campeões (Alta Comissão & Volume)
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            id="btn-open-import-product-modal"
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 rounded-lg shadow-md transition-all cursor-pointer active:scale-95"
            title="Importar produto a partir de link real do TikTok Shop"
          >
            <Link2 className="w-4 h-4" />
            <span>Colar Link Real</span>
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700 transition-colors cursor-pointer"
          >
            <span>{isOpen ? 'Recolher Catálogo' : 'Expandir Catálogo'}</span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Subtitle / Value proposition */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-neutral-400 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Selecione um produto validado para <strong className="text-neutral-200">injetar em 1 clique</strong> todas as características físicas invariáveis, benefícios e roteiros otimizados para os 3 agentes.
              </span>
            </div>
            <div className="font-mono text-[11px] text-amber-400 font-bold shrink-0">
              {filteredProducts.length} PRODUTOS ENCONTRADOS
            </div>
          </div>

          {/* Filter, Search and Sort Bar */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, nicho ou ingrediente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            {/* Niche Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs">
              {[
                { id: 'all', label: 'Todos os Nichos' },
                { id: 'skincare', label: 'Skincare' },
                { id: 'tech', label: 'Tecnologia' },
                { id: 'beauty', label: 'Beleza' },
                { id: 'wellness', label: 'Saúde & Fitness' },
                { id: 'home', label: 'Casa & Utilidades' },
              ].map((niche) => (
                <button
                  key={niche.id}
                  type="button"
                  onClick={() => setSelectedNiche(niche.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    selectedNiche === niche.id
                      ? 'bg-amber-400 text-neutral-950 font-bold shadow'
                      : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                  }`}
                >
                  {niche.label}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2 shrink-0 text-xs">
              <span className="font-mono text-[11px] text-neutral-500 uppercase">ORDENAR:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 text-neutral-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="commission">Maior Comissão (R$)</option>
                <option value="volume">Volume de Vendas</option>
                <option value="status">Status (Explosão)</option>
              </select>
            </div>
          </div>

          {/* Feedback banner when a product was injected */}
          {injectedId && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl flex items-center justify-between gap-3 text-emerald-200 text-xs animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Produto e roteiros injetados com sucesso!</strong> As características do frasco, gancho visual e ações dos 3 agentes foram sincronizadas no painel abaixo.
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase text-emerald-400 font-bold">
                [ PRONTO PARA GERAR ]
              </span>
            </div>
          )}

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProducts.map((product) => {
              const isExpanded = expandedCardId === product.id;
              const isCopied = copiedId === product.id;
              const isInjected = injectedId === product.id;

              const statusBadge = {
                explosao: {
                  label: '🔥 EM EXPLOSÃO',
                  bg: 'bg-red-500/20 text-red-300 border-red-500/40',
                },
                tendencia: {
                  label: '⚡ TENDÊNCIA ALTA',
                  bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                },
                consistente: {
                  label: '💎 CONSISTENTE',
                  bg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
                },
              }[product.status];

              return (
                <div
                  key={product.id}
                  className={`border rounded-xl p-4 sm:p-5 flex flex-col justify-between transition-all ${
                    isInjected
                      ? 'border-emerald-400 bg-neutral-950 ring-2 ring-emerald-400/40 shadow-xl'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700/80 shadow-md'
                  }`}
                >
                  <div>
                    {/* Top Status & Category */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge.bg}`}
                        >
                          {statusBadge.label}
                        </span>
                        {product.isCustom && (
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-cyan-500/40 bg-cyan-500/20 text-cyan-300 flex items-center gap-1">
                            <Link2 className="w-3 h-3" /> LINK REAL
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-neutral-400 uppercase">
                          {product.category}
                        </span>
                        {product.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteCustomProduct(product.id, e)}
                            className="text-neutral-500 hover:text-red-400 p-1 hover:bg-neutral-900 rounded transition-colors cursor-pointer"
                            title="Remover produto importado"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Product Name */}
                    <h3 className="text-sm sm:text-base font-bold text-neutral-100 uppercase tracking-tight line-clamp-1">
                      {product.name}
                    </h3>

                    {/* Financial Metrics Strip */}
                    <div className="mt-3 grid grid-cols-3 gap-2 bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-800/80 text-center">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-neutral-400">COMISSÃO</div>
                        <div className="text-xs sm:text-sm font-black font-mono text-emerald-400 mt-0.5">
                          {product.commissionValue}
                        </div>
                        <div className="text-[10px] text-neutral-400">({product.commissionRate})</div>
                      </div>

                      <div>
                        <div className="text-[10px] font-mono uppercase text-neutral-400">TICKET MÉDIO</div>
                        <div className="text-xs sm:text-sm font-black font-mono text-neutral-200 mt-0.5">
                          {product.ticketPrice}
                        </div>
                        <div className="text-[10px] text-neutral-400">preço loja</div>
                      </div>

                      <div>
                        <div className="text-[10px] font-mono uppercase text-neutral-400">VOLUME</div>
                        <div className="text-xs sm:text-sm font-black font-mono text-amber-400 mt-0.5 line-clamp-1">
                          {product.salesVolume.split(' ')[0]}
                        </div>
                        <div className="text-[10px] text-neutral-400">vendas/mês</div>
                      </div>
                    </div>

                    {/* Invariable Visual Anchor Details */}
                    <div className="mt-3 text-xs text-neutral-400 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <span className="font-mono text-[10px] text-amber-400 font-bold shrink-0 mt-0.5">
                          [FRASCO/CORPO]:
                        </span>
                        <p className="line-clamp-2 text-neutral-300 text-[11px]">
                          {product.productAnchor.caracteristicasVisuais}
                        </p>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-mono text-[10px] text-emerald-400 font-bold shrink-0 mt-0.5">
                          [BENEFÍCIO]:
                        </span>
                        <p className="line-clamp-2 text-neutral-300 text-[11px]">
                          {product.productAnchor.beneficioVisual}
                        </p>
                      </div>
                    </div>

                    {/* Expanded 3-Agent Scripts Drawer */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-neutral-800 space-y-2.5 animate-in fade-in duration-200">
                        <div className="text-[11px] font-mono uppercase text-neutral-400 font-bold flex items-center justify-between">
                          <span>ÂNGULOS PRÉ-CALIBRADOS:</span>
                          <span className="text-amber-400 text-[10px]">SAFE ZONE 9:16 ATIVA</span>
                        </div>

                        {/* POV Hook */}
                        <div className="p-2.5 bg-neutral-900 rounded border border-neutral-800 text-[11px]">
                          <div className="flex items-center justify-between font-mono text-amber-400 font-bold mb-1">
                            <span>ARQUÉTIPO POV (1ª PESSOA)</span>
                            <button
                              type="button"
                              onClick={() => handleInject(product, 'pov')}
                              className="text-[10px] uppercase underline text-neutral-300 hover:text-white cursor-pointer"
                            >
                              Injetar POV
                            </button>
                          </div>
                          <p className="text-neutral-300">{product.suggestedHooks.pov}</p>
                        </div>

                        {/* UGC Hook */}
                        <div className="p-2.5 bg-neutral-900 rounded border border-neutral-800 text-[11px]">
                          <div className="flex items-center justify-between font-mono text-sky-400 font-bold mb-1">
                            <span>ARQUÉTIPO UGC (CRIADORA)</span>
                            <button
                              type="button"
                              onClick={() => handleInject(product, 'ugc')}
                              className="text-[10px] uppercase underline text-neutral-300 hover:text-white cursor-pointer"
                            >
                              Injetar UGC
                            </button>
                          </div>
                          <p className="text-neutral-300">{product.suggestedHooks.ugc}</p>
                        </div>

                        {/* Motion Hook */}
                        <div className="p-2.5 bg-neutral-900 rounded border border-neutral-800 text-[11px]">
                          <div className="flex items-center justify-between font-mono text-emerald-400 font-bold mb-1">
                            <span>ARQUÉTIPO MOVIMENTO (360°)</span>
                            <button
                              type="button"
                              onClick={() => handleInject(product, 'motion')}
                              className="text-[10px] uppercase underline text-neutral-300 hover:text-white cursor-pointer"
                            >
                              Injetar B-Roll
                            </button>
                          </div>
                          <p className="text-neutral-300">{product.suggestedHooks.motion}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCardId(isExpanded ? null : product.id)
                        }
                        className="text-xs text-neutral-400 hover:text-neutral-200 underline font-mono cursor-pointer"
                      >
                        {isExpanded ? 'Ocultar Roteiros [-]' : 'Ver 3 Roteiros [+]'}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(product, e)}
                        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-amber-300 font-mono transition-colors cursor-pointer"
                        title="Copiar Link de Afiliação"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">[LINK COPIADO]</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>

                      <a
                        href={product.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-amber-300 font-mono transition-colors cursor-pointer"
                        title="Abrir no TikTok em nova aba"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir Link</span>
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInject(product)}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs uppercase tracking-wider rounded-lg transition-all shadow-md cursor-pointer active:scale-[0.98]"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>Injetar & Criar Vídeo (1-Clique)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Real Product Import Modal */}
      <ImportProductModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onProductImported={handleAddCustomProduct}
      />
    </section>
  );
};
