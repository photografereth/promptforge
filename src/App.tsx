/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ModeSelector } from './components/ModeSelector';
import { TikTokShopBadge } from './components/TikTokShopBadge';
import { AgentSelector } from './components/AgentSelector';
import { ReferenceUploadSection } from './components/ReferenceUploadSection';
import { ProductAnchorSection } from './components/ProductAnchorSection';
import { QuickFillSection } from './components/QuickFillSection';
import { EssentialSection } from './components/EssentialSection';
import { MoreDetailsAccordion } from './components/MoreDetailsAccordion';
import { PromptOutput } from './components/PromptOutput';
import { PreferencesModal } from './components/PreferencesModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { LandingPage } from './components/LandingPage';
import { CheckoutModal } from './components/CheckoutModal';
import { TikTokWinningCatalog } from './components/TikTokWinningCatalog';
import {
  AppMode,
  AgentType,
  ProductAnchor,
  CharacterAnchor,
  ReferenceMediaState,
  VideoPromptState,
  ImagePromptState,
  UserPreferences,
  PromptHistoryItem,
} from './types';
import { buildVideoPrompt, buildImagePrompt } from './utils/promptBuilder';
import { apiFetch } from './lib/apiFetch';
import { supabase } from './lib/supabaseClient';
import { useSupabaseSession } from './hooks/useSupabaseSession';
import { AlertCircle } from 'lucide-react';

const STORAGE_KEY_PREFS = 'flow_prompt_forge_prefs_v2';
const STORAGE_KEY_HISTORY = 'flow_prompt_forge_history_v2';

const defaultPreferences: UserPreferences = {
  autoApply: false,
  preferredStyle: 'Ultra realista cinematográfico (4K)',
  preferredPalette: '',
  preferredCamera: 'Câmera frontal de smartphone na altura dos olhos',
};

const initialProduct: ProductAnchor = {
  nome: '',
  categoria: '',
  caracteristicasVisuais: '',
  beneficioVisual: '',
};

const initialCharacter: CharacterAnchor = {
  nomeOuDescricao: '',
  caracteristicasFisicas: '',
  cabelo: '',
  estiloVestuario: '',
  expressaoMarcante: '',
};

const initialVideoState: VideoPromptState = {
  agent: 'ugc',
  product: { ...initialProduct },
  character: { ...initialCharacter },
  ultraRealista: true,
  safeZoneTikTok: true,
  hookVisual: '',
  sujeito: '',
  acao: '',
  cenario: '',
  estilo: 'Ultra realista cinematográfico (4K)',
  enquadramento: 'Câmera frontal de smartphone na altura dos olhos',
  lente: 'Profundidade de campo rasa (foco no produto)',
  iluminacao: 'luz natural suave difusa com reflexos autênticos',
  humor: 'espontâneo e confiável',
  dialogo: '',
  sfx: 'som sutil de manuseio e abertura da embalagem',
  somAmbiente: 'ambiente acústico limpo de quarto moderno',
  evitar: 'sem alegações médicas de cura milagrosa, sem promessas enganosas',
  duracao: '8s',
  proporcao: '9:16',
};

const initialImageState: ImagePromptState = {
  product: { ...initialProduct },
  character: { ...initialCharacter },
  ultraRealista: true,
  safeZoneTikTok: true,
  sujeito: '',
  acao: '',
  cenario: 'estúdio minimalista contemporâneo com iluminação suave',
  estilo: 'Fotografia comercial de alta definição (8K)',
  composicao: 'centralizada em 9:16 com safe zone inferior para carrinho do TikTok Shop',
  iluminacao: 'iluminação de estúdio comercial com luz de recorte',
  paleta: 'tons neutros sofisticados',
  humor: 'desejável e autêntico',
  materiais: 'reflexos físicos precisos de vidro e materiais com relevo nítido',
  evitar: 'sem alegações médicas falsas, sem texto cobrindo as margens',
  proporcao: '9:16',
  isEdit: false,
  editMudar: '',
  editManter: '',
};

