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
  Plus,
  Compass,
  X,
  Layers,
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

// Sample SVG 1: Bottle Front View
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
  <rect x="140" y="210" width="120" height="190" rx="20" fill="url(#bottle)"/>
  <rect x="175" y="160" width="50" height="50" rx="4" fill="url(#goldCap)"/>
  <rect x="188" y="110" width="24" height="50" rx="8" fill="#1c1917"/>
  <rect x="150" y="240" width="100" height="130" rx="8" fill="#fafafa"/>
  <text x="200" y="275" font-family="sans-serif" font-size="14" font-weight="bold" fill="#18181b" text-anchor="middle">LUMIÈRE</text>
  <text x="200" y="295" font-family="sans-serif" font-size="10" fill="#71717a" text-anchor="middle">VITAMINA C 15%</text>
  <line x1="165" y1="310" x2="235" y2="310" stroke="#fbbf24" stroke-width="2"/>
  <text x="200" y="330" font-family="sans-serif" font-size="9" fill="#27272a" text-anchor="middle">SÉRUM CLAREADOR</text>
  <text x="200" y="350" font-family="sans-serif" font-size="8" fill="#a1a1aa" text-anchor="middle">30ml / 1.0 fl.oz</text>
</svg>
`)}`;

// Sample SVG 2: Dropper & Formula Texture Close-up
const SAMPLE_PRODUCT_TEXTURE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <defs>
    <radialGradient id="droplet" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="60%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </radialGradient>
  </defs>
  <rect width="400" height="500" fill="#0f172a"/>
  <!-- Dropper Pipette Tip -->
  <polygon points="180,40 220,40 210,240 190,240" fill="#e2e8f0" opacity="0.85"/>
  <polygon points="188,40 212,40 206,235 194,235" fill="#fef08a" opacity="0.7"/>
  <!-- Golden Drop Hanging -->
  <path d="M 190 240 Q 200 320 230 350 Q 200 400 170 350 Q 200 320 210 240 Z" fill="url(#droplet)"/>
  <circle cx="195" cy="330" r="8" fill="#ffffff" opacity="0.6"/>
  <text x="200" y="440" font-family="sans-serif" font-size="12" font-weight="bold" fill="#f8fafc" text-anchor="middle">Textura Sensorial / Gotas</text>
  <text x="200" y="465" font-family="sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">Ângulo Macro da Fórmula</text>
</svg>
`)}`;

// Sample SVG 3: Creator Face Close-up
const SAMPLE_CHARACTER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <defs>
    <linearGradient id="cbg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#27272a"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
  </defs>
  <rect width="400" height="500" fill="url(#cbg)"/>
  <circle cx="200" cy="180" r="75" fill="#fcd34d"/>
  <path d="M120 180 C120 100, 280 100, 280 180 C280 230, 265 240, 260 220 C250 140, 150 140, 140 220 Z" fill="#451a03"/>
  <ellipse cx="175" cy="180" rx="8" ry="5" fill="#1c1917"/>
  <ellipse cx="225" cy="180" rx="8" ry="5" fill="#1c1917"/>
  <path d="M175 210 Q200 235 225 210" stroke="#b45309" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M110 320 C110 270, 160 260, 200 260 C240 260, 290 270, 290 320 L320 500 L80 500 Z" fill="#0284c7"/>
  <rect x="195" y="290" width="10" height="18" rx="4" fill="#18181b"/>
  <text x="200" y="450" font-family="sans-serif" font-size="14" font-weight="bold" fill="#f8fafc" text-anchor="middle">Mariana | Criadora TikTok</text>
  <text x="200" y="475" font-family="sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">25 anos, estilo autêntico & comunicativo</text>
</svg>
`)}`;

