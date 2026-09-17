import React, { useState, useRef } from 'react';
import {
  Link2,
  X,
  Upload,
  Loader2,
  Sparkles,
  Check,
  AlertCircle,
  Image as ImageIcon,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { TikTokWinningProduct } from '../types';

interface ImportProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductImported: (product: TikTokWinningProduct, autoInject?: boolean) => void;
}

export const ImportProductModal: React.FC<ImportProductModalProps> = ({
  isOpen,
  onClose,
  onProductImported,
}) => {
  const [url, setUrl] = useState<string>('');
  const [rawNotes, setRawNotes] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ data: string; mimeType: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<TikTokWinningProduct | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      setImageData({
        data: result,
        mimeType: file.type,
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Insira o link real do produto ou do vídeo do TikTok Shop.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/parse-product-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          rawNotes: rawNotes.trim() || undefined,
          image: imageData || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Falha ao analisar os dados do produto.');
      }

      setParsedResult(data.product);
    } catch (err: any) {
      setError(err.message || 'Erro de conexão ao processar o link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = (autoInject: boolean) => {
    if (parsedResult) {
      onProductImported(parsedResult, autoInject);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setUrl('');
    setRawNotes('');
    setImagePreview(null);
    setImageData(null);
    setError(null);
    setParsedResult(null);
    setIsLoading(false);
  };

  return (
    <div
      id="import-product-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="import-product-modal-container"
        className="bg-neutral-900 border border-amber-500/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-amber-950/30 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-500/15 via-neutral-900 to-neutral-900 p-4 sm:p-5 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-mono text-[10px] tracking-widest uppercase bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-400/30">
                PRODUTO REAL TIKTOK SHOP
              </span>
              <h3 className="text-base font-bold text-neutral-100 mt-0.5">
                Importar via Link Real de Produto
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-1.5 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {!parsedResult ? (
            <>
              {/* Info notice */}
              <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  Cole qualquer link oficial do TikTok Shop, vídeo de criador, Shopee ou e-commerce. O Gemini extrai a <strong className="text-amber-400">geometria da embalagem</strong>, materiais reais e gera os roteiros prontos para os 3 agentes.
                </p>
              </div>

              {/* URL Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-neutral-300 font-bold">
                  Link Real do Produto ou Vídeo <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    id="input-real-product-url"
                    placeholder="Ex: https://shop.tiktok.com/view/product/... ou https://www.tiktok.com/@loja/video/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors"
                    disabled={isLoading}
                  />
                </div>
                <p className="text-[11px] text-neutral-500">
                  Aceita links diretos do TikTok Shop, deep links, vídeos com sacola de compra ou lojas parceiras.
                </p>
              </div>

              {/* Optional Notes / Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-neutral-400">
                  Observações ou Nome do Produto <span className="text-neutral-500">(Opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sérum Niacinamida 30ml frasco fosco com tampa conta-gotas branca"
                  value={rawNotes}
                  onChange={(e) => setRawNotes(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none transition-colors"
                  disabled={isLoading}
                />
              </div>

              {/* Optional Screenshot upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-neutral-400 flex items-center justify-between">
                  <span>Print da Página / Foto da Embalagem</span>
                  <span className="text-neutral-500 text-[10px]">Opcional (Aumenta a precisão)</span>
                </label>

                {imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-neutral-700 bg-neutral-950 p-2 flex items-center gap-3">
                    <img
                      src={imagePreview}
                      alt="Referência"
                      className="w-16 h-16 object-cover rounded-lg border border-neutral-800"
                    />
                    <div className="flex-1 text-xs text-neutral-300">
                      <p className="font-semibold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Imagem carregada
                      </p>
                      <p className="text-neutral-400 text-[11px] mt-0.5">
                        A IA irá escanear a etiqueta e o formato exato do frasco.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setImageData(null);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-800 hover:border-amber-500/50 bg-neutral-950/50 hover:bg-neutral-950 rounded-xl p-4 text-center cursor-pointer transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleImageUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="flex flex-col items-center justify-center gap-1.5 text-neutral-400">
                      <Upload className="w-5 h-5 text-neutral-500" />
                      <p className="text-xs">
                        Arraste ou <span className="text-amber-400 font-semibold underline">clique para anexar</span> um print da sacola ou embalagem
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="button"
                  id="btn-process-product-url"
                  disabled={isLoading || !url.trim()}
                  onClick={handleAnalyze}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-950/40 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Analisando Link Real & Criando Âncoras...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analisar Link & Ancorar Produto</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Result Confirmation Card */
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Produto estruturado com sucesso!</strong> Todas as características físicas invariáveis e roteiros dos 3 agentes foram criados.
                </span>
              </div>

              {/* Product Details Card */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                  <div>
                    <span className="font-mono text-[10px] text-amber-400 uppercase bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                      {parsedResult.category}
                    </span>
                    <h4 className="text-sm font-bold text-neutral-100 mt-1">
                      {parsedResult.name}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-emerald-400 font-bold block">
                      {parsedResult.commissionValue}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      Preço: {parsedResult.ticketPrice}
                    </span>
                  </div>
                </div>

                {/* Visual Consistency Anchor */}
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-neutral-400 uppercase font-bold">
                    Âncora Física Invariável:
                  </span>
                  <p className="text-xs text-neutral-300 bg-neutral-900/90 p-2.5 rounded-lg border border-neutral-800 leading-relaxed">
                    {parsedResult.productAnchor.caracteristicasVisuais}
                  </p>
                </div>

                {/* Visual Benefit */}
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-neutral-400 uppercase font-bold">
                    Benefício Visual (Sem alegações médicas):
                  </span>
                  <p className="text-xs text-neutral-300 bg-neutral-900/90 p-2.5 rounded-lg border border-neutral-800 leading-relaxed">
                    {parsedResult.productAnchor.beneficioVisual}
                  </p>
                </div>

                {/* 3 Agents Preview Snippets */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                    <span className="font-mono text-[9px] uppercase font-bold text-cyan-400 block mb-0.5">
                      POV (1ª Pessoa)
                    </span>
                    <p className="text-neutral-400 line-clamp-2">
                      {parsedResult.suggestedHooks.pov}
                    </p>
                  </div>
                  <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                    <span className="font-mono text-[9px] uppercase font-bold text-emerald-400 block mb-0.5">
                      UGC (Criador)
                    </span>
                    <p className="text-neutral-400 line-clamp-2">
                      {parsedResult.suggestedHooks.ugc}
                    </p>
                  </div>
                  <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                    <span className="font-mono text-[9px] uppercase font-bold text-amber-400 block mb-0.5">
                      Movimento (B-Roll)
                    </span>
                    <p className="text-neutral-400 line-clamp-2">
                      {parsedResult.suggestedHooks.motion}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirm(false)}
                  className="w-full sm:w-1/2 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono uppercase rounded-xl border border-neutral-700 transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Salvar no Catálogo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirm(true)}
                  className="w-full sm:w-1/2 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 text-xs font-bold font-mono uppercase rounded-xl transition-all shadow-lg shadow-amber-950/30 cursor-pointer"
                >
                  <span>Injetar Imediatamente</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