export default function App() {
  const [mode, setMode] = useState<AppMode>('video');
  const [idea, setIdea] = useState<string>('');
  const [isAutofilling, setIsAutofilling] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reference images state for Product, Character, and Scenes
  const [mediaState, setMediaState] = useState<ReferenceMediaState>({
    productImage: null,
    characterImage: null,
    productImages: [],
    characterImages: [],
    sceneImages: [],
  });

  // States for Video and Image
  const [videoState, setVideoState] = useState<VideoPromptState>(initialVideoState);
  const [imageState, setImageState] = useState<ImagePromptState>(initialImageState);

  // View Routing & Access Control
  const [currentView, setCurrentView] = useState<'landing' | 'app'>('landing');
  const [checkoutPlan, setCheckoutPlan] = useState<'monthly' | 'annual' | null>(null);
  const { session } = useSupabaseSession();
  const isAuthenticated = session !== null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // More details accordion (collapsed by default)
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  // Modals & Drawers
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  // Preferences & History
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      return saved ? JSON.parse(saved) : defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  });

  const [history, setHistory] = useState<PromptHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Enhanced prompt state
  const [enhancedPrompt, setEnhancedPrompt] = useState<string>('');

  const essentialSectionRef = useRef<HTMLDivElement>(null);

  // Save preferences to localStorage
  const handleSavePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(newPrefs));
    } catch (e) {
      console.error(e);
    }
  };

  // Apply preferences
  const applyPreferencesToState = (prefs: UserPreferences) => {
    if (prefs.preferredStyle) {
      setVideoState((prev) => ({ ...prev, estilo: prefs.preferredStyle }));
      setImageState((prev) => ({ ...prev, estilo: prefs.preferredStyle }));
    }
    if (prefs.preferredCamera) {
      setVideoState((prev) => ({ ...prev, enquadramento: prefs.preferredCamera }));
      setImageState((prev) => ({ ...prev, composicao: prefs.preferredCamera }));
    }
    if (prefs.preferredPalette) {
      setImageState((prev) => ({ ...prev, paleta: prefs.preferredPalette }));
    }
  };

  // Initial auto-apply if preference configured
  useEffect(() => {
    if (preferences.autoApply) {
      applyPreferencesToState(preferences);
    }
  }, []);

  // Save history to localStorage
  const saveToHistory = (detPrompt: string, enhPrompt?: string) => {
    if (!detPrompt.trim()) return;

    const currentAgent = videoState.agent || 'ugc';
    const prodName = (mode === 'video' ? videoState.product?.nome : imageState.product?.nome) || '';
    const charName = (mode === 'video' ? videoState.character?.nomeOuDescricao : imageState.character?.nomeOuDescricao) || '';

    const newItem: PromptHistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      mode,
      ideaUsed: idea,
      deterministicPrompt: detPrompt,
      enhancedPrompt: enhPrompt,
      character: mode === 'video' ? videoState.character : imageState.character,
      title: prodName
        ? `${prodName}${charName ? ` ft. ${charName.split(',')[0]}` : ''} (${currentAgent.toUpperCase()})`
        : mode === 'video'
        ? videoState.sujeito || `Cena TikTok Shop (${currentAgent.toUpperCase()})`
        : imageState.sujeito || 'Foto Comercial TikTok Shop',
      videoState: mode === 'video' ? { ...videoState } : undefined,
      imageState: mode === 'image' ? { ...imageState } : undefined,
    };

    setHistory((prev) => {
      const filtered = prev.filter((p) => p.deterministicPrompt !== detPrompt);
      const updated = [newItem, ...filtered].slice(0, 12);
      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  // Compute deterministic prompt based on current mode
  const currentDeterministicPrompt =
    mode === 'video' ? buildVideoPrompt(videoState) : buildImagePrompt(imageState);

  // Field change handlers
  const handleVideoChange = (key: keyof VideoPromptState, val: any) => {
    setVideoState((prev) => ({ ...prev, [key]: val }));
    if (enhancedPrompt) setEnhancedPrompt('');
  };

  const handleImageChange = (key: keyof ImagePromptState, val: any) => {
    setImageState((prev) => ({ ...prev, [key]: val }));
    if (enhancedPrompt) setEnhancedPrompt('');
  };

  // Agent selector handler
  const handleAgentChange = (newAgent: AgentType) => {
    let newEnquadramento = videoState.enquadramento;
    let newLente = videoState.lente;
    let newEstilo = videoState.estilo;
    let newHumor = videoState.humor;

    if (newAgent === 'pov') {
      newEnquadramento = 'Plano detalhe/POV em 1ª pessoa';
      newLente = 'Profundidade de campo rasa (foco no produto)';
      newEstilo = 'POV 1ª pessoa realista (mãos e produto)';
      newHumor = 'sensorial e imersivo';
    } else if (newAgent === 'ugc') {
      newEnquadramento = 'Câmera frontal de smartphone na altura dos olhos';
      newLente = 'Grande angular suave de smartphone';
      newEstilo = 'UGC criador autêntico (smartphone 4K)';
      newHumor = 'espontâneo e confiável';
    } else if (newAgent === 'motion') {
      newEnquadramento = 'Travelling orbital 360° de produto';
      newLente = 'Lente macro comercial (detalhe de textura)';
      newEstilo = 'Comercial de produto dinâmico (360° B-Roll)';
      newHumor = 'sofisticado e de alto impacto';
    }

    setVideoState((prev) => ({
      ...prev,
      agent: newAgent,
      enquadramento: newEnquadramento,
      lente: newLente,
      estilo: newEstilo,
      humor: newHumor,
    }));
    if (enhancedPrompt) setEnhancedPrompt('');
  };

  // Product anchor change handler (syncs across video and image)
  const handleProductChange = (key: keyof ProductAnchor, val: string) => {
    setVideoState((prev) => ({
      ...prev,
      product: { ...prev.product, [key]: val },
    }));
    setImageState((prev) => ({
      ...prev,
      product: { ...prev.product, [key]: val },
    }));
    if (enhancedPrompt) setEnhancedPrompt('');
  };

  // Character anchor change handler (syncs across video and image)
  const handleCharacterChange = (key: keyof CharacterAnchor, val: string) => {
    setVideoState((prev) => ({
      ...prev,
      character: {
        ...(prev.character || initialCharacter),
        [key]: val,
      },
    }));
    setImageState((prev) => ({
      ...prev,
      character: {
        ...(prev.character || initialCharacter),
        [key]: val,
      },
    }));
    if (enhancedPrompt) setEnhancedPrompt('');
  };

  // Preset applied
  const handleApplyProductPreset = (preset: ProductAnchor) => {
    setVideoState((prev) => ({
      ...prev,
      product: { ...preset },
    }));
    setImageState((prev) => ({
      ...prev,
      product: { ...preset },
    }));
    if (enhancedPrompt) setEnhancedPrompt('');
  };

  // Character preset applied
  const handleApplyCharacterPreset = (preset: CharacterAnchor) => {
    setVideoState((prev) => ({
      ...prev,
      character: { ...preset },
    }));
    setImageState((prev) => ({
      ...prev,
      character: { ...preset },
    }));
    if (enhancedPrompt) setEnhancedPrompt('');
  };

  // Winning Product injection handler (Etapa 1: 1-Clique)
  const handleInjectWinningProduct = (
    product: ProductAnchor,
    agentScenario: {
      sujeito: string;
      acao: string;
      cenario: string;
      hookVisual: string;
      suggestedAgent?: AgentType;
    }
  ) => {
    const targetAgent = agentScenario.suggestedAgent || videoState.agent;

    setVideoState((prev) => ({
      ...prev,
      product: { ...product },
      sujeito: agentScenario.sujeito,
      acao: agentScenario.acao,
      cenario: agentScenario.cenario,
      hookVisual: agentScenario.hookVisual,
      agent: targetAgent,
    }));

    setImageState((prev) => ({
      ...prev,
      product: { ...product },
      sujeito: agentScenario.sujeito,
      acao: agentScenario.acao,
      cenario: agentScenario.cenario,
    }));

    if (agentScenario.suggestedAgent) {
      handleAgentChange(agentScenario.suggestedAgent);
    }

    if (enhancedPrompt) setEnhancedPrompt('');

    // Smooth scroll down to agent and product anchor
    if (essentialSectionRef.current) {
      essentialSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Handler for Multimodal Analysis success (Product & Model references)
  const handleAnalysisSuccess = (result: {
    product: ProductAnchor;
    character: CharacterAnchor;
    scene: any;
    consistencySummary: string;
  }) => {
    // 1. Update Product
    if (result.product) {
      setVideoState((prev) => ({
        ...prev,
        product: {
          nome: result.product.nome || prev.product.nome,
          categoria: result.product.categoria || prev.product.categoria,
          caracteristicasVisuais:
            result.product.caracteristicasVisuais || prev.product.caracteristicasVisuais,
          beneficioVisual: result.product.beneficioVisual || prev.product.beneficioVisual,
        },
      }));
      setImageState((prev) => ({
        ...prev,
        product: {
          nome: result.product.nome || prev.product.nome,
          categoria: result.product.categoria || prev.product.categoria,
          caracteristicasVisuais:
            result.product.caracteristicasVisuais || prev.product.caracteristicasVisuais,
          beneficioVisual: result.product.beneficioVisual || prev.product.beneficioVisual,
        },
      }));
    }

    // 2. Update Character
    if (result.character) {
      setVideoState((prev) => ({
        ...prev,
        character: {
          nomeOuDescricao:
            result.character.nomeOuDescricao || prev.character?.nomeOuDescricao || '',
          caracteristicasFisicas:
            result.character.caracteristicasFisicas || prev.character?.caracteristicasFisicas || '',
          cabelo: result.character.cabelo || prev.character?.cabelo || '',
          estiloVestuario:
            result.character.estiloVestuario || prev.character?.estiloVestuario || '',
          expressaoMarcante:
            result.character.expressaoMarcante || prev.character?.expressaoMarcante || '',
        },
      }));
      setImageState((prev) => ({
        ...prev,
        character: {
          nomeOuDescricao:
            result.character.nomeOuDescricao || prev.character?.nomeOuDescricao || '',
          caracteristicasFisicas:
            result.character.caracteristicasFisicas || prev.character?.caracteristicasFisicas || '',
          cabelo: result.character.cabelo || prev.character?.cabelo || '',
          estiloVestuario:
            result.character.estiloVestuario || prev.character?.estiloVestuario || '',
          expressaoMarcante:
            result.character.expressaoMarcante || prev.character?.expressaoMarcante || '',
        },
      }));
    }

    // 3. Update Scene Details
    if (result.scene) {
      const sc = result.scene;
      if (mode === 'video') {
        setVideoState((prev) => ({
          ...prev,
          sujeito: sc.sujeito || prev.sujeito,
          acao: sc.acao || prev.acao,
          cenario: sc.cenario || prev.cenario,
          estilo: sc.estilo || prev.estilo,
          enquadramento: sc.enquadramento || prev.enquadramento,
          lente: sc.lente || prev.lente,
          iluminacao: sc.iluminacao || prev.iluminacao,
          humor: sc.humor || prev.humor,
          dialogo: sc.dialogo || prev.dialogo,
          sfx: sc.sfx || prev.sfx,
          somAmbiente: sc.somAmbiente || prev.somAmbiente,
          hookVisual: sc.hookVisual || prev.hookVisual,
          evitar: sc.evitar || prev.evitar,
        }));
      } else {
        setImageState((prev) => ({
          ...prev,
          sujeito: sc.sujeito || prev.sujeito,
          acao: sc.acao || prev.acao,
          cenario: sc.cenario || prev.cenario,
          estilo: sc.estilo || prev.estilo,
          composicao: sc.enquadramento || sc.composicao || prev.composicao,
          iluminacao: sc.iluminacao || prev.iluminacao,
          paleta: sc.paleta || prev.paleta,
          humor: sc.humor || prev.humor,
          materiais: sc.materiais || prev.materiais,
          evitar: sc.evitar || prev.evitar,
        }));
      }
    }

    // 4. Update Idea description
    const descParts = [
      result.product?.nome ? `Produto: ${result.product.nome}` : '',
      result.character?.nomeOuDescricao ? `Modelo: ${result.character.nomeOuDescricao}` : '',
    ].filter(Boolean);
    if (descParts.length > 0) {
      setIdea(`Análise Multimodal TikTok Shop: ${descParts.join(' | ')}`);
    }

    // 5. Generate prompt immediately and record in history
    setTimeout(() => {
      const newDet =
        mode === 'video'
          ? buildVideoPrompt(videoState)
          : buildImagePrompt(imageState);
      saveToHistory(newDet);
    }, 150);
  };

  // QuickFill with Gemini API (calibrated with Agent, Product Anchor, and Ultra-Realistic standardization)
  const handleAutofillAI = async () => {
    if (!idea.trim()) return;
    setIsAutofilling(true);
    setErrorMessage(null);

    const currentAgent = videoState.agent || 'ugc';
    const currentProduct = mode === 'video' ? videoState.product : imageState.product;

    try {
      const response = await apiFetch('/api/autofill', {
        method: 'POST',
        body: JSON.stringify({
          idea,
          mode,
          agent: currentAgent,
          product: currentProduct,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro do servidor (${response.status})`);
      }

      const resJson = await response.json();
      const data = resJson.data || {};

      if (mode === 'video') {
        setVideoState((prev) => ({
          ...prev,
          sujeito: data.sujeito ?? prev.sujeito,
          acao: data.acao ?? prev.acao,
          cenario: data.cenario ?? prev.cenario,
          estilo: data.estilo ?? prev.estilo,
          enquadramento: data.enquadramento ?? prev.enquadramento,
          lente: data.lente ?? prev.lente,
          iluminacao: data.iluminacao ?? prev.iluminacao,
          humor: data.humor ?? prev.humor,
          dialogo: data.dialogo ?? prev.dialogo,
          sfx: data.sfx ?? prev.sfx,
          somAmbiente: data.somAmbiente ?? prev.somAmbiente,
          hookVisual: data.hookVisual ?? prev.hookVisual,
          evitar: data.evitar ?? prev.evitar,
          duracao: data.duracao ?? prev.duracao,
          proporcao: data.proporcao ?? prev.proporcao,
        }));
      } else {
        setImageState((prev) => ({
          ...prev,
          sujeito: data.sujeito ?? prev.sujeito,
          acao: data.acao ?? prev.acao,
          cenario: data.cenario ?? prev.cenario,
          estilo: data.estilo ?? prev.estilo,
          composicao: data.composicao ?? prev.composicao,
          iluminacao: data.iluminacao ?? prev.iluminacao,
          paleta: data.paleta ?? prev.paleta,
          humor: data.humor ?? prev.humor,
          materiais: data.materiais ?? prev.materiais,
          evitar: data.evitar ?? prev.evitar,
          proporcao: data.proporcao ?? prev.proporcao,
          isEdit: Boolean(data.isEdit),
          editMudar: data.editMudar ?? prev.editMudar,
          editManter: data.editManter ?? prev.editManter,
        }));
      }

      // Automatically generate prompt into history
      setTimeout(() => {
        const newDet =
          mode === 'video'
            ? buildVideoPrompt({
                ...videoState,
                sujeito: data.sujeito ?? videoState.sujeito,
                acao: data.acao ?? videoState.acao,
                cenario: data.cenario ?? videoState.cenario,
                estilo: data.estilo ?? videoState.estilo,
                hookVisual: data.hookVisual ?? videoState.hookVisual,
              })
            : buildImagePrompt({
                ...imageState,
                sujeito: data.sujeito ?? imageState.sujeito,
                acao: data.acao ?? imageState.acao,
                cenario: data.cenario ?? imageState.cenario,
                estilo: data.estilo ?? imageState.estilo,
              });
        saveToHistory(newDet);
      }, 100);
    } catch (err: any) {
      console.error('Falha ao preencher com IA:', err);
      setErrorMessage(
        err.message || 'Não foi possível preencher automaticamente. Tente novamente ou preencha manualmente.'
      );
    } finally {
      setIsAutofilling(false);
    }
  };

  // Enhance prompt with Gemini API
  const handleEnhancePrompt = async () => {
    if (!currentDeterministicPrompt.trim()) return;
    setIsEnhancing(true);
    setErrorMessage(null);

    const currentAgent = videoState.agent || 'ugc';
    const currentProduct = mode === 'video' ? videoState.product : imageState.product;

    try {
      const response = await apiFetch('/api/enhance', {
        method: 'POST',
        body: JSON.stringify({
          prompt: currentDeterministicPrompt,
          mode,
          agent: currentAgent,
          product: currentProduct,
          meta: mode === 'video' ? videoState : imageState,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro do servidor (${response.status})`);
      }

      const resJson = await response.json();
      const enhanced = resJson.enhancedPrompt || '';
      setEnhancedPrompt(enhanced);

      // Save enhanced version to history
      saveToHistory(currentDeterministicPrompt, enhanced);
    } catch (err: any) {
      console.error('Falha ao aprimorar prompt:', err);
      setErrorMessage(
        err.message || 'Não foi possível aprimorar o prompt com Gemini. O prompt determinístico continua 100% funcional!'
      );
    } finally {
      setIsEnhancing(false);
    }
  };

  // Clear form
  const handleClearForm = () => {
    setIdea('');
    setEnhancedPrompt('');
    setErrorMessage(null);

    if (mode === 'video') {
      const resetVideo = {
        ...initialVideoState,
        product: { ...initialProduct },
      };
      setVideoState(resetVideo);
    } else {
      const resetImage = {
        ...initialImageState,
        product: { ...initialProduct },
      };
      setImageState(resetImage);
    }
  };

  // Jump smoothly to manual form
  const handleJumpToManual = () => {
    const el = document.getElementById('section-essential');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Load an item from history
  const handleLoadHistoryItem = (item: PromptHistoryItem) => {
    setMode(item.mode);
    if (item.ideaUsed) setIdea(item.ideaUsed);
    if (item.videoState) setVideoState(item.videoState);
    if (item.imageState) setImageState(item.imageState);
    if (item.enhancedPrompt) setEnhancedPrompt(item.enhancedPrompt);
    else setEnhancedPrompt('');
  };

  // Delete history item
  const handleDeleteHistoryItem = (id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Clear all history
  const handleClearAllHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
    } catch (e) {
      console.error(e);
    }
  };

  const activeProduct = mode === 'video' ? videoState.product : imageState.product;
  const activeCharacter = mode === 'video' ? videoState.character : imageState.character;

  // 1. Landing Page View
  if (currentView === 'landing') {
    return (
      <>
        <LandingPage
          onEnterApp={() => setCurrentView('app')}
          onSelectPlan={(plan) => setCheckoutPlan(plan)}
        />
        <CheckoutModal
          isOpen={checkoutPlan !== null}
          plan={checkoutPlan || 'annual'}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => {
            setCheckoutPlan(null);
            setCurrentView('app');
          }}
        />
      </>
    );
  }

  // 2. Application Workbench View
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Access & License Status Ribbon */}
      <div className="border-b border-neutral-800/80 bg-neutral-900/90 px-4 py-1.5 text-xs text-neutral-400">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-300">
              {isAuthenticated ? (
                <span className="text-emerald-400 font-bold">[ LICENÇA PESSOAL ATIVA • SESSÃO PROTEGIDA ]</span>
              ) : (
                <span className="text-amber-400 font-bold">[ MODO DEMONSTRAÇÃO • SESSÃO LOCAL ]</span>
              )}
            </span>
            <span className="hidden md:inline font-mono text-[10px] text-neutral-400">
              OMNI 1.1 FLASH & VEO (ATÉ 10S) • 3 AGENTES TIKTOK SHOP
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => setCheckoutPlan('annual')}
                className="font-mono text-[11px] font-bold text-amber-400 hover:text-amber-300 uppercase underline cursor-pointer"
              >
                [ ASSINAR LICENÇA EXCLUSIVA ]
              </button>
            )}
            <button
              type="button"
              onClick={() => setCurrentView('landing')}
              className="font-mono text-[11px] text-neutral-300 hover:text-white uppercase transition-colors cursor-pointer"
            >
              [ VER LANDING PAGE & PLANOS ]
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenLanding={() => setCurrentView('landing')}
        historyCount={history.length}
        hasAutoPreferences={preferences.autoApply}
        userEmail={session?.user?.email}
        onLogout={handleLogout}
      />

      {/* Mode Selector */}
      <ModeSelector
        mode={mode}
        onModeChange={(newMode) => {
          setMode(newMode);
          setEnhancedPrompt('');
          setErrorMessage(null);
        }}
      />

      {/* TikTok Shop Compliance Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full pt-1 pb-1">
        <TikTokShopBadge
          safeZoneActive={mode === 'video' ? videoState.safeZoneTikTok : imageState.safeZoneTikTok}
          ultraRealistaActive={mode === 'video' ? videoState.ultraRealista : imageState.ultraRealista}
        />
      </div>

      {/* Global Error Banner if any */}
      {errorMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full pt-2">
          <div className="p-3 bg-red-950/70 border border-red-800/80 rounded-xl flex items-center justify-between gap-3 text-red-200 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-300 hover:text-red-100 text-xs underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout (stacked on mobile) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* 🔥 TIKTOK SHOP WINNING PRODUCTS CATALOG (ETAPA 1: 1-CLIQUE) */}
        <div className="mb-6">
          <TikTokWinningCatalog
            currentAgent={videoState.agent}
            onInjectProduct={handleInjectWinningProduct}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form & Controls (7 cols on desktop) */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. 3 Agents Selector (POV, UGC, Motion) */}
            <AgentSelector
              selectedAgent={videoState.agent}
              onAgentChange={handleAgentChange}
            />

            {/* 2. Reference Images Upload (Product & Character/Model) */}
            <ReferenceUploadSection
              mediaState={mediaState}
              onMediaStateChange={setMediaState}
              product={activeProduct}
              character={activeCharacter}
              agent={videoState.agent}
              mode={mode}
              onAnalysisSuccess={handleAnalysisSuccess}
            />

            {/* 3. Consistency Anchors (Product & Character) */}
            <ProductAnchorSection
              product={activeProduct}
              character={activeCharacter}
              onChange={handleProductChange}
              onCharacterChange={handleCharacterChange}
              onApplyPreset={handleApplyProductPreset}
              onApplyCharacterPreset={handleApplyCharacterPreset}
            />

            {/* 4. Quick Fill Flow (with Active Agent & Product Anchor) */}
            <QuickFillSection
              idea={idea}
              onIdeaChange={setIdea}
              onAutofill={handleAutofillAI}
              isLoading={isAutofilling}
              mode={mode}
              agent={videoState.agent}
              product={activeProduct}
              onJumpToManual={handleJumpToManual}
            />

            {/* 4. Essential Section (4 main fields, always visible) */}
            <div ref={essentialSectionRef}>
              <EssentialSection
                mode={mode}
                agent={videoState.agent}
                product={activeProduct}
                sujeito={mode === 'video' ? videoState.sujeito : imageState.sujeito}
                onSujeitoChange={(val) =>
                  mode === 'video' ? handleVideoChange('sujeito', val) : handleImageChange('sujeito', val)
                }
                acao={mode === 'video' ? videoState.acao : imageState.acao}
                onAcaoChange={(val) =>
                  mode === 'video' ? handleVideoChange('acao', val) : handleImageChange('acao', val)
                }
                cenario={mode === 'video' ? videoState.cenario : imageState.cenario}
                onCenarioChange={(val) =>
                  mode === 'video' ? handleVideoChange('cenario', val) : handleImageChange('cenario', val)
                }
                estilo={mode === 'video' ? videoState.estilo : imageState.estilo}
                onEstiloChange={(val) =>
                  mode === 'video' ? handleVideoChange('estilo', val) : handleImageChange('estilo', val)
                }
              />
            </div>

            {/* 5. More Details Section (Accordion, collapsed by default) */}
            <MoreDetailsAccordion
              mode={mode}
              isOpen={isDetailsOpen}
              onToggle={() => setIsDetailsOpen(!isDetailsOpen)}
              videoState={videoState}
              onVideoStateChange={handleVideoChange}
              imageState={imageState}
              onImageStateChange={handleImageChange}
            />
          </div>

          {/* Right Column: Output & Generation (5 cols on desktop, sticky) */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
            <PromptOutput
              mode={mode}
              agent={videoState.agent}
              product={activeProduct}
              character={activeCharacter}
              deterministicPrompt={currentDeterministicPrompt}
              enhancedPrompt={enhancedPrompt}
              isEnhancing={isEnhancing}
              onGenerate={() => saveToHistory(currentDeterministicPrompt)}
              onEnhance={handleEnhancePrompt}
              onClear={handleClearForm}
              hasInput={Boolean(
                (mode === 'video' ? videoState.sujeito : imageState.sujeito) ||
                  activeProduct.nome ||
                  idea
              )}
            />
          </div>
        </div>
      </main>

      {/* Preferences Modal (Meus Padrões ⚙️) */}
      <PreferencesModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onSavePreferences={handleSavePreferences}
        onApplyToCurrent={() => applyPreferencesToState(preferences)}
      />

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onLoadItem={handleLoadHistoryItem}
        onDeleteItem={handleDeleteHistoryItem}
        onClearHistory={handleClearAllHistory}
      />

      {/* Checkout / Subscription Modal */}
      <CheckoutModal
        isOpen={checkoutPlan !== null}
        plan={checkoutPlan || 'annual'}
        onClose={() => setCheckoutPlan(null)}
        onSuccess={() => {
          setCheckoutPlan(null);
        }}
      />
    </div>
  );
}
