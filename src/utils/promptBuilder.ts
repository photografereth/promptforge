import { VideoPromptState, ImagePromptState } from '../types';

/**
 * Construtor de prompts de vídeo especializados para o Veo 3
 * Padronizado para Vídeo Ultra Realista, com suporte aos 3 Agentes:
 * - POV (Ponto de Vista em 1ª pessoa)
 * - UGC (Criador autêntico / Social Proof)
 * - Movimento (B-Roll Dinâmico & Comercial de Produto)
 * Incorporando Consistência de Produto Inegociável e Políticas do TikTok Shop
 */
export function buildVideoPrompt(state: VideoPromptState): string {
  const { agent, product, ultraRealista } = state;
  const enquadramento = state.enquadramento.trim() || getDefaultCameraForAgent(agent);
  const sujeito = state.sujeito.trim() || getDefaultSubjectForAgent(agent, product.nome);
  const acao = state.acao.trim() || getDefaultActionForAgent(agent);
  const contexto = state.cenario.trim() || getDefaultScenarioForAgent(agent);
  const iluminacao = state.iluminacao.trim() || getDefaultLightingForAgent(agent);
  const humor = state.humor.trim() || 'autêntico e envolvente';
  const lentePart = state.lente.trim() ? `, lente ${state.lente.trim()}` : '';

  // Prefixo de estilo: sempre padronizado para Ultra Realista
  const estiloUltra = ultraRealista
    ? 'Filme ultra realista em 4K, textura orgânica com detalhes táteis nítidos, iluminação física natural, sem artefatos plásticos ou distorções'
    : state.estilo.trim() || 'Cinematográfico realista';

  // Bloco de Identidade e Consistência do Produto
  let blocoProduto = '';
  if (product.nome.trim()) {
    blocoProduto = `\n[CONSISTÊNCIA DE PRODUTO INVARIÁVEL: ${product.nome.trim()}`;
    if (product.categoria.trim()) {
      blocoProduto += ` | Categoria: ${product.categoria.trim()}`;
    }
    if (product.caracteristicasVisuais.trim()) {
      blocoProduto += ` | Detalhes físicos da embalagem e item: ${product.caracteristicasVisuais.trim()}`;
    }
    if (product.beneficioVisual.trim()) {
      blocoProduto += ` | Ação visual do produto: ${product.beneficioVisual.trim()}`;
    }
    blocoProduto += `]`;
  }

  // Bloco de Consistência do Personagem / Modelo
  let blocoPersonagem = '';
  if (state.character && (state.character.nomeOuDescricao?.trim() || state.character.caracteristicasFisicas?.trim())) {
    blocoPersonagem = `\n[CONSISTÊNCIA DO PERSONAGEM/CRIADOR INVARIÁVEL: ${state.character.nomeOuDescricao?.trim() || 'Modelo/Criador de referência'}`;
    if (state.character.caracteristicasFisicas?.trim()) {
      blocoPersonagem += ` | Traços faciais e físicos: ${state.character.caracteristicasFisicas.trim()}`;
    }
    if (state.character.cabelo?.trim()) {
      blocoPersonagem += ` | Cabelo: ${state.character.cabelo.trim()}`;
    }
    if (state.character.estiloVestuario?.trim()) {
      blocoPersonagem += ` | Figurino: ${state.character.estiloVestuario.trim()}`;
    }
    if (state.character.expressaoMarcante?.trim()) {
      blocoPersonagem += ` | Expressão/Presença: ${state.character.expressaoMarcante.trim()}`;
    }
    blocoPersonagem += ` - Mantenha a mesma pessoa física idêntica em todos os cortes e planos]`;
  }

  // Montagem especializada por Agente
  let corePrompt = '';

  if (agent === 'pov') {
    // AGENTE POV: Perspectiva em 1ª pessoa, visão subjetiva dos olhos do criador
    corePrompt = `Vídeo ultra realista em perspectiva POV (ponto de vista em 1ª pessoa). Câmera subjetiva na altura dos olhos, ${enquadramento}. ${sujeito}, ${acao}, ${contexto}. O foco principal e nítido está na interação física das mãos com o produto, com profundidade de campo sutil. A cena é iluminada por ${iluminacao}. Estilo: ${estiloUltra}, com atmosfera ${humor}${lentePart}.`;
  } else if (agent === 'ugc') {
    // AGENTE UGC: Estilo criador autêntico de TikTok Shop
    const hook = state.hookVisual?.trim()
      ? `Hook nos primeiros 2 segundos: ${state.hookVisual.trim()}. `
      : '';
    corePrompt = `Vídeo ultra realista no estilo UGC (conteúdo autêntico de criador do TikTok Shop). ${hook}Gravado em smartphone topo de linha com fidelidade óptica real, ${enquadramento}. ${sujeito}, ${acao}, ${contexto}. Expressões espontâneas e demonstração de uso real sem parecer anúncio engessado. A iluminação é ${iluminacao}. Estilo: ${estiloUltra}, com energia ${humor}${lentePart}.`;
  } else {
    // AGENTE MOVIMENTO: B-Roll comercial dinâmico e cinematografia de produto
    corePrompt = `Vídeo comercial ultra realista de produto com movimento dinâmico. ${enquadramento} com movimento de câmera fluido e preciso ao redor do produto. ${sujeito}, ${acao}, ${contexto}. Destaque cinematográfico para as texturas dos materiais, reflexos volumétricos e acabamento físico. A iluminação é ${iluminacao}. Estilo: ${estiloUltra}, com atmosfera ${humor}${lentePart}.`;
  }

  // Incorporar bloco de produto e personagem
  if (blocoProduto) {
    corePrompt += blocoProduto;
  }
  if (blocoPersonagem) {
    corePrompt += blocoPersonagem;
  }

  const extraLines: string[] = [];

  // Diálogo / Fala
  if (state.dialogo.trim()) {
    const rawDialogo = state.dialogo.trim();
    if (rawDialogo.includes('"') || rawDialogo.includes('“')) {
      extraLines.push(rawDialogo);
    } else {
      extraLines.push(`Criador diz de forma natural: "${rawDialogo}"`);
    }
  }

  // SFX e Som
  if (state.sfx.trim()) {
    extraLines.push(`SFX: ${state.sfx.trim()}`);
  }
  if (state.somAmbiente.trim()) {
    extraLines.push(`Som ambiente: ${state.somAmbiente.trim()}`);
  }

  // Políticas do TikTok Shop & O que Evitar
  const tiktokRules = [
    'sem promessas médicas ou curas milagrosas',
    'sem claims falsos ou exagerados',
    'área inferior e lateral direita limpas (Safe Zone do TikTok Shop para sacola de compras e botões)',
  ];

  const userEvitar = state.evitar.trim();
  const evitarCompleto = userEvitar
    ? `${userEvitar}, ${tiktokRules.join(', ')}`
    : tiktokRules.join(', ');

  extraLines.push(`Evite estritamente: ${evitarCompleto}, sem distorções de IA ou texto poluído`);

  if (extraLines.length > 0) {
    corePrompt += '\n' + extraLines.join('\n');
  }

  // Metadados técnicos finais
  const duracao = state.duracao || '8s';
  const proporcao = state.proporcao || '9:16';
  corePrompt += `\n\n[Duração: ${duracao} | Proporção: ${proporcao} | Safe Zone TikTok Shop: Ativa | Modo: Ultra Realista]`;

  return corePrompt;
}