// Sample SVG 4: Scene / Ambient Background
const SAMPLE_SCENE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <defs>
    <linearGradient id="scbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="400" height="500" fill="url(#scbg)"/>
  <!-- Window morning light -->
  <polygon points="40,20 200,20 260,300 100,300" fill="#fef08a" opacity="0.15"/>
  <rect x="50" y="320" width="300" height="20" rx="4" fill="#cbd5e1"/>
  <ellipse cx="120" cy="280" rx="25" ry="40" fill="#15803d" opacity="0.8"/>
  <text x="200" y="440" font-family="sans-serif" font-size="12" font-weight="bold" fill="#f8fafc" text-anchor="middle">Cenário: Banheiro Minimalista</text>
  <text x="200" y="465" font-family="sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">Luz Natural de Manhã & Plantas</text>
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
  const [showSceneSlot, setShowSceneSlot] = useState<boolean>(false);

  const productInputRef = useRef<HTMLInputElement>(null);
  const characterInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);

  // Normalize image arrays to always guarantee backward compatibility
  const productImages: ReferenceImageItem[] =
    mediaState.productImages && mediaState.productImages.length > 0
      ? mediaState.productImages
      : mediaState.productImage
      ? [mediaState.productImage]
      : [];

  const characterImages: ReferenceImageItem[] =
    mediaState.characterImages && mediaState.characterImages.length > 0
      ? mediaState.characterImages
      : mediaState.characterImage
      ? [mediaState.characterImage]
      : [];

  const sceneImages: ReferenceImageItem[] = mediaState.sceneImages || [];

  // Central state update function that keeps productImage & characterImage synchronized
  const updateMediaState = (
    newProds: ReferenceImageItem[],
    newChars: ReferenceImageItem[],
    newScenes: ReferenceImageItem[] = sceneImages
  ) => {
    onMediaStateChange({
      productImages: newProds,
      characterImages: newChars,
      sceneImages: newScenes,
      productImage: newProds[0] || null,
      characterImage: newChars[0] || null,
    });
  };

  // Convert File to Base64 object
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

  // Process multiple files
  const processFiles = async (files: FileList | File[]): Promise<ReferenceImageItem[]> => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const items = await Promise.all(list.map((f) => processFile(f)));
    return items;
  };

  // Product: Upload multiple
  const handleProductFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const newItems = await processFiles(e.target.files);
      if (newItems.length > 0) {
        updateMediaState([...productImages, ...newItems], characterImages, sceneImages);
        setErrorMessage(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao carregar imagens do produto.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Product: Drag & Drop
  const handleProductDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    try {
      const newItems = await processFiles(e.dataTransfer.files);
      if (newItems.length > 0) {
        updateMediaState([...productImages, ...newItems], characterImages, sceneImages);
        setErrorMessage(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao processar imagens do produto.');
    }
  };

  // Remove individual product image
  const handleRemoveProductImage = (indexToRemove: number) => {
    const updated = productImages.filter((_, idx) => idx !== indexToRemove);
    updateMediaState(updated, characterImages, sceneImages);
  };

  // Character: Upload multiple
  const handleCharacterFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const newItems = await processFiles(e.target.files);
      if (newItems.length > 0) {
        updateMediaState(productImages, [...characterImages, ...newItems], sceneImages);
        setErrorMessage(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao carregar imagens da modelo.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Character: Drag & Drop
  const handleCharacterDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    try {
      const newItems = await processFiles(e.dataTransfer.files);
      if (newItems.length > 0) {
        updateMediaState(productImages, [...characterImages, ...newItems], sceneImages);
        setErrorMessage(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao processar imagens da modelo.');
    }
  };

  // Remove individual character image
  const handleRemoveCharacterImage = (indexToRemove: number) => {
    const updated = characterImages.filter((_, idx) => idx !== indexToRemove);
    updateMediaState(productImages, updated, sceneImages);
  };

  // Scene: Upload multiple
  const handleSceneFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const newItems = await processFiles(e.target.files);
      if (newItems.length > 0) {
        updateMediaState(productImages, characterImages, [...sceneImages, ...newItems]);
        setErrorMessage(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao carregar imagens do cenário.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Scene: Drag & Drop
  const handleSceneDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    try {
      const newItems = await processFiles(e.dataTransfer.files);
      if (newItems.length > 0) {
        updateMediaState(productImages, characterImages, [...sceneImages, ...newItems]);
        setErrorMessage(null);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao processar imagens do cenário.');
    }
  };

  // Remove individual scene image
  const handleRemoveSceneImage = (indexToRemove: number) => {
    const updated = sceneImages.filter((_, idx) => idx !== indexToRemove);
    updateMediaState(productImages, characterImages, updated);
  };

  // Quick Samples Loaders
  const handleAddSampleProduct = () => {
    const sampleItem: ReferenceImageItem = {
      dataUrl: SAMPLE_PRODUCT_SVG,
      name: 'amostra-serum-lumiere.png',
      size: 15400,
      mimeType: 'image/svg+xml',
    };
    updateMediaState([...productImages, sampleItem], characterImages, sceneImages);
    setErrorMessage(null);
  };

  const handleAddSampleProductTexture = () => {
    const sampleItem: ReferenceImageItem = {
      dataUrl: SAMPLE_PRODUCT_TEXTURE_SVG,
      name: 'amostra-textura-gotas.png',
      size: 12800,
      mimeType: 'image/svg+xml',
    };
    updateMediaState([...productImages, sampleItem], characterImages, sceneImages);
    setErrorMessage(null);
  };

  const handleAddSampleCharacter = () => {
    const sampleItem: ReferenceImageItem = {
      dataUrl: SAMPLE_CHARACTER_SVG,
      name: 'amostra-modelo-mariana.png',
      size: 14200,
      mimeType: 'image/svg+xml',
    };
    updateMediaState(productImages, [...characterImages, sampleItem], sceneImages);
    setErrorMessage(null);
  };

  const handleAddSampleScene = () => {
    const sampleItem: ReferenceImageItem = {
      dataUrl: SAMPLE_SCENE_SVG,
      name: 'amostra-cenario-banheiro.png',
      size: 13500,
      mimeType: 'image/svg+xml',
    };
    updateMediaState(productImages, characterImages, [...sceneImages, sampleItem]);
    setShowSceneSlot(true);
    setErrorMessage(null);
  };

  // Trigger Multimodal Analysis across all images
  const handleRunAnalysis = async () => {
    const totalImagesCount = productImages.length + characterImages.length + sceneImages.length;
    if (totalImagesCount === 0) {
      setErrorMessage('Adicione pelo menos uma imagem de referência (produto ou modelo) para analisar.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/analyze-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImages: productImages.map((img) => ({
            data: img.dataUrl,
            mimeType: img.mimeType,
          })),
          characterImages: characterImages.map((img) => ({
            data: img.dataUrl,
            mimeType: img.mimeType,
          })),
          sceneImages: sceneImages.map((img) => ({
            data: img.dataUrl,
            mimeType: img.mimeType,
          })),
          productImage: productImages[0]
            ? { data: productImages[0].dataUrl, mimeType: productImages[0].mimeType }
            : null,
          characterImage: characterImages[0]
            ? { data: characterImages[0].dataUrl, mimeType: characterImages[0].mimeType }
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
      setAnalysisSummary(resData.consistencySummary || 'Análise visual multimodal concluída com sucesso.');

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

  const totalImagesCount = productImages.length + characterImages.length + sceneImages.length;
  const hasBothKeyCategories = productImages.length > 0 && characterImages.length > 0;

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
                Imagens de Referência
              </h3>
              <span className="text-[10px] font-semibold tracking-wide bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-400" />
                IA Multimodal • Múltiplos Ângulos
              </span>
              {totalImagesCount > 0 && (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  {totalImagesCount} {totalImagesCount === 1 ? 'foto anexada' : 'fotos anexadas'}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              Adicione fotos do produto (frente, rótulo, textura), da criadora e do cenário para consistência total
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
        <div className="mt-4 pt-4 border-t border-neutral-800/80 space-y-5">
          {/* Error Message if any */}
          {errorMessage && (
            <div className="p-3 bg-red-950/60 border border-red-800/70 rounded-xl flex items-center gap-2 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Grid of Reference Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ================= SLOT 1: PRODUTO (Múltiplas Fotos) ================= */}
            <div className="flex flex-col bg-neutral-950/40 border border-neutral-800/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-neutral-200">
                    Fotos do Produto
                  </span>
                  {productImages.length > 0 && (
                    <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded">
                      {productImages.length}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddSampleProduct}
                    className="text-[11px] text-amber-400/90 hover:text-amber-300 underline cursor-pointer"
                    title="Adicionar imagem de teste rápida"
                  >
                    + Amostra Frasco
                  </button>
                  {productImages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddSampleProductTexture}
                      className="text-[11px] text-amber-300/80 hover:text-amber-200 underline cursor-pointer"
                      title="Adicionar detalhe macro de textura"
                    >
                      + Textura
                    </button>
                  )}
                  {productImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => updateMediaState([], characterImages, sceneImages)}
                      className="text-[11px] text-neutral-500 hover:text-red-400 cursor-pointer ml-1"
                      title="Remover todas as fotos do produto"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* Gallery of Uploaded Product Images */}
              {productImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {productImages.map((img, idx) => (
                    <div
                      key={`prod-${idx}`}
                      className="relative group bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 hover:border-amber-500/50 transition-all flex flex-col"
                    >
                      <div
                        onClick={() => setPreviewModalImg(img.dataUrl)}
                        className="w-full aspect-square rounded-md overflow-hidden bg-neutral-950 relative cursor-pointer group/thumb"
                        title="Clique para ampliar"
                      >
                        <img
                          src={img.dataUrl}
                          alt={`Produto ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Eye className="w-4 h-4" />
                        </div>
                        {/* Sequence badge */}
                        <div className="absolute top-1 left-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow ${
                            idx === 0 
                              ? 'bg-amber-500 text-neutral-950 font-black' 
                              : 'bg-black/70 text-neutral-200'
                          }`}>
                            {idx === 0 ? '★ Principal' : `#${idx + 1}`}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400 px-0.5">
                        <span className="truncate max-w-[75px] font-medium" title={img.name}>
                          {img.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProductImage(idx)}
                          className="text-neutral-500 hover:text-red-400 p-0.5 rounded cursor-pointer transition-colors"
                          title="Remover foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add More Photos Tile */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleProductDrop}
                    onClick={() => productInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-800 hover:border-amber-500/60 bg-neutral-900/40 hover:bg-neutral-900/80 rounded-lg aspect-square flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all group"
                  >
                    <div className="w-7 h-7 rounded-full bg-neutral-800 group-hover:bg-amber-500/20 flex items-center justify-center text-neutral-400 group-hover:text-amber-400 mb-1 transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] text-neutral-300 font-medium group-hover:text-amber-300">
                      Adicionar foto
                    </span>
                    <span className="text-[9px] text-neutral-500">
                      Rótulo / Ângulo
                    </span>
                  </div>
                </div>
              )}

              {/* Empty State Dropzone */}
              {productImages.length === 0 && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleProductDrop}
                  onClick={() => productInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-800 hover:border-amber-500/60 bg-neutral-950/60 hover:bg-neutral-900/50 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px]"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 mb-2">
                    <Upload className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-xs text-neutral-200 font-semibold">
                    Adicionar Fotos do Produto
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Arraste uma ou várias fotos (embalagem, frasco, rótulo, textura)
                  </p>
                  <div className="mt-2 text-[10px] text-amber-400/80 bg-amber-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    <span>Suporta múltiplos arquivos simultâneos</span>
                  </div>
                </div>
              )}

              {/* Hidden file input with multiple support */}
              <input
                ref={productInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleProductFilesChange}
                className="hidden"
              />
            </div>

            {/* ================= SLOT 2: MODELO / PERSONAGEM (Múltiplas Fotos) ================= */}
            <div className="flex flex-col bg-neutral-950/40 border border-neutral-800/80 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-semibold text-neutral-200">
                    Fotos da Modelo / Criadora
                  </span>
                  {characterImages.length > 0 && (
                    <span className="text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1.5 py-0.2 rounded">
                      {characterImages.length}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddSampleCharacter}
                    className="text-[11px] text-sky-400/90 hover:text-sky-300 underline cursor-pointer"
                    title="Adicionar modelo de amostra"
                  >
                    + Amostra Modelo
                  </button>
                  {characterImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => updateMediaState(productImages, [], sceneImages)}
                      className="text-[11px] text-neutral-500 hover:text-red-400 cursor-pointer ml-1"
                      title="Remover todas as fotos da modelo"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* Gallery of Uploaded Character Images */}
              {characterImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {characterImages.map((img, idx) => (
                    <div
                      key={`char-${idx}`}
                      className="relative group bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 hover:border-sky-500/50 transition-all flex flex-col"
                    >
                      <div
                        onClick={() => setPreviewModalImg(img.dataUrl)}
                        className="w-full aspect-square rounded-md overflow-hidden bg-neutral-950 relative cursor-pointer group/thumb"
                        title="Clique para ampliar"
                      >
                        <img
                          src={img.dataUrl}
                          alt={`Modelo ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <Eye className="w-4 h-4" />
                        </div>
                        {/* Sequence badge */}
                        <div className="absolute top-1 left-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shadow ${
                            idx === 0 
                              ? 'bg-sky-500 text-neutral-950 font-black' 
                              : 'bg-black/70 text-neutral-200'
                          }`}>
                            {idx === 0 ? '★ Rosto Principal' : `#${idx + 1}`}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-neutral-400 px-0.5">
                        <span className="truncate max-w-[75px] font-medium" title={img.name}>
                          {img.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCharacterImage(idx)}
                          className="text-neutral-500 hover:text-red-400 p-0.5 rounded cursor-pointer transition-colors"
                          title="Remover foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add More Photos Tile */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleCharacterDrop}
                    onClick={() => characterInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-800 hover:border-sky-500/60 bg-neutral-900/40 hover:bg-neutral-900/80 rounded-lg aspect-square flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all group"
                  >
                    <div className="w-7 h-7 rounded-full bg-neutral-800 group-hover:bg-sky-500/20 flex items-center justify-center text-neutral-400 group-hover:text-sky-400 mb-1 transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] text-neutral-300 font-medium group-hover:text-sky-300">
                      Adicionar foto
                    </span>
                    <span className="text-[9px] text-neutral-500">
                      Look / Expressão
                    </span>
                  </div>
                </div>
              )}

              {/* Empty State Dropzone */}
              {characterImages.length === 0 && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleCharacterDrop}
                  onClick={() => characterInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-800 hover:border-sky-500/60 bg-neutral-950/60 hover:bg-neutral-900/50 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px]"
                >
                  <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 mb-2">
                    <Upload className="w-4 h-4 text-sky-400" />
                  </div>
                  <p className="text-xs text-neutral-200 font-semibold">
                    Adicionar Fotos da Modelo / Criadora
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Arraste uma ou várias fotos (rosto, perfil, cabelo, figurino)
                  </p>
                  <div className="mt-2 text-[10px] text-sky-400/80 bg-sky-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    <span>Suporta múltiplos arquivos simultâneos</span>
                  </div>
                </div>
              )}

              {/* Hidden file input with multiple support */}
              <input
                ref={characterInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleCharacterFilesChange}
                className="hidden"
              />
            </div>
          </div>

          {/* ================= OPTIONAL SLOT 3: CENÁRIO / AMBIENTAÇÃO ================= */}
          <div className="border border-neutral-800/60 bg-neutral-950/30 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowSceneSlot(!showSceneSlot)}
                className="flex items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-neutral-100 transition-colors cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span>Referência de Cenário / Ambiente / Moodboard</span>
                <span className="text-[10px] font-normal text-neutral-500">
                  (Opcional • {sceneImages.length} foto{sceneImages.length === 1 ? '' : 's'})
                </span>
                {showSceneSlot ? (
                  <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                )}
              </button>

              {showSceneSlot && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddSampleScene}
                    className="text-[11px] text-emerald-400/90 hover:text-emerald-300 underline cursor-pointer"
                  >
                    + Amostra Cenário
                  </button>
                  {sceneImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => updateMediaState(productImages, characterImages, [])}
                      className="text-[11px] text-neutral-500 hover:text-red-400 cursor-pointer"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}
            </div>

            {showSceneSlot && (
              <div className="mt-3 pt-3 border-t border-neutral-800/60">
                {sceneImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
                    {sceneImages.map((img, idx) => (
                      <div
                        key={`scene-${idx}`}
                        className="relative group bg-neutral-900 border border-neutral-800 rounded-lg p-1.5 hover:border-emerald-500/50 transition-all flex flex-col"
                      >
                        <div
                          onClick={() => setPreviewModalImg(img.dataUrl)}
                          className="w-full aspect-video rounded-md overflow-hidden bg-neutral-950 relative cursor-pointer group/thumb"
                        >
                          <img
                            src={img.dataUrl}
                            alt={`Cenário ${idx + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Eye className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-400 px-0.5">
                          <span className="truncate max-w-[70px]" title={img.name}>
                            {img.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSceneImage(idx)}
                            className="text-neutral-500 hover:text-red-400 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleSceneDrop}
                      onClick={() => sceneInputRef.current?.click()}
                      className="border-2 border-dashed border-neutral-800 hover:border-emerald-500/60 bg-neutral-900/40 rounded-lg aspect-video flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all group"
                    >
                      <Plus className="w-4 h-4 text-neutral-400 group-hover:text-emerald-400 mb-0.5" />
                      <span className="text-[10px] text-neutral-300 group-hover:text-emerald-300">
                        + Foto de Cenário
                      </span>
                    </div>
                  </div>
                )}

                {sceneImages.length === 0 && (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleSceneDrop}
                    onClick={() => sceneInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-800 hover:border-emerald-500/60 bg-neutral-950/40 rounded-lg p-3 text-center cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-neutral-300 font-medium">
                      Clique ou arraste fotos de ambientação, luz ou paleta de cores
                    </span>
                  </div>
                )}

                <input
                  ref={sceneInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleSceneFilesChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Action Button: Run Multimodal Analysis */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-neutral-400 flex items-center gap-1.5">
              {hasBothKeyCategories ? (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Produto ({productImages.length}) e Modelo ({characterImages.length}) prontos para análise multimodal!
                </span>
              ) : totalImagesCount > 0 ? (
                <span className="text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  {totalImagesCount} {totalImagesCount === 1 ? 'referência carregada' : 'referências carregadas'}. Pronto para análise.
                </span>
              ) : (
                <span>Suba uma ou mais fotos para extrair os atributos invariáveis com precisão ótica.</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={totalImagesCount === 0 || isAnalyzing}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isAnalyzing
                  ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed'
                  : totalImagesCount > 0
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20 active:scale-98 font-bold'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Analisando {totalImagesCount} imagens com IA...</span>
                </>
              ) : (
                <>
                  <ScanFace className="w-4 h-4" />
                  <span>
                    {totalImagesCount > 1
                      ? `Analisar ${totalImagesCount} Referências com IA`
                      : totalImagesCount === 1
                      ? 'Analisar Referência com IA'
                      : 'Analisar e Ancorar Consistência'}
                  </span>
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
                  Consistência Multimodal Travada ({totalImagesCount} referências integradas)
                </span>
                <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded font-semibold">
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
