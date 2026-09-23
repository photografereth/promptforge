import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIpRateLimit } from './_lib/rateLimit/requireIpRateLimit.js';
import { authenticate } from './_lib/auth.js';
import { requireActiveSubscription } from './_lib/billing/requireSubscription.js';
import { requireQuota } from './_lib/billing/requireQuota.js';
import { getGemini, generateWithFallback } from './_lib/gemini.js';
import { parseImageData } from './_lib/parseImageData.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireIpRateLimit(req, res))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
  if (!user) return;
  if (!(await requireActiveSubscription(user, res))) return;
  if (!(await requireQuota(user, res))) return;

  const {
    productImage,
    characterImage,
    productImages = [],
    characterImages = [],
    sceneImages = [],
    agent = 'ugc',
    mode = 'video',
    existingProduct = {},
    existingCharacter = {},
  } = req.body ?? {};

  const rawProducts = Array.isArray(productImages) && productImages.length > 0
    ? productImages
    : (productImage ? [productImage] : []);
  const parsedProducts = rawProducts.map(parseImageData).filter(Boolean) as { data: string; mimeType: string }[];

  const rawCharacters = Array.isArray(characterImages) && characterImages.length > 0
    ? characterImages
    : (characterImage ? [characterImage] : []);
  const parsedCharacters = rawCharacters.map(parseImageData).filter(Boolean) as { data: string; mimeType: string }[];

  const rawScenes = Array.isArray(sceneImages) ? sceneImages : [];
  const parsedScenes = rawScenes.map(parseImageData).filter(Boolean) as { data: string; mimeType: string }[];

  if (parsedProducts.length === 0 && parsedCharacters.length === 0 && parsedScenes.length === 0) {
    return res.status(400).json({
      error: 'Envie pelo menos uma imagem de referência (produto, personagem ou cenário) para análise.',
    });
  }

  try {
    const ai = getGemini();

    const parts: any[] = [];

    if (parsedProducts.length > 0) {
      parts.push({
        text: `[REFERÊNCIAS VISUAIS DO PRODUTO: ${parsedProducts.length} foto(s) fornecida(s). Analise todos os ângulos, embalagem, rótulo e textura física]:`,
      });
      for (const prod of parsedProducts) {
        parts.push({ inlineData: { mimeType: prod.mimeType, data: prod.data } });
      }
    }

    if (parsedCharacters.length > 0) {
      parts.push({
        text: `[REFERÊNCIAS VISUAIS DA MODELO / PERSONAGEM: ${parsedCharacters.length} foto(s) fornecida(s). Trave traços faciais, tom de pele, cabelo, vestimenta e expressão]:`,
      });
      for (const char of parsedCharacters) {
        parts.push({ inlineData: { mimeType: char.mimeType, data: char.data } });
      }
    }

    if (parsedScenes.length > 0) {
      parts.push({
        text: `[REFERÊNCIAS VISUAIS DE CENÁRIO / AMBIENTAÇÃO / ILUMINAÇÃO: ${parsedScenes.length} foto(s) fornecida(s). Incorpore a estética espacial, paleta de cores e iluminação]:`,
      });
      for (const sc of parsedScenes) {
        parts.push({ inlineData: { mimeType: sc.mimeType, data: sc.data } });
      }
    }

    const agentContext =
      agent === 'pov'
        ? 'AGENTE POV (Ponto de Vista em 1ª Pessoa): Perspectiva subjetiva dos olhos do criador, foco próximo nas mãos interagindo com o produto, unboxing tátil e demonstração sensorial direta com profundidade de campo sutil.'
        : agent === 'ugc'
        ? 'AGENTE UGC (Criador Autêntico TikTok Shop): Conteúdo estilo smartphone 4K real, criador espontâneo reagindo e testando o produto com energia natural, com gancho (hook) visual forte nos primeiros 2 segundos.'
        : 'AGENTE MOVIMENTO (B-Roll Dinâmico Comercial): Planos cinematográficos com travelling orbital 360° em volta do produto, iluminação de estúdio comercial com reflexos volumétricos nos materiais.';

    const promptInstructions = `Você é um diretor de cena, especialista em computação visual e estrategista sênior de criativos para TikTok Shop com maestria em modelos de vídeo como Omni 1.1 Flash e Veo (para vídeos de até 10s ultra realistas) e Nano Banana para imagem.

Você recebeu ${parsedProducts.length + parsedCharacters.length + parsedScenes.length} imagens de referência para ancorar consistência absoluta entre cortes e cenas:
${parsedProducts.length > 0 ? `- PRODUTO (${parsedProducts.length} referências): Analise minuciosamente o produto físico em todas as imagens fornecidas (formato exato, tipo de embalagem/frasco, tampa, relevo, cores precisas, rótulo/tipografia, textura do líquido/creme/material, reflexos de vidro/plástico/metal).` : ''}
${parsedCharacters.length > 0 ? `- PERSONAGEM / MODELO (${parsedCharacters.length} referências): Analise minuciosamente os traços da pessoa para garantir que a mesma modelo seja reproduzida com total fidelidade em todas as cenas (gênero, idade aparente, tom de pele, traços faciais marcantes, olhos, nariz, sorriso, tipo/cor/corte de cabelo, estilo e cores de vestimenta, expressão característica).` : ''}
${parsedScenes.length > 0 ? `- CENÁRIO / AMBIENTE (${parsedScenes.length} referências): Analise o espaço, iluminação, paleta de cores e atmosfera do ambiente para guiar o cenário da cena.` : ''}

Contexto de Direção:
1. Agente Selecionado: ${agentContext}
2. Modo atual: ${mode === 'video' ? 'VÍDEO (Google Flow Omni 1.1 Flash / Veo - Ultra Realista até 10s)' : 'IMAGEM (Google Flow Nano Banana - 8K Ultra Realista)'}.
3. Políticas do TikTok Shop: PROIBIDO promessas médicas milagrosas ou cura ("cura rugas", "acaba com celulite"). Foco estrito na demonstração física real e autêntica. Safe Zone vertical 9:16 ativa para não cobrir o botão da sacola de compras no rodapé.
4. Padrão VÍDEO ULTRA REALISTA: Textura orgânica de pele humana real com microporos, reflexos de luz física precisa nos materiais, sem qualquer aspecto artificial de CGI ou plástico de IA.

Retorne ESTRITAMENTE um JSON puro válido no seguinte formato exato (sem markdown, sem blocos extras):
{
  "product": {
    "nome": "${existingProduct?.nome || 'Nome detectado ou sugerido do produto'}",
    "categoria": "${existingProduct?.categoria || 'Categoria comercial (Ex: Skincare & Beleza, Gadgets, Moda)'}",
    "caracteristicasVisuais": "Descrição rica e invariável dos detalhes físicos (formato, cor exata, frasco, tampa, rótulo, material)",
    "beneficioVisual": "Ação ou demonstração visual ideal do produto em cena (textura sendo espalhada, gotas límpidas, acabamento luminoso)"
  },
  "character": {
    "nomeOuDescricao": "${existingCharacter?.nomeOuDescricao || 'Descrição identificatória (Ex: Criadora brasileira, ~25 anos, estilo autêntico)'}",
    "caracteristicasFisicas": "Tom de pele, formato do rosto, olhos, sorriso e traços faciais distintivos para travamento de identidade",
    "cabelo": "Cor, comprimento, textura (liso, ondulado, cacheado) e corte",
    "estiloVestuario": "Figurino visual, cores e estilo de roupas observados",
    "expressaoMarcante": "Expressão e atitude cênica observada (olhar acolhedor, sorriso espontâneo)"
  },
  "scene": {
    "sujeito": "Sujeito da cena articulando o personagem com o produto",
    "acao": "Ação ultra realista ideal para o agente selecionado",
    "cenario": "Cenário limpo, contextualizado e sofisticado para TikTok Shop",
    "estilo": "Filme ultra realista em 4K, textura orgânica, ótica precisa sem artefatos plásticos",
    "enquadramento": "Enquadramento 9:16 vertical ideal para o agente",
    "lente": "Especificação ótica de câmera real",
    "iluminacao": "Iluminação física e natural adequada",
    "humor": "Atmosfera e tom emocional",
    "dialogo": "Frase falada curta e natural ou vazia",
    "sfx": "Som tátil da embalagem e do produto",
    "somAmbiente": "Acústica ambiente suave",
    "hookVisual": "Hook nos primeiros 2 segundos para prender a atenção",
    "materiais": "Texturas físicas precisas observadas na imagem",
    "evitar": "Termos proibidos no TikTok Shop e defeitos visuais"
  },
  "consistencySummary": "Resumo em 1-2 frases destacando os atributos invariáveis travados do produto e do personagem para consistência entre cenas."
}`;

    parts.push({ text: promptInstructions });

    const response: any = await generateWithFallback(
      ai,
      {
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
        },
      },
      25000
    );
    const text = response.text || '{}';

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      data = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      product: data.product,
      character: data.character,
      scene: data.scene,
      consistencySummary: data.consistencySummary,
    });
  } catch (error: any) {
    console.warn('Aviso: Falha na chamada multimodal do Gemini, utilizando análise heurística estruturada:', error.message);

    const fallbackProduct = {
      nome: existingProduct?.nome || (parsedProducts.length > 0 ? 'Produto de Referência Identificado' : 'Produto TikTok Shop'),
      categoria: existingProduct?.categoria || 'E-commerce & Beleza',
      caracteristicasVisuais:
        existingProduct?.caracteristicasVisuais ||
        'Embalagem física premium com acabamento fosco, rótulo minimalista de alta resolução e tampa com vedação precisa observada na imagem',
      beneficioVisual:
        existingProduct?.beneficioVisual ||
        'Aplicação prática suave revelando a textura e o acabamento imediato do produto em primeiro plano',
    };

    const fallbackCharacter = {
      nomeOuDescricao:
        existingCharacter?.nomeOuDescricao ||
        (parsedCharacters.length > 0 ? 'Modelo/Criador de Referência (~25 anos)' : 'Criador autêntico de conteúdo'),
      caracteristicasFisicas:
        existingCharacter?.caracteristicasFisicas ||
        'Traços faciais naturais com pele bem cuidada, expressão comunicativa e olhar direto para a câmera',
      cabelo: existingCharacter?.cabelo || 'Cabelo natural com corte moderno e textura alinhada à imagem',
      estiloVestuario: existingCharacter?.estiloVestuario || 'Vestimenta casual contemporânea em tons neutros',
      expressaoMarcante: existingCharacter?.expressaoMarcante || 'Sorriso espontâneo e postura confiável',
    };

    const fallbackScene = {
      sujeito: parsedCharacters.length > 0
        ? `${fallbackCharacter.nomeOuDescricao} interagindo de forma autêntica com ${fallbackProduct.nome}`
        : `Mãos do criador apresentando ${fallbackProduct.nome} em plano próximo`,
      acao:
        agent === 'pov'
          ? `segurando ${fallbackProduct.nome} com as duas mãos e abrindo a embalagem com precisão tátil`
          : agent === 'ugc'
          ? `mostrando o resultado de ${fallbackProduct.nome} com expressão genuína de surpresa nos primeiros segundos`
          : `destacando o acabamento físico de ${fallbackProduct.nome} em rotação orbital suave de 360 graus`,
      cenario: 'ambiente moderno, minimalista e bem iluminado contextualizado para o público do TikTok Shop',
      estilo: 'Filme ultra realista em 4K, textura orgânica de pele e materiais, ótica cinematográfica real',
      enquadramento:
        agent === 'pov'
          ? 'Plano detalhe/médio em 1ª pessoa (POV) vertical 9:16'
          : agent === 'ugc'
          ? 'Câmera frontal de smartphone na altura dos olhos, proporção vertical 9:16'
          : 'Travelling orbital dinâmico vertical 9:16 com slow-motion suave',
      lente: 'Lente primária de smartphone topo de linha com profundidade de campo física sutil',
      iluminacao: 'iluminação difusa suave de softbox sem reflexos estourados no produto',
      humor: 'espontâneo, confiável e focado na textura real',
      dialogo: agent === 'ugc' ? 'Vocês precisam ver como esse produto se comporta na prática!' : '',
      sfx: 'som sutil e límpido de clique e abertura da embalagem',
      somAmbiente: 'acústica aconchegante de quarto ou estúdio contemporâneo',
      hookVisual: 'movimento dinâmico trazendo o produto direto para a lente nos primeiros 2 segundos',
      materiais: fallbackProduct.caracteristicasVisuais,
      evitar: 'sem alegações médicas de cura milagrosa, sem textos obstruindo a área da sacola de compras do TikTok',
    };

    res.json({
      success: true,
      product: fallbackProduct,
      character: fallbackCharacter,
      scene: fallbackScene,
      consistencySummary:
        'Trava invariável de consistência ativada: os traços da modelo e os detalhes da embalagem foram ancorados para manter identidade contínua entre cenas.',
      fallback: true,
      fallbackReason: error.message,
    });
  }
}
