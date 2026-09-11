import React, { useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  User,
  Package,
  Sparkles,
  CheckCircle2,
  Trash2,
  ScanFace,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Eye,
} from 'lucide-react';
import {
  ReferenceImageItem,
  ReferenceMediaState,
  ProductAnchor,
  CharacterAnchor,
  AgentType,
  AppMode,
} from '../types';

interface ReferenceUploadSectionProps {
  mediaState: ReferenceMediaState;
  onMediaStateChange: (newMediaState: ReferenceMediaState) => void;
  product: ProductAnchor;
  character?: CharacterAnchor;
  agent: AgentType;
  mode: AppMode;
  onAnalysisSuccess: (result: {
    product: ProductAnchor;
    character: CharacterAnchor;
    scene: any;
    consistencySummary: string;
  }) => void;
}

// High-quality sample SVG data URIs for instant testing
const SAMPLE_PRODUCT_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="bottle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d97706"/>
      <stop offset="50%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="goldCap" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#ca8a04"/>
      <stop offset="100%" stop-color="#854d0e"/>
    </linearGradient>
  </defs>
  <rect width="400" height="500" fill="url(#bg)"/>
  <ellipse cx="200" cy="420" rx="90" ry="16" fill="#000000" opacity="0.6"/>
  <!-- Bottle Body -->
  <rect x="140" y="210" width="120" height="190" rx="20" fill="url(#bottle)"/>
  <!-- Dropper Cap -->
  <rect x="175" y="160" width="50" height="50" rx="4" fill="url(#goldCap)"/>
  <rect x="188" y="110" width="24" height="50" rx="8" fill="#1c1917"/>
  <!-- Label -->
  <rect x="150" y="240" width="100" height="130" rx="8" fill="#fafafa"/>
  <text x="200" y="275" font-family="sans-serif" font-size="14" font-weight="bold" fill="#18181b" text-anchor="middle">LUMIÈRE</text>
  <text x="200" y="295" font-family="sans-serif" font-size="10" fill="#71717a" text-anchor="middle">VITAMINA C 15%</text>
  <line x1="165" y1="310" x2="235" y2="310" stroke="#fbbf24" stroke-width="2"/>
  <text x="200" y="330" font-family="sans-serif" font-size="9" fill="#27272a" text-anchor="middle">SÉRUM CLAREADOR</text>
  <text x="200" y="350" font-family="sans-serif" font-size="8" fill="#a1a1aa" text-anchor="middle">30ml / 1.0 fl.oz</text>
</svg>
`)}`;