/**
 * Construtor de prompts de imagem determinísticos para o Nano Banana (Gemini 2.5 Flash Image)
 * Padronizado para Imagem Ultra Realista com Consistência de Produto
 */
export function buildImagePrompt(state: ImagePromptState): string {
  const { agent, product, ultraRealista } = state;

  if (state.isEdit) {
    const mudar = state.editMudar.trim() || '[descreva a alteração desejada]';
    const manter =
      state.editManter.trim() ||
      `o mesmo produto (${product.nome || 'produto original'}), mesma iluminação e embalagem idêntica`;
    return `Nesta imagem, ${mudar}. Mantenha rigorosamente consistente e inalterado: ${manter}. Preserve a identidade física do produto sem mutações.`;
  }

  const estilo = ultraRealista
    ? 'Fotografia comercial ultra realista em 8K, ótica precisa com detalhes micro-texturizados e física de luz natural'
    : state.estilo.trim() || 'Fotografia ultra realista';

  const sujeito = state.sujeito.trim() || getDefaultSubjectForAgent(agent, product.nome);
  const acao = state.acao.trim() || 'em apresentação impecável e natural';
  const contexto = state.cenario.trim() || 'em ambiente autêntico e contextualizado para TikTok Shop';
  const composicao = state.composicao.trim() || 'vertical 9:16 centralizada com espaço seguro inferior para carrinho';
  const iluminacao = state.iluminacao.trim() || 'luz difusa de alta fidelidade com sombras suaves';
  const paleta = state.paleta.trim() || 'tons naturais e fieis às cores reais do produto';
  const humor = state.humor.trim() || 'desejável e profissional';
  const proporcao = state.proporcao || '9:16';

  let prompt = `Fotografia ultra realista de ${sujeito}, ${acao}, em ${contexto}. `;

  if (agent === 'pov') {
    prompt += `Perspectiva POV (ponto de vista em 1ª pessoa) com as mãos do usuário segurando o item em ângulo natural. `;
  } else if (agent === 'ugc') {
    prompt += `Estilo UGC autêntico de feed do TikTok, iluminação limpa e enquadramento vertical com visual de criador real. `;
  } else {
    prompt += `Composição comercial de alto impacto com ângulo dinâmico destacando materiais, relevo e detalhes da embalagem. `;
  }

  // Âncora de produto invariável
  if (product.nome.trim()) {
    prompt += `O produto é estritamente o ${product.nome.trim()}`;
    if (product.caracteristicasVisuais.trim()) {
      prompt += `, apresentando ${product.caracteristicasVisuais.trim()}`;
    }
    prompt += `. `;
  }

  // Âncora de personagem invariável
  if (state.character && (state.character.nomeOuDescricao?.trim() || state.character.caracteristicasFisicas?.trim())) {
    prompt += `A pessoa/modelo é ${state.character.nomeOuDescricao?.trim() || 'o modelo de referência'}`;
    if (state.character.caracteristicasFisicas?.trim()) {
      prompt += ` com ${state.character.caracteristicasFisicas.trim()}`;
    }
    if (state.character.cabelo?.trim()) {
      prompt += `, cabelo ${state.character.cabelo.trim()}`;
    }
    if (state.character.estiloVestuario?.trim()) {
      prompt += `, vestindo ${state.character.estiloVestuario.trim()}`;
    }
    prompt += ` (mantenha a fidelidade facial e física idêntica à referência). `;
  }

  prompt += `A composição é ${composicao}, com ${iluminacao} e paleta de cores ${paleta}. Atmosfera ${humor}.`;

  if (state.materiais.trim()) {
    prompt += ` Texturas e acabamentos: ${state.materiais.trim()}.`;
  }

  // TikTok Compliance na imagem
  const userEvitar = state.evitar.trim();
  const evitarRules = 'sem textos falsos, sem elementos cobrindo os cantos inferiores da imagem, sem distorções ou dedos extras';
  prompt += ` Evite: ${userEvitar ? `${userEvitar}, ${evitarRules}` : evitarRules}.`;

  prompt += ` Formato: vertical proporção ${proporcao} otimizada para TikTok Shop.`;

  return prompt;
}

