import React from 'react';
import {
  ChevronDown,
  Camera,
  Sun,
  Smile,
  Volume2,
  Mic,
  SlidersHorizontal,
  Clock,
  Ratio,
  Ban,
  Layers,
  Image as ImageIcon,
  AlertCircle,
  HelpCircle,
  Radio,
  Zap,
  ShieldCheck,
  Film,
} from 'lucide-react';
import { VIDEO_FRAMINGS, VIDEO_LENSES, VIDEO_DURATIONS, VIDEO_RATIOS, IMAGE_RATIOS } from '../data/options';
import { AppMode, VideoPromptState, ImagePromptState } from '../types';

interface MoreDetailsAccordionProps {
  mode: AppMode;
  isOpen: boolean;
  onToggle: () => void;
  videoState: VideoPromptState;
  onVideoStateChange: (key: keyof VideoPromptState, val: any) => void;
  imageState: ImagePromptState;
  onImageStateChange: (key: keyof ImagePromptState, val: any) => void;
}

export const MoreDetailsAccordion: React.FC<MoreDetailsAccordionProps> = ({
  mode,
  isOpen,
  onToggle,
  videoState,
  onVideoStateChange,
  imageState,
  onImageStateChange,
}) => {
  return (
    <div className="bg-neutral-900/90 rounded-2xl border border-neutral-800 shadow-xl overflow-hidden">
      {/* Accordion Header */}
      <button
        id="btn-toggle-more-details"
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-neutral-850/60 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-neutral-200 uppercase tracking-wider">
            Mais detalhes ({mode === 'video' ? 'Câmera, Hook TikTok, Áudio & Safe Zone' : 'Composição, Iluminação & Safe Zone'})
          </span>
          <span className="text-[11px] text-neutral-400 font-normal hidden sm:inline">
            (Padrões otimizados para alta conversão)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-400/90 font-medium">
            {isOpen ? 'Recolher detalhes' : 'Expandir opções avançadas'}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-amber-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {/* Accordion Body */}
      {isOpen && (
        <div className="p-4 sm:p-5 pt-0 border-t border-neutral-800/80 space-y-5 animate-in fade-in duration-200">
          {mode === 'video' ? (
            /* ================= MODE: VIDEO (Omni 1.1 Flash / Veo) ================= */
            <div className="space-y-4 pt-4">
              {/* Hook Visual TikTok & Anti-Rejeição */}
              <div className="p-3.5 bg-amber-500/5 rounded-xl border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-neutral-100">
                      Hook Visual dos Primeiros 2 Segundos (TikTok Shop)
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-mono">Retenção de Feed</span>
                </div>
                <input
                  id="input-video-hook"
                  type="text"
                  value={videoState.hookVisual || ''}
                  onChange={(e) => onVideoStateChange('hookVisual', e.target.value)}
                  placeholder="Ex.: mão puxando o produto em velocidade e desacelerando no centro da tela com foco cirúrgico"
                  className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-xs rounded-lg px-3 py-2 border border-neutral-800 focus:border-amber-400 outline-none"
                />
              </div>

              {/* Safe Zone & Ultra Realista Switches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-neutral-200 block flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Safe Zone TikTok Shop
                    </span>
                    <span className="text-[11px] text-neutral-400 block">
                      Protege carrinho e botões laterais
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onVideoStateChange('safeZoneTikTok', !videoState.safeZoneTikTok)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                      videoState.safeZoneTikTok
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                    }`}
                  >
                    {videoState.safeZoneTikTok ? 'Ativa' : 'Desativada'}
                  </button>
                </div>

                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-neutral-200 block flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-cyan-400" />
                      Vídeo Ultra Realista
                    </span>
                    <span className="text-[11px] text-neutral-400 block">
                      Texturas reais sem look de IA
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onVideoStateChange('ultraRealista', !videoState.ultraRealista)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                      videoState.ultraRealista
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                    }`}
                  >
                    {videoState.ultraRealista ? 'Padronizado' : 'Padrão'}
                  </button>
                </div>
              </div>

              {/* Row 1: Framing & Lens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Enquadramento / Câmera */}
                <div>
                  <label htmlFor="select-enquadramento" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
                    <Camera className="w-3.5 h-3.5 text-amber-400/80" />
                    <span>Enquadramento / Câmera</span>
                  </label>
                  <select
                    id="select-enquadramento"
                    value={videoState.enquadramento}
                    onChange={(e) => onVideoStateChange('enquadramento', e.target.value)}
                    className="w-full bg-neutral-950 text-neutral-100 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all cursor-pointer"
                  >
                    {VIDEO_FRAMINGS.map((fr) => (
                      <option key={fr} value={fr}>
                        {fr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lente / Foco */}
                <div>
                  <label htmlFor="select-lente" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
                    <Radio className="w-3.5 h-3.5 text-amber-400/80" />
                    <span>Lente / Ótica</span>
                  </label>
                  <select
                    id="select-lente"
                    value={videoState.lente}
                    onChange={(e) => onVideoStateChange('lente', e.target.value)}
                    className="w-full bg-neutral-950 text-neutral-100 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all cursor-pointer"
                  >
                    <option value="">Automático pelo Agente</option>
                    {VIDEO_LENSES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Iluminação & Humor/Atmosfera */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="input-video-iluminacao" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
                    <Sun className="w-3.5 h-3.5 text-amber-400/80" />
                    <span>Iluminação física</span>
                  </label>
                  <input
                    id="input-video-iluminacao"
                    type="text"
                    value={videoState.iluminacao}
                    onChange={(e) => onVideoStateChange('iluminacao', e.target.value)}
                    placeholder="luz natural suave"
                    className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="input-video-humor" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
                    <Smile className="w-3.5 h-3.5 text-amber-400/80" />
                    <span>Tom emocional</span>
                  </label>
                  <input
                    id="input-video-humor"
                    type="text"
                    value={videoState.humor}
                    onChange={(e) => onVideoStateChange('humor', e.target.value)}
                    placeholder="natural"
                    className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Row 3: Audio Elements (Diálogo, SFX, Som Ambiente) */}
              <div className="p-3.5 bg-neutral-950/60 rounded-xl border border-neutral-800/80 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Áudio Nativo (Voz, SFX & Ambiente)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="input-video-dialogo" className="block text-[11px] font-medium text-neutral-400 mb-1">
                      Diálogo falado pelo criador
                    </label>
                    <input
                      id="input-video-dialogo"
                      type="text"
                      value={videoState.dialogo}
                      onChange={(e) => onVideoStateChange('dialogo', e.target.value)}
                      placeholder='ex.: Criador diz: "Olha essa textura."'
                      className="w-full bg-neutral-900 text-neutral-100 placeholder-neutral-600 text-xs rounded-lg px-3 py-2 border border-neutral-800 focus:border-amber-500/70 outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="input-video-sfx" className="block text-[11px] font-medium text-neutral-400 mb-1">
                      Efeitos sonoros / SFX do produto
                    </label>
                    <input
                      id="input-video-sfx"
                      type="text"
                      value={videoState.sfx}
                      onChange={(e) => onVideoStateChange('sfx', e.target.value)}
                      placeholder="ex.: clique magnético, spray de névoa"
                      className="w-full bg-neutral-900 text-neutral-100 placeholder-neutral-600 text-xs rounded-lg px-3 py-2 border border-neutral-800 focus:border-amber-500/70 outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="input-video-ambiente" className="block text-[11px] font-medium text-neutral-400 mb-1">
                      Som ambiente
                    </label>
                    <input
                      id="input-video-ambiente"
                      type="text"
                      value={videoState.somAmbiente}
                      onChange={(e) => onVideoStateChange('somAmbiente', e.target.value)}
                      placeholder="ex.: ambiente acústico de quarto moderno"
                      className="w-full bg-neutral-900 text-neutral-100 placeholder-neutral-600 text-xs rounded-lg px-3 py-2 border border-neutral-800 focus:border-amber-500/70 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: O que evitar (TikTok Compliance) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="input-video-evitar" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
                    <Ban className="w-3.5 h-3.5 text-red-400/80" />
                    <span>O que evitar (Políticas TikTok Shop & Artefatos)</span>
                  </label>
                  <span className="text-[11px] text-amber-400/80 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    Sem alegações médicas falsas, sem elementos na barra de compra
                  </span>
                </div>
                <input
                  id="input-video-evitar"
                  type="text"
                  value={videoState.evitar}
                  onChange={(e) => onVideoStateChange('evitar', e.target.value)}
                  placeholder="ex.: sem alegações de cura milagrosa, sem texto cobrindo o carrinho inferior"
                  className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 outline-none transition-all"
                />
              </div>

              {/* Row 5: Duração & Proporção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Duração */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400/80" />
                    <span>Duração do vídeo</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {VIDEO_DURATIONS.map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => onVideoStateChange('duracao', dur)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                          videoState.duracao === dur
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-inner'
                            : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                        }`}
                      >
                        {dur} {dur === '10s' ? '(máx)' : dur === '8s' ? '(ideal)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Proporção */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1.5">
                    <Ratio className="w-3.5 h-3.5 text-amber-400/80" />
                    <span>Proporção de tela</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {VIDEO_RATIOS.map((rat) => (
                      <button
                        key={rat}
                        type="button"
                        onClick={() => onVideoStateChange('proporcao', rat)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          videoState.proporcao === rat
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-inner'
                            : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                        }`}
                      >
                        {rat} {rat === '9:16' ? '(TikTok)' : rat === '16:9' ? '(Wide)' : '(Feed)'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ================= MODE: IMAGE (Nano Banana) ================= */
            <div className="space-y-4 pt-4">
              {/* Extra Section: É edição de imagem existente? */}
              <div className="p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-xs font-semibold text-neutral-200 block">
                        É edição de uma imagem existente?
                      </span>
                      <span className="text-[11px] text-neutral-400 block">
                        Altere apenas aspectos específicos de uma foto de produto
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => onImageStateChange('isEdit', false)}
                      className={`text-xs px-3 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        !imageState.isEdit
                          ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Não (Nova)
                    </button>
                    <button
                      type="button"
                      onClick={() => onImageStateChange('isEdit', true)}
                      className={`text-xs px-3 py-1 rounded-md transition-all cursor-pointer font-medium ${
                        imageState.isEdit
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Sim (Editar)
                    </button>
                  </div>
                </div>

                {imageState.isEdit && (
                  <div className="pt-3 border-t border-neutral-800/80 space-y-3">
                    <div>
                      <label htmlFor="input-edit-mudar" className="block text-xs font-medium text-amber-300 mb-1">
                        O que mudar
                      </label>
                      <input
                        id="input-edit-mudar"
                        type="text"
                        value={imageState.editMudar}
                        onChange={(e) => onImageStateChange('editMudar', e.target.value)}
                        placeholder="ex.: mude o fundo para um banheiro de mármore minimalista"
                        className="w-full bg-neutral-900 text-neutral-100 placeholder-neutral-500 text-xs rounded-lg px-3 py-2 border border-neutral-700 focus:border-amber-400 outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="input-edit-manter" className="block text-xs font-medium text-neutral-300 mb-1">
                        O que manter rigorosamente invariável
                      </label>
                      <input
                        id="input-edit-manter"
                        type="text"
                        value={imageState.editManter}
                        onChange={(e) => onImageStateChange('editManter', e.target.value)}
                        placeholder="mesmo frasco de produto, mesma tipografia do rótulo e mesma cor"
                        className="w-full bg-neutral-900 text-neutral-100 placeholder-neutral-500 text-xs rounded-lg px-3 py-2 border border-neutral-700 focus:border-amber-400 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {!imageState.isEdit && (
                <>
                  {/* Composição / Enquadramento & Iluminação */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="input-img-composicao" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
                        <Camera className="w-3.5 h-3.5 text-amber-400/80" />
                        <span>Composição / Enquadramento</span>
                      </label>
                      <input
                        id="input-img-composicao"
                        type="text"
                        value={imageState.composicao}
                        onChange={(e) => onImageStateChange('composicao', e.target.value)}
                        placeholder="centralizada, espaço livre inferior para TikTok Shop"
                        className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="input-img-iluminacao" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
                        <Sun className="w-3.5 h-3.5 text-amber-400/80" />
                        <span>Iluminação fotográfica</span>
                      </label>
                      <input
                        id="input-img-iluminacao"
                        type="text"
                        value={imageState.iluminacao}
                        onChange={(e) => onImageStateChange('iluminacao', e.target.value)}
                        placeholder="luz natural suave de estúdio"
                        className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Paleta de cores & Humor/Atmosfera */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="input-img-paleta" className="block text-xs font-medium text-neutral-300 mb-1">
                        Paleta de cores
                      </label>
                      <input
                        id="input-img-paleta"
                        type="text"
                        value={imageState.paleta}
                        onChange={(e) => onImageStateChange('paleta', e.target.value)}
                        placeholder="ex.: tons quentes âmbar, dourado e neutros elegantes"
                        className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="input-img-humor" className="block text-xs font-medium text-neutral-300 mb-1">
                        Humor / Atmosfera
                      </label>
                      <input
                        id="input-img-humor"
                        type="text"
                        value={imageState.humor}
                        onChange={(e) => onImageStateChange('humor', e.target.value)}
                        placeholder="desejável e profissional"
                        className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Materiais/Texturas & O que evitar */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="input-img-materiais" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
                        <Layers className="w-3.5 h-3.5 text-amber-400/80" />
                        <span>Materiais e texturas físicas</span>
                      </label>
                      <input
                        id="input-img-materiais"
                        type="text"
                        value={imageState.materiais}
                        onChange={(e) => onImageStateChange('materiais', e.target.value)}
                        placeholder="ex.: vidro translúcido, metal dourado, gotas líquidas"
                        className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label htmlFor="input-img-evitar" className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1">
                        <Ban className="w-3.5 h-3.5 text-red-400/80" />
                        <span>O que evitar (Políticas TikTok Shop)</span>
                      </label>
                      <input
                        id="input-img-evitar"
                        type="text"
                        value={imageState.evitar}
                        onChange={(e) => onImageStateChange('evitar', e.target.value)}
                        placeholder="ex.: sem alegações médicas, sem texto nas bordas"
                        className="w-full bg-neutral-950 text-neutral-100 placeholder-neutral-500 text-sm rounded-xl px-3.5 py-2.5 border border-neutral-800 focus:border-amber-500/70 outline-none transition-all"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Proporção (Image) */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-300 mb-1.5">
                  <Ratio className="w-3.5 h-3.5 text-amber-400/80" />
                  <span>Proporção de aspecto da imagem</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {IMAGE_RATIOS.map((rat) => (
                    <button
                      key={rat}
                      type="button"
                      onClick={() => onImageStateChange('proporcao', rat)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        imageState.proporcao === rat
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-inner'
                          : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                      }`}
                    >
                      {rat} {rat === '9:16' ? '(TikTok)' : rat === '4:5' ? '(Retrato)' : rat === '1:1' ? '(Quadrado)' : '(Wide)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