const SAMPLE_CHARACTER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <defs>
    <linearGradient id="cbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#27272a"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fcd34d"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="400" height="500" fill="url(#cbg)"/>
  <!-- Creator Silhouette / Avatar -->
  <circle cx="200" cy="180" r="75" fill="#fcd34d"/>
  <!-- Hair -->
  <path d="M120 180 C120 100, 280 100, 280 180 C280 230, 265 240, 260 220 C250 140, 150 140, 140 220 Z" fill="#451a03"/>
  <!-- Eyes -->
  <ellipse cx="175" cy="180" rx="8" ry="5" fill="#1c1917"/>
  <ellipse cx="225" cy="180" rx="8" ry="5" fill="#1c1917"/>
  <!-- Smile -->
  <path d="M175 210 Q200 235 225 210" stroke="#b45309" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- Shoulders & Outfit (Casual Chic Hoodie) -->
  <path d="M110 320 C110 270, 160 260, 200 260 C240 260, 290 270, 290 320 L320 500 L80 500 Z" fill="#0284c7"/>
  <!-- Lapel mic -->
  <rect x="195" y="290" width="10" height="18" rx="4" fill="#18181b"/>
  <text x="200" y="450" font-family="sans-serif" font-size="14" font-weight="bold" fill="#f8fafc" text-anchor="middle">Mariana | Criadora TikTok</text>
  <text x="200" y="475" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">25 anos, estilo autêntico & comunicativo</text>
</svg>
`)}`;

export const ReferenceUploadSection: React.FC<ReferenceUploadSectionProps> = ({
  mediaState,
  onMediaStateChange,
  product,
  character,
  agent,
  mode,
  onAnalysisSuccess,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);

  const productInputRef = useRef<HTMLInputElement>(null);
  const characterInputRef = useRef<HTMLInputElement>(null);

  // File to Base64 converter
  const processFile = (file: File): Promise<ReferenceImageItem> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          dataUrl: reader.result as string,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'image/jpeg',
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Upload handler for Product
  const handleProductFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const item = await processFile(file);
      onMediaStateChange({
        ...mediaState,
        productImage: item,
      });
      setErrorMessage(null);
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao carregar imagem do produto.');
    }
  };

  // Upload handler for Character
  const handleCharacterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const item = await processFile(file);
      onMediaStateChange({
        ...mediaState,
        characterImage: item,
      });
      setErrorMessage(null);
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao carregar imagem da modelo.');
    }
  };

  // Drag & drop handlers
  const handleProductDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const item = await processFile(file);
      onMediaStateChange({
        ...mediaState,
        productImage: item,
      });
      setErrorMessage(null);
    }
  };

  const handleCharacterDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const item = await processFile(file);
      onMediaStateChange({
        ...mediaState,
        characterImage: item,
      });
      setErrorMessage(null);
    }
  };

  // Quick Sample Loader
  const handleLoadSampleProduct = () => {
    onMediaStateChange({
      ...mediaState,
      productImage: {
        dataUrl: SAMPLE_PRODUCT_SVG,
        name: 'amostra-serum-vitamina-c.png',
        size: 15400,
        mimeType: 'image/svg+xml',
      },
    });
    setErrorMessage(null);
  };

  const handleLoadSampleCharacter = () => {
    onMediaStateChange({
      ...mediaState,
      characterImage: {
        dataUrl: SAMPLE_CHARACTER_SVG,
        name: 'amostra-modelo-mariana.png',
        size: 14200,
        mimeType: 'image/svg+xml',
      },
    });
    setErrorMessage(null);
  };

  // Trigger Gemini Multimodal Analysis
  const handleRunAnalysis = async () => {
    if (!mediaState.productImage && !mediaState.characterImage) {
      setErrorMessage('Suba pelo menos uma imagem (produto ou modelo) para analisar.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImage: mediaState.productImage
            ? {
                data: mediaState.productImage.dataUrl,
                mimeType: mediaState.productImage.mimeType,
              }
            : null,
          characterImage: mediaState.characterImage
            ? {
                data: mediaState.characterImage.dataUrl,
                mimeType: mediaState.characterImage.mimeType,
              }
            : null,
          agent,
          mode,
          existingProduct: product,
          existingCharacter: character,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro na análise (${response.status})`);
      }

      const resData = await response.json();
      setAnalysisSummary(resData.consistencySummary || 'Análise visual concluída com sucesso.');

      onAnalysisSuccess({
        product: resData.product,
        character: resData.character,
        scene: resData.scene,
        consistencySummary: resData.consistencySummary,
      });
    } catch (err: any) {
      console.error('Erro na análise de referências:', err);
      setErrorMessage(
        err.message || 'Não foi possível analisar as referências. Você pode preencher manualmente.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hasAnyImage = Boolean(mediaState.productImage || mediaState.characterImage);
  const hasBothImages = Boolean(mediaState.productImage && mediaState.characterImage);

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ScanFace className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-neutral-100">
                Imagens de Referência (Produto & Modelo)
              </h3>
              <span className="text-[10px] font-semibold tracking-wide bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-400" />
                IA Multimodal de Consistência
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              A IA analisa os traços da modelo e detalhes da embalagem para travar consistência total entre cenas
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

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-neutral-800/80 space-y-4">
          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-800/70 rounded-xl flex items-center gap-2 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dual Upload Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Slot 1: Produto */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  Referência do Produto
                </label>
                {!mediaState.productImage && (
                  <button
                    type="button"
                    onClick={handleLoadSampleProduct}
                    className="text-[11px] text-amber-400/90 hover:text-amber-300 underline cursor-pointer"
                  >
                    Usar amostra rápida
                  </button>
                )}
              </div>

              {mediaState.productImage ? (
                /* Product Image Preview Card */
                <div className="relative bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex items-center gap-3 group hover:border-neutral-700 transition-colors">
                  <div
                    onClick={() => setPreviewModalImg(mediaState.productImage!.dataUrl)}
                    className="w-16 h-16 rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 cursor-pointer relative group/thumb"
                    title="Clique para ampliar"
                  >
                    <img
                      src={mediaState.productImage.dataUrl}
                      alt="Referência do produto"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                      Produto Vinculado
                    </span>
                    <p className="text-xs text-neutral-200 truncate font-medium mt-1">
                      {mediaState.productImage.name}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {(mediaState.productImage.size / 1024).toFixed(1)} KB
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => productInputRef.current?.click()}
                      className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                      title="Substituir foto"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onMediaStateChange({
                          ...mediaState,
                          productImage: null,
                        })
                      }
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Product Upload Dropzone */
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleProductDrop}
                  onClick={() => productInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-800 hover:border-amber-500/60 bg-neutral-950/60 hover:bg-neutral-900/50 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px]"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 mb-2">
                    <Upload className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-xs text-neutral-300 font-medium">
                    Foto do Produto
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Arraste ou clique (frasco, embalagem, logo)
                  </p>
                </div>
              )}

              <input
                ref={productInputRef}
                type="file"
                accept="image/*"
                onChange={handleProductFileChange}
                className="hidden"
              />
            </div>

            {/* Slot 2: Modelo / Personagem */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-400" />
                  Referência da Modelo / Personagem
                </label>
                {!mediaState.characterImage && (
                  <button
                    type="button"
                    onClick={handleLoadSampleCharacter}
                    className="text-[11px] text-sky-400/90 hover:text-sky-300 underline cursor-pointer"
                  >
                    Usar amostra rápida
                  </button>
                )}
              </div>

              {mediaState.characterImage ? (
                /* Character Image Preview Card */
                <div className="relative bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex items-center gap-3 group hover:border-neutral-700 transition-colors">
                  <div
                    onClick={() => setPreviewModalImg(mediaState.characterImage!.dataUrl)}
                    className="w-16 h-16 rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 cursor-pointer relative group/thumb"
                    title="Clique para ampliar"
                  >
                    <img
                      src={mediaState.characterImage.dataUrl}
                      alt="Referência da modelo"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded">
                      Modelo Vinculada
                    </span>
                    <p className="text-xs text-neutral-200 truncate font-medium mt-1">
                      {mediaState.characterImage.name}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {(mediaState.characterImage.size / 1024).toFixed(1)} KB
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => characterInputRef.current?.click()}
                      className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                      title="Substituir foto"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onMediaStateChange({
                          ...mediaState,
                          characterImage: null,
                        })
                      }
                      className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Character Upload Dropzone */
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleCharacterDrop}
                  onClick={() => characterInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-800 hover:border-sky-500/60 bg-neutral-950/60 hover:bg-neutral-900/50 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px]"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 mb-2">
                    <Upload className="w-4 h-4 text-sky-400" />
                  </div>
                  <p className="text-xs text-neutral-300 font-medium">
                    Foto da Modelo / Criador
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Arraste ou clique (rosto, corte de cabelo, expressão)
                  </p>
                </div>
              )}

              <input
                ref={characterInputRef}
                type="file"
                accept="image/*"
                onChange={handleCharacterFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Action Button: Run Multimodal Analysis */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-neutral-400 flex items-center gap-1.5">
              {hasBothImages ? (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Produto e Modelo prontos para análise multimodal completa!
                </span>
              ) : hasAnyImage ? (
                <span className="text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Pronto para analisar a imagem carregada.
                </span>
              ) : (
                <span>Suba fotos para extrair os atributos invariáveis com precisão ótica.</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={!hasAnyImage || isAnalyzing}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isAnalyzing
                  ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed'
                  : hasAnyImage
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20 active:scale-98'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Analisando Produto & Modelo com IA...</span>
                </>
              ) : (
                <>
                  <ScanFace className="w-4 h-4" />
                  <span>Analisar e Ancorar Consistência</span>
                </>
              )}
            </button>
          </div>

          {/* Analysis Result Banner */}
          {analysisSummary && (
            <div className="mt-3 p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Consistência Multimodal Travada com Sucesso
                </span>
                <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Fidelidade 100%
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 leading-relaxed">
                {analysisSummary}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal Preview */}
      {previewModalImg && (
        <div
          onClick={() => setPreviewModalImg(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-4 overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h4 className="text-xs font-bold text-neutral-200">
                Visualização da Imagem de Referência
              </h4>
              <button
                type="button"
                onClick={() => setPreviewModalImg(null)}
                className="text-neutral-400 hover:text-neutral-200 text-xs px-2 py-1 rounded bg-neutral-800 cursor-pointer"
              >
                Fechar ✕
              </button>
            </div>
            <div className="mt-3 max-h-[70vh] flex items-center justify-center overflow-hidden rounded-xl bg-neutral-950">
              <img
                src={previewModalImg}
                alt="Zoom referência"
                className="max-h-[65vh] w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
