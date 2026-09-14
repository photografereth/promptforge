export type AppMode = 'video' | 'image';

export type AgentType = 'pov' | 'ugc' | 'motion';

export interface ProductAnchor {
  nome: string;
  categoria: string;
  caracteristicasVisuais: string; // Detalhes invariáveis: frasco, material, cor, rótulo, tampa, textura
  beneficioVisual: string; // Ação ou demonstração visual invariável
}

export interface CharacterAnchor {
  nomeOuDescricao: string; // Ex: "Criadora brasileira, ~26 anos, estilo autêntico"
  caracteristicasFisicas: string; // Tom de pele, formato do rosto, traços faciais marcantes
  cabelo: string; // Cor, corte, comprimento, estilo
  estiloVestuario: string; // Roupas características, paleta de cor, estilo
  expressaoMarcante: string; // Expressão espontânea, olhar direto para a lente
}

export interface ReferenceImageItem {
  dataUrl: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface ReferenceMediaState {
  productImage?: ReferenceImageItem | null;
  characterImage?: ReferenceImageItem | null;
  productImages: ReferenceImageItem[];
  characterImages: ReferenceImageItem[];
  sceneImages?: ReferenceImageItem[];
}

export interface TikTokComplianceInfo {
  safeZone: boolean;
  antiClaims: boolean;
  hookPrimeirosSegundos: string;
}

export interface VideoPromptState {
  agent: AgentType;
  product: ProductAnchor;
  character?: CharacterAnchor;
  sujeito: string;
  acao: string;
  cenario: string;
  estilo: string;
  enquadramento: string;
  lente: string;
  iluminacao: string;
  humor: string;
  dialogo: string;
  sfx: string;
  somAmbiente: string;
  evitar: string;
  duracao: '4s' | '6s' | '8s';
  proporcao: '9:16' | '16:9' | '1:1';
  ultraRealista: boolean;
  safeZoneTikTok: boolean;
  tiktokSafeZone?: boolean;
  hookVisual: string;
}

export interface ImagePromptState {
  agent?: AgentType;
  product: ProductAnchor;
  character?: CharacterAnchor;
  sujeito: string;
  acao: string;
  cenario: string;
  estilo: string;
  composicao: string;
  iluminacao: string;
  paleta: string;
  humor: string;
  materiais: string;
  evitar: string;
  proporcao: '9:16' | '16:9' | '1:1' | '4:5';
  ultraRealista: boolean;
  safeZoneTikTok?: boolean;
  isEdit: boolean;
  editMudar: string;
  editManter: string;
}

export interface UserPreferences {
  autoApply: boolean;
  preferredAgent?: AgentType;
  preferredStyle: string;
  preferredPalette: string;
  preferredCamera: string;
}

export interface PromptHistoryItem {
  id: string;
  timestamp: number;
  mode: AppMode;
  agent?: AgentType;
  productName?: string;
  character?: CharacterAnchor;
  ideaUsed?: string;
  deterministicPrompt: string;
  enhancedPrompt?: string;
  title: string;
  videoState?: VideoPromptState;
  imageState?: ImagePromptState;
}