// Helpers de valores padrão por agente
function getDefaultCameraForAgent(agent: 'pov' | 'ugc' | 'motion'): string {
  switch (agent) {
    case 'pov':
      return 'Plano detalhe/médio em 1ª pessoa (POV), ângulo ligeiramente inclinado para baixo';
    case 'ugc':
      return 'Câmera frontal de smartphone na altura dos olhos, plano médio vertical';
    case 'motion':
      return 'Plano B-Roll dinâmico com travelling orbital e slow-motion suave de produto';
  }
}

function getDefaultSubjectForAgent(agent: 'pov' | 'ugc' | 'motion', productName?: string): string {
  const prod = productName?.trim() || 'o produto físico';
  switch (agent) {
    case 'pov':
      return `Mãos de um criador segurando e demonstrando ${prod}`;
    case 'ugc':
      return `Criador carismático e autêntico interagindo com ${prod}`;
    case 'motion':
      return `${prod} em exibição heroica com iluminação comercial`;
  }
}

function getDefaultActionForAgent(agent: 'pov' | 'ugc' | 'motion'): string {
  switch (agent) {
    case 'pov':
      return 'abrindo a embalagem e aplicando o produto com gestos suaves em primeiro plano';
    case 'ugc':
      return 'demonstrando o produto com reação genuína de entusiasmo e foco na câmera';
    case 'motion':
      return 'girando suavemente em 360 graus com reflexos de luz varrendo a superfície';
  }
}

function getDefaultScenarioForAgent(agent: 'pov' | 'ugc' | 'motion'): string {
  switch (agent) {
    case 'pov':
      return 'sobre uma bancada moderna bem iluminada e minimalista';
    case 'ugc':
      return 'em um quarto ou estúdio caseiro contemporâneo e acolhedor';
    case 'motion':
      return 'em um cenário de estúdio comercial com iluminação de recorte e base clean';
  }
}

function getDefaultLightingForAgent(agent: 'pov' | 'ugc' | 'motion'): string {
  switch (agent) {
    case 'pov':
      return 'luz natural suave vindo de uma janela lateral com sombras suaves';
    case 'ugc':
      return 'iluminação difusa estilo softbox/ring light suave sem estourar as cores da pele';
    case 'motion':
      return 'iluminação comercial de produto com backlight de recorte e reflexos controlados';
  }
}
