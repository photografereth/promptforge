import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Initialize Gemini lazily
function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no ambiente do servidor.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Adaptive model routing & high-demand circuit breaker
let lastGeminiHighDemandTime = 0;

function getPreferredModels(): string[] {
  // If high demand (503/UNAVAILABLE) occurred in the last 3 minutes, prioritize gemini-3.1-flash-lite
  if (Date.now() - lastGeminiHighDemandTime < 180000) {
    return ["gemini-3.1-flash-lite", "gemini-3.8-flash"];
  }
  return ["gemini-3.8-flash", "gemini-3.1-flash-lite"];
}

async function generateWithFallback(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
  },
  timeoutMs = 18000
): Promise<any> {
  const models = getPreferredModels();
  let lastError: any = null;

  for (const modelName of models) {
    try {
      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: options.contents,
        config: options.config,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout na chamada (${modelName})`)), timeoutMs)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      if (response && (response.text || response.candidates?.length)) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || "");
      if (
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("high demand") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("429")
      ) {
        lastGeminiHighDemandTime = Date.now();
      }
    }
  }

  throw lastError || new Error("Falha em todos os modelos de IA disponíveis.");
}

// Local smart fallback parser calibrated for the 3 TikTok Shop agents & product anchor
function parseIdeaLocally(idea: string, mode: "video" | "image", agent: "pov" | "ugc" | "motion" = "ugc", product?: any) {
  const cleanIdea = idea.trim();
  const prodName = product?.nome?.trim() || "o produto";
  const prodDetails = product?.caracteristicasVisuais?.trim() || "";

  if (mode === "video") {
    if (agent === "pov") {
      return {
        sujeito: `Mãos do criador interagindo em close-up com ${prodName}${prodDetails ? ` (${prodDetails})` : ""}`,
        acao: `abrindo a embalagem e demonstrando o uso prático com gestos firmes e naturais`,
        cenario: `bancada limpa e moderna com iluminação lateral suave e espaço livre inferior`,
        estilo: "Filme ultra realista em 4K, ótica real com detalhes táteis nítidos, textura orgânica de pele",
        enquadramento: "Plano médio em 1ª pessoa (POV), ângulo ligeiramente inclinado para baixo",
        lente: "Profundidade de campo rasa focando no produto e nas mãos",
        iluminacao: "luz natural suave de janela com reflexos autênticos nos materiais",
        humor: "imersivo, autêntico e focado na experiência sensorial",
        dialogo: "",
        sfx: "som tátil sutil de abertura da tampa e clique da embalagem",
        somAmbiente: "sala tranquila com sensação acolhedora e realista",
        hookVisual: "mão trazendo o produto rapidamente para o centro da câmera nos primeiros 2 segundos",
        evitar: "sem alegações médicas exageradas, sem elementos cobrindo a barra de compra do TikTok",
        duracao: "8s",
        proporcao: "9:16",
      };
    } else if (agent === "ugc") {
      return {
        sujeito: `Criador autêntico do TikTok segurando ${prodName} com expressão natural de teste real`,
        acao: `mostrando o produto para a câmera frontal de smartphone e aplicando de forma descomplicada`,
        cenario: `quarto contemporâneo bem organizado com iluminação acolhedora e estética TikTok real`,
        estilo: "Vídeo ultra realista em 4K gravado com smartphone de alta gama, cores fiéis e textura de pele real",
        enquadramento: "Plano médio vertical (câmera frontal na altura dos olhos)",
        lente: "Grande angular suave típica de smartphone de última geração",
        iluminacao: "iluminação difusa suave (softbox caseiro) sem estourar o produto",
        humor: "espontâneo, confiável e vibrante sem parecer comercial engessado",
        dialogo: `Olha a textura disso aqui quando você aplica na prática`,
        sfx: "som natural de manuseio e voz limpa",
        somAmbiente: "ambiente acústico controlado de quarto moderno",
        hookVisual: "expressão surpresa mostrando o produto logo no primeiro segundo",
        evitar: "sem promessas milagrosas ou cura, sem logotipos concorrentes, sem cobrir o canto inferior direito",
        duracao: "8s",
        proporcao: "9:16",
      };
    } else {
      // Motion agent
      return {
        sujeito: `${prodName} em destaque comercial cinematográfico${prodDetails ? ` com ${prodDetails}` : ""}`,
        acao: `girando suavemente em 360 graus em slow-motion fluido enquanto a luz varre o acabamento`,
        cenario: `estúdio comercial minimalista com pedestal de apoio e iluminação volumétrica`,
        estilo: "Comercial de produto ultra realista em 4K com física precisa de luz e materiais reais",
        enquadramento: "Travelling orbital dinâmico e plano detalhe com foco nas texturas",
        lente: "Lente macro cinema com foco seletivo no logotipo e detalhes da fórmula",
        iluminacao: "iluminação de estúdio comercial com luz de recorte e reflexos metálicos/vidro precisos",
        humor: "sofisticado, hipnótico e com alto valor percebido de produto",
        dialogo: "",
        sfx: "woosh suave de transição de câmera e som límpido de alta definição",
        somAmbiente: "graves elegantes e sensação de estúdio comercial moderno",
        hookVisual: "câmera mergulhando em alta velocidade e desacelerando no produto com reflexo luminoso",
        evitar: "sem distorções digitais, sem efeito plástico de CGI falso, sem elementos na área da sacola de compras",
        duracao: "8s",
        proporcao: "9:16",
      };
    }
  } else {
    // Image mode
    return {
      sujeito: `${prodName} em composição ultra realista${prodDetails ? ` (${prodDetails})` : ""}`,
      acao: agent === "pov" ? "segurado por mãos cuidadosas em ângulo em 1ª pessoa" : "posicionado em ângulo de destaque comercial",
      cenario: "ambiente limpo e com iluminação de alta qualidade para e-commerce TikTok Shop",
      estilo: "Fotografia comercial ultra realista em 8K, ótica de alta definição e física de luz natural",
      composicao: "vertical 9:16 centralizada com safe zone inferior para carrinho do TikTok Shop",
      iluminacao: "luz suave e bem direcionada revelando relevo e acabamento do material",
      paleta: "cores realistas e fiéis ao produto real",
      humor: "atraente, profissional e autêntico",
      materiais: prodDetails || "vidro/plástico com reflexos nítidos e acabamento premium",
      evitar: "sem claims médicos, sem filtros artificiais plásticos, sem texto nos cantos",
      proporcao: "9:16",
      isEdit: false,
      editMudar: "",
      editManter: "",
    };
  }
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Flow Prompt Forge API - TikTok Shop & 3 Agents" });
});

// Auto-fill form fields endpoint using Gemini 3.8 Flash
app.post("/api/autofill", async (req, res) => {
  const { idea, mode, agent = "ugc", product = {} } = req.body;
  if (!idea || typeof idea !== "string") {
    return res.status(400).json({ error: "A descrição da ideia é obrigatória." });
  }

  try {
    const ai = getGemini();

    const agentDescription =
      agent === "pov"
        ? "AGENTE POV (Ponto de Vista em 1ª pessoa): foco absoluto na perspectiva dos olhos do usuário, mãos interagindo, unboxing ou aplicação direta do produto, profundidade de campo sutil."
        : agent === "ugc"
        ? "AGENTE UGC (Criador Autêntico TikTok Shop): estilo smartphone 4K real, criador espontâneo reagindo e testando o produto, com gancho (hook) visual forte nos primeiros 2 segundos, energia autêntica de social proof."
        : "AGENTE MOVIMENTO (B-Roll Dinâmico Comercial): planos cinematográficos de produto em movimento, rotação 360°, slow-motion, iluminação de estúdio comercial com reflexos nos materiais.";

    const productAnchorInfo = product?.nome
      ? `PRODUTO ANCORADO (Consistência inegociável):
- Nome: ${product.nome}
- Categoria: ${product.categoria || "Geral"}
- Características visuais invariáveis: ${product.caracteristicasVisuais || "Não especificado"}
- Benefício/Ação visual: ${product.beneficioVisual || "Uso padrão"}
MANTENHA ESTAS CARACTERÍSTICAS FÍSICAS RIGOROSAMENTE IDÊNTICAS!`
      : "Nenhum produto pré-ancorado especificado; defina o sujeito de produto claramente a partir da ideia.";

    const promptText = `Você é um diretor de cena e estrategista de criativos para TikTok Shop especializado no Google Flow (modelos de vídeo como Omni 1.1 Flash e Veo para vídeo de até 10s, e Nano Banana para imagem).
Sua missão é decompor a ideia do usuário em campos estruturados em português do Brasil, garantindo:
1. Agente Selecionado: ${agentDescription}
2. Consistência de Produto: ${productAnchorInfo}
3. Conformidade estrita com Políticas do TikTok Shop: PROIBIDO alegações médicas de cura ("cura rugas", "elimina 100% de celulite"), proibições financeiras, antes/depois milagroso. Foco na demonstração sensorial e funcional autêntica.
4. Padrão "VÍDEO ULTRA REALISTA": Câmera real, textura natural de pele e materiais físicos, sem look plástico de IA.
5. Formato padrão: vertical 9:16 com Safe Zone para o carrinho e botões do TikTok Shop.
6. Duração compatível: 4s, 6s, 8s ou 10s (máximo 10s para alta retenção).

O modo atual é: ${mode === "video" ? "VÍDEO (Google Flow Omni 1.1 Flash / Veo - Ultra Realista até 10s)" : "IMAGEM (Google Flow Nano Banana - Ultra Realista)"}.

Retorne ESTRITAMENTE um JSON puro válido (sem markdown, sem explicações):
${
  mode === "video"
    ? `{
  "sujeito": "Sujeito principal coerente com o agente e produto consistente",
  "acao": "Ação específica e ultra realista (gesto com mãos para POV, reação/teste para UGC, rotação/B-roll para Movimento)",
  "cenario": "Contexto estético compatível com TikTok Shop",
  "estilo": "Filme ultra realista em 4K, textura orgânica, ótica precisa sem artefatos plásticos",
  "enquadramento": "Enquadramento recomendado para o agente em proporção 9:16 vertical",
  "lente": "Especificação ótica de câmera real",
  "iluminacao": "Iluminação física e natural adequada ao estilo",
  "humor": "Tom emocional autêntico",
  "dialogo": "Frase curta e natural falada pelo criador (ou vazio se motion)",
  "sfx": "Efeitos sonoros práticos do produto (clique de tampa, spray, textura)",
  "somAmbiente": "Som de fundo sutil",
  "hookVisual": "Ação de impacto nos primeiros 2 segundos para prender a atenção no feed",
  "evitar": "Termos proibidos no TikTok Shop (sem alegações de cura, sem promessas falsas)",
  "duracao": "8s",
  "proporcao": "9:16"
}`
    : `{
  "sujeito": "Sujeito principal com fidelidade de produto",
  "acao": "Ação ou pose estática ultra realista",
  "cenario": "Cenário limpo e atraente para e-commerce",
  "estilo": "Fotografia comercial ultra realista em 8K com ótica física de estúdio",
  "composicao": "Vertical 9:16 centralizada com safe zone inferior para botão de compra",
  "iluminacao": "Iluminação de estúdio ou luz natural suave",
  "paleta": "Cores reais do produto",
  "humor": "Profissional e desejável",
  "materiais": "Texturas físicas precisas do produto",
  "evitar": "Sem claims falsos, sem texto cobrindo as bordas",
  "proporcao": "9:16",
  "isEdit": false,
  "editMudar": "",
  "editManter": ""
}`
}

Ideia do usuário: "${idea}"`;

    const response: any = await generateWithFallback(
      ai,
      {
        contents: promptText,
        config: {
          responseMimeType: "application/json",
        },
      },
      15000
    );
    const text = response.text || "{}";
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
      data = JSON.parse(cleaned);
    }

    res.json({ success: true, data });
  } catch (error: any) {
    console.warn("Aviso: autofill Gemini encontrou erro, utilizando extração inteligente de contingência:", error.message);
    const fallbackData = parseIdeaLocally(idea, mode, agent, product);
    res.json({ success: true, data: fallbackData, fallback: true });
  }
});

// Enhance prompt endpoint using Gemini 3.8 Flash
app.post("/api/enhance", async (req, res) => {
  const { prompt, mode, agent = "ugc", product = {}, meta } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Prompt base é obrigatório." });
  }

  try {
    const ai = getGemini();

    const instructions =
      mode === "video"
        ? `Você é um diretor de fotografia comercial e estrategista líder de criativos para TikTok Shop.
Sua tarefa é aprimorar o prompt de vídeo para modelos de ponta como Omni 1.1 Flash e Veo (para vídeos de até 10s), garantindo:
- PADRÃO VÍDEO ULTRA REALISTA: Textura de pele humana real com microporos, materiais com física precisa de refração e reflexo, iluminação volumétrica natural, sem qualquer aspecto de CGI ou plástico de IA.
- AGENTE ESPECIALIZADO: Respeite rigorosamente se o agente é POV (1ª pessoa mãos/unboxing), UGC (criador autêntico smartphone 4K com hook nos primeiros 2s) ou Movimento (B-Roll de produto dinâmico em 360°).
- CONSISTÊNCIA DE PRODUTO INEGOCIÁVEL: Preserve integralmente a descrição dos atributos físicos do produto (nome, embalagem, cores e acabamentos).
- DIRETRIZES DO TIKTOK SHOP: Nenhuma promessa médica ou de cura exagerada. Preservação de Safe Zone 9:16 (sem elementos vitais no rodapé onde fica a sacola de compras).
- Sintaxe padrão calibrada para Omni 1.1 Flash e Veo: Mantenha o formato estruturado com enquadramento, sujeito e ação, iluminação, áudio, o que evitar, e finalize com as tags técnicas [Duração: ... | Proporção: 9:16 | Safe Zone TikTok Shop: Ativa | Modo: Ultra Realista].
- Responda apenas com o texto do prompt aprimorado em português do Brasil.`
        : `Você é um mestre da fotografia comercial ultra realista de produto para o Google Flow Nano Banana (Gemini 2.5 Flash Image).
Sua tarefa é aprimorar o prompt determinístico em linguagem natural coesa, garantindo:
- Estilo estritamente fotográfico ultra realista em 8K, com ótica de lente macro/comercial, profundidade de campo precisa e física de luz real.
- Consistência inabalável dos atributos físicos do produto e conformidade com o TikTok Shop em formato 9:16.
- Responda apenas com o texto do prompt aprimorado em português do Brasil.`;

    const enhancePromptText = `${instructions}

Agente Ativo: ${agent.toUpperCase()}
Produto Ancorado: ${JSON.stringify(product || {})}

Prompt original montado:
"""
${prompt}
"""

Informações adicionais de contexto: ${JSON.stringify(meta || {})}

Gere o prompt ultra realista aprimorado em português do Brasil:`;

    const response: any = await generateWithFallback(
      ai,
      {
        contents: enhancePromptText,
      },
      15000
    );
    const enhancedPrompt = response.text?.trim() || prompt;
    res.json({ success: true, enhancedPrompt });
  } catch (error: any) {
    console.warn("Aviso: enhance Gemini encontrou erro, utilizando versão aprimorada fotográfica:", error.message);
    // Sophisticated photographic enrichment fallback with TikTok Shop compliance
    let fallbackEnhanced = prompt;
    if (mode === "video") {
      fallbackEnhanced = prompt.replace(
        /A cena é iluminada por ([^.]+)\./i,
        "A cena é banhada por $1, capturando reflexos físicos precisos nos materiais do produto e micro-texturas reais com iluminação ultra realista."
      );
    } else {
      fallbackEnhanced = prompt.replace(
        /A atmosfera é ([^.]+)\./i,
        "A atmosfera transmite uma sensação $1, com ótica comercial nítida em 8K, foco cirúrgico no produto e fidelidade física de materiais."
      );
    }
    res.json({ success: true, enhancedPrompt: fallbackEnhanced, fallback: true });
  }
});

// Helper to extract clean base64 data and mimeType
function parseImageData(input: any): { data: string; mimeType: string } | null {
  if (!input) return null;
  let dataStr = typeof input === "string" ? input : input.data || input.dataUrl || "";
  let mimeType = input.mimeType || "image/jpeg";

  if (!dataStr || typeof dataStr !== "string") return null;

  const match = dataStr.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    dataStr = match[2];
  }

  return { data: dataStr.trim(), mimeType };
}

// Multimodal analysis endpoint for Product and Character/Model reference images
app.post("/api/analyze-references", async (req, res) => {
  const {
    productImage,
    characterImage,
    productImages = [],
    characterImages = [],
    sceneImages = [],
    agent = "ugc",
    mode = "video",
    existingProduct = {},
    existingCharacter = {},
  } = req.body;

  // Gather and parse all product images (support both array and single field)
  const rawProducts = Array.isArray(productImages) && productImages.length > 0 
    ? productImages 
    : (productImage ? [productImage] : []);
  const parsedProducts = rawProducts.map(parseImageData).filter(Boolean);

  // Gather and parse all character images
  const rawCharacters = Array.isArray(characterImages) && characterImages.length > 0 
    ? characterImages 
    : (characterImage ? [characterImage] : []);
  const parsedCharacters = rawCharacters.map(parseImageData).filter(Boolean);

  // Gather and parse all scene / moodboard images
  const rawScenes = Array.isArray(sceneImages) ? sceneImages : [];
  const parsedScenes = rawScenes.map(parseImageData).filter(Boolean);

  if (parsedProducts.length === 0 && parsedCharacters.length === 0 && parsedScenes.length === 0) {
    return res.status(400).json({
      error: "Envie pelo menos uma imagem de referência (produto, personagem ou cenário) para análise.",
    });
  }

  try {
    const ai = getGemini();

    const parts: any[] = [];

    // Add product images
    if (parsedProducts.length > 0) {
      parts.push({
        text: `[REFERÊNCIAS VISUAIS DO PRODUTO: ${parsedProducts.length} foto(s) fornecida(s). Analise todos os ângulos, embalagem, rótulo e textura física]:`,
      });
      for (const prod of parsedProducts) {
        if (prod) {
          parts.push({
            inlineData: {
              mimeType: prod.mimeType,
              data: prod.data,
            },
          });
        }
      }
    }

    // Add character images
    if (parsedCharacters.length > 0) {
      parts.push({
        text: `[REFERÊNCIAS VISUAIS DA MODELO / PERSONAGEM: ${parsedCharacters.length} foto(s) fornecida(s). Trave traços faciais, tom de pele, cabelo, vestimenta e expressão]:`,
      });
      for (const char of parsedCharacters) {
        if (char) {
          parts.push({
            inlineData: {
              mimeType: char.mimeType,
              data: char.data,
            },
          });
        }
      }
    }

    // Add scene / moodboard images
    if (parsedScenes.length > 0) {
      parts.push({
        text: `[REFERÊNCIAS VISUAIS DE CENÁRIO / AMBIENTAÇÃO / ILUMINAÇÃO: ${parsedScenes.length} foto(s) fornecida(s). Incorpore a estética espacial, paleta de cores e iluminação]:`,
      });
      for (const sc of parsedScenes) {
        if (sc) {
          parts.push({
            inlineData: {
              mimeType: sc.mimeType,
              data: sc.data,
            },
          });
        }
      }
    }

    const agentContext =
      agent === "pov"
        ? "AGENTE POV (Ponto de Vista em 1ª Pessoa): Perspectiva subjetiva dos olhos do criador, foco próximo nas mãos interagindo com o produto, unboxing tátil e demonstração sensorial direta com profundidade de campo sutil."
        : agent === "ugc"
        ? "AGENTE UGC (Criador Autêntico TikTok Shop): Conteúdo estilo smartphone 4K real, criador espontâneo reagindo e testando o produto com energia natural, com gancho (hook) visual forte nos primeiros 2 segundos."
        : "AGENTE MOVIMENTO (B-Roll Dinâmico Comercial): Planos cinematográficos com travelling orbital 360° em volta do produto, iluminação de estúdio comercial com reflexos volumétricos nos materiais.";

    const promptInstructions = `Você é um diretor de cena, especialista em computação visual e estrategista sênior de criativos para TikTok Shop com maestria em modelos de vídeo como Omni 1.1 Flash e Veo (para vídeos de até 10s ultra realistas) e Nano Banana para imagem.

Você recebeu ${parsedProducts.length + parsedCharacters.length + parsedScenes.length} imagens de referência para ancorar consistência absoluta entre cortes e cenas:
${parsedProducts.length > 0 ? `- PRODUTO (${parsedProducts.length} referências): Analise minuciosamente o produto físico em todas as imagens fornecidas (formato exato, tipo de embalagem/frasco, tampa, relevo, cores precisas, rótulo/tipografia, textura do líquido/creme/material, reflexos de vidro/plástico/metal).` : ""}
${parsedCharacters.length > 0 ? `- PERSONAGEM / MODELO (${parsedCharacters.length} referências): Analise minuciosamente os traços da pessoa para garantir que a mesma modelo seja reproduzida com total fidelidade em todas as cenas (gênero, idade aparente, tom de pele, traços faciais marcantes, olhos, nariz, sorriso, tipo/cor/corte de cabelo, estilo e cores de vestimenta, expressão característica).` : ""}
${parsedScenes.length > 0 ? `- CENÁRIO / AMBIENTE (${parsedScenes.length} referências): Analise o espaço, iluminação, paleta de cores e atmosfera do ambiente para guiar o cenário da cena.` : ""}

Contexto de Direção:
1. Agente Selecionado: ${agentContext}
2. Modo atual: ${mode === "video" ? "VÍDEO (Google Flow Omni 1.1 Flash / Veo - Ultra Realista até 10s)" : "IMAGEM (Google Flow Nano Banana - 8K Ultra Realista)"}.
3. Políticas do TikTok Shop: PROIBIDO promessas médicas milagrosas ou cura ("cura rugas", "acaba com celulite"). Foco estrito na demonstração física real e autêntica. Safe Zone vertical 9:16 ativa para não cobrir o botão da sacola de compras no rodapé.
4. Padrão VÍDEO ULTRA REALISTA: Textura orgânica de pele humana real com microporos, reflexos de luz física precisa nos materiais, sem qualquer aspecto artificial de CGI ou plástico de IA.

Retorne ESTRITAMENTE um JSON puro válido no seguinte formato exato (sem markdown, sem blocos extras):
{
  "product": {
    "nome": "${existingProduct?.nome || "Nome detectado ou sugerido do produto"}",
    "categoria": "${existingProduct?.categoria || "Categoria comercial (Ex: Skincare & Beleza, Gadgets, Moda)"}",
    "caracteristicasVisuais": "Descrição rica e invariável dos detalhes físicos (formato, cor exata, frasco, tampa, rótulo, material)",
    "beneficioVisual": "Ação ou demonstração visual ideal do produto em cena (textura sendo espalhada, gotas límpidas, acabamento luminoso)"
  },
  "character": {
    "nomeOuDescricao": "${existingCharacter?.nomeOuDescricao || "Descrição identificatória (Ex: Criadora brasileira, ~25 anos, estilo autêntico)"}",
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
          responseMimeType: "application/json",
        },
      },
      25000
    );
    const text = response.text || "{}";

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
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
    console.warn("Aviso: Falha na chamada multimodal do Gemini, utilizando análise heurística estruturada:", error.message);

    // Fallback heuristic response
    const fallbackProduct = {
      nome: existingProduct?.nome || (parsedProducts.length > 0 ? "Produto de Referência Identificado" : "Produto TikTok Shop"),
      categoria: existingProduct?.categoria || "E-commerce & Beleza",
      caracteristicasVisuais:
        existingProduct?.caracteristicasVisuais ||
        "Embalagem física premium com acabamento fosco, rótulo minimalista de alta resolução e tampa com vedação precisa observada na imagem",
      beneficioVisual:
        existingProduct?.beneficioVisual ||
        "Aplicação prática suave revelando a textura e o acabamento imediato do produto em primeiro plano",
    };

    const fallbackCharacter = {
      nomeOuDescricao:
        existingCharacter?.nomeOuDescricao ||
        (parsedCharacters.length > 0 ? "Modelo/Criador de Referência (~25 anos)" : "Criador autêntico de conteúdo"),
      caracteristicasFisicas:
        existingCharacter?.caracteristicasFisicas ||
        "Traços faciais naturais com pele bem cuidada, expressão comunicativa e olhar direto para a câmera",
      cabelo: existingCharacter?.cabelo || "Cabelo natural com corte moderno e textura alinhada à imagem",
      estiloVestuario: existingCharacter?.estiloVestuario || "Vestimenta casual contemporânea em tons neutros",
      expressaoMarcante: existingCharacter?.expressaoMarcante || "Sorriso espontâneo e postura confiável",
    };

    const fallbackScene = {
      sujeito: parsedCharacters.length > 0
        ? `${fallbackCharacter.nomeOuDescricao} interagindo de forma autêntica com ${fallbackProduct.nome}`
        : `Mãos do criador apresentando ${fallbackProduct.nome} em plano próximo`,
      acao:
        agent === "pov"
          ? `segurando ${fallbackProduct.nome} com as duas mãos e abrindo a embalagem com precisão tátil`
          : agent === "ugc"
          ? `mostrando o resultado de ${fallbackProduct.nome} com expressão genuína de surpresa nos primeiros segundos`
          : `destacando o acabamento físico de ${fallbackProduct.nome} em rotação orbital suave de 360 graus`,
      cenario: "ambiente moderno, minimalista e bem iluminado contextualizado para o público do TikTok Shop",
      estilo: "Filme ultra realista em 4K, textura orgânica de pele e materiais, ótica cinematográfica real",
      enquadramento:
        agent === "pov"
          ? "Plano detalhe/médio em 1ª pessoa (POV) vertical 9:16"
          : agent === "ugc"
          ? "Câmera frontal de smartphone na altura dos olhos, proporção vertical 9:16"
          : "Travelling orbital dinâmico vertical 9:16 com slow-motion suave",
      lente: "Lente primária de smartphone topo de linha com profundidade de campo física sutil",
      iluminacao: "iluminação difusa suave de softbox sem reflexos estourados no produto",
      humor: "espontâneo, confiável e focado na textura real",
      dialogo: agent === "ugc" ? `Vocês precisam ver como esse produto se comporta na prática!` : "",
      sfx: "som sutil e límpido de clique e abertura da embalagem",
      somAmbiente: "acústica aconchegante de quarto ou estúdio contemporâneo",
      hookVisual: "movimento dinâmico trazendo o produto direto para a lente nos primeiros 2 segundos",
      materiais: fallbackProduct.caracteristicasVisuais,
      evitar: "sem alegações médicas de cura milagrosa, sem textos obstruindo a área da sacola de compras do TikTok",
    };

    res.json({
      success: true,
      product: fallbackProduct,
      character: fallbackCharacter,
      scene: fallbackScene,
      consistencySummary:
        "Trava invariável de consistência ativada: os traços da modelo e os detalhes da embalagem foram ancorados para manter identidade contínua entre cenas.",
      fallback: true,
      fallbackReason: error.message,
    });
  }
});

// Endpoint to parse any real TikTok Shop, e-commerce, or product URL into an anchored winning product
app.post("/api/parse-product-url", async (req, res) => {
  const { url, rawNotes, image } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "O link real do produto é obrigatório." });
  }

  const cleanUrl = url.trim();

  // 1. Attempt to fetch metadata from the live URL
  let fetchedMeta = {
    title: "",
    description: "",
    ogImage: "",
    rawSnippet: "",
    fetchSucceeded: false,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const html = await response.text();
      const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
      const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);

      fetchedMeta.title = ogTitleMatch?.[1] || titleMatch?.[1] || "";
      fetchedMeta.description = ogDescMatch?.[1] || metaDescMatch?.[1] || "";
      fetchedMeta.ogImage = ogImgMatch?.[1] || "";

      // Quick clean of visible text
      const strippedBody = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 2500);

      fetchedMeta.rawSnippet = strippedBody;
      fetchedMeta.fetchSucceeded = true;
    }
  } catch (err: any) {
    console.log("Nota: Busca de metadados da URL direta concluiu com:", err.message);
  }

  // 2. Parse with Gemini AI
  try {
    const ai = getGemini();

    const parts: any[] = [];

    // Optional user screenshot of TikTok shop page / product
    const parsedImage = parseImageData(image);
    if (parsedImage) {
      parts.push({
        inlineData: {
          mimeType: parsedImage.mimeType,
          data: parsedImage.data,
        },
      });
      parts.push({
        text: `[IMAGEM ANEXADA DA PÁGINA / EMBALAGEM DO PRODUTO NO TIKTOK SHOP]: Analise com precisão o design físico da embalagem, rótulo, tampa, cores e forma.`,
      });
    }

    const extractionPrompt = `Você é um engenheiro de produto e diretor de criativos para TikTok Shop.
Um usuário colou o seguinte link real de produto ou loja:
URL: "${cleanUrl}"

Dados recuperados da URL:
- Título detectado: "${fetchedMeta.title || "Não disponível via scraping direto"}"
- Descrição detectada: "${fetchedMeta.description || "Não disponível via scraping direto"}"
- Trecho da página: "${fetchedMeta.rawSnippet.slice(0, 1000) || "Sem acesso direto ao HTML"}"
${rawNotes ? `- Observações ou texto adicional do usuário: "${rawNotes}"` : ""}

Sua tarefa é extrair e estruturar um objeto COMPLETO de Produto Campeão para o TikTok Shop, respeitando rigorosamente:
1. NOME COMERCIAL LIMPO: Nome claro e atraente em português.
2. CARACTERÍSTICAS FÍSICAS INVARIÁVEIS: Descrição precisa da embalagem (formato do frasco/corpo, material como vidro/fosco/alumínio, cor exata, tipo de tampa/dispenser, rótulo e textura do produto/fórmula). Essa âncora impede a IA de alterar o frasco entre cenas.
3. BENEFÍCIO VISUAL SENSORIAL: Ação física imediata que demonstra valor (ex: absorção na pele, luz LED ligando, corte limpo) sem alegações médicas falsas ou promessas exageradas proibidas pelo TikTok Shop.
4. ROTEIROS PRÉ-CALIBRADOS PARA OS 3 AGENTES:
   - POV: Ponto de vista em 1ª pessoa (mãos manipulando, unboxing, sensação tátil).
   - UGC: Criador autêntico gravando na câmera frontal de smartphone com hook nos primeiros 2s.
   - MOTION: Travelling orbital 360°, slow-motion, iluminação de estúdio comercial de alta conversão.
5. ESTIMATIVAS DE MERCADO: Nicho ('skincare', 'tech', 'wellness', 'home' ou 'beauty'), ticket médio, comissão (%) e ganho em R$ por venda.

Retorne EXCLUSIVAMENTE um JSON puro válido no formato:
{
  "name": "Nome comercial limpo do produto",
  "category": "Categoria no e-commerce",
  "niche": "skincare",
  "status": "explosao",
  "salesVolume": "15.000+ vendas no TikTok Shop",
  "commissionRate": "30%",
  "commissionValue": "R$ 35,00 / venda",
  "ticketPrice": "R$ 119,00",
  "productAnchor": {
    "nome": "Nome detalhado do produto com medida/volume",
    "categoria": "Categoria geral",
    "caracteristicasVisuais": "Descrição física completa da embalagem, materiais, rótulo e líquido/textura",
    "beneficioVisual": "Demonstração sensorial do benefício prático sem alegações médicas"
  },
  "suggestedHooks": {
    "pov": "Gancho visual em 1ª pessoa para prender o scroll nos primeiros 2s",
    "ugc": "Gancho visual com criadora na câmera frontal com alta curiosidade",
    "motion": "Abertura comercial dinâmica em slow-motion com luz de recorte"
  },
  "suggestedActions": {
    "pov": "Ação detalhada com as mãos aplicando ou testando o produto",
    "ugc": "Ação espontânea do criador demonstrando a textura e aprovando",
    "motion": "Movimento de câmera e produto com rotação fluida 360°"
  },
  "suggestedScenarios": {
    "pov": "Cenário limpo e autêntico para visão em primeira pessoa",
    "ugc": "Ambiente autêntico com luz natural suave de smartphone",
    "motion": "Estúdio comercial minimalista com iluminação volumétrica"
  }
}`;

    parts.push({ text: extractionPrompt });

    const response: any = await generateWithFallback(
      ai,
      {
        contents: parts,
        config: {
          responseMimeType: "application/json",
        },
      },
      16000
    );

    const responseText = response.text || "{}";
    let extractedData: any;
    try {
      extractedData = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      extractedData = JSON.parse(cleaned);
    }

    const uniqueId = `custom-prod-${Date.now()}`;
    const resultProduct = {
      id: uniqueId,
      name: extractedData.name || fetchedMeta.title || "Produto Importado via Link Real",
      category: extractedData.category || "Produtos em Alta",
      niche: extractedData.niche || "beauty",
      status: extractedData.status || "explosao",
      salesVolume: extractedData.salesVolume || "Alta procura no TikTok",
      commissionRate: extractedData.commissionRate || "25% a 35%",
      commissionValue: extractedData.commissionValue || "Comissão de Afiliado",
      ticketPrice: extractedData.ticketPrice || "Conforme Loja",
      affiliateUrl: cleanUrl,
      isCustom: true,
      sourceType: "link" as const,
      productAnchor: {
        nome: extractedData.productAnchor?.nome || extractedData.name || "Produto Ancorado",
        categoria: extractedData.productAnchor?.categoria || extractedData.category || "Geral",
        caracteristicasVisuais:
          extractedData.productAnchor?.caracteristicasVisuais ||
          "Embalagem física moderna com acabamento de alta definição conforme link oficial",
        beneficioVisual:
          extractedData.productAnchor?.beneficioVisual ||
          "Aplicação sensorial destacando a textura e o benefício do produto em primeiro plano",
      },
      suggestedHooks: extractedData.suggestedHooks || {
        pov: "Mãos trazendo o produto direto para o centro da câmera abrindo a tampa nos primeiros 2s",
        ugc: "Criadora segurando o produto ao lado do rosto com expressão de surpresa nos primeiros segundos",
        motion: "Travelling dinâmico de aproximação com iluminação comercial suave sobre o produto",
      },
      suggestedActions: extractedData.suggestedActions || {
        pov: "Manusear a embalagem com firmeza, demonstrando a facilidade de abertura e o uso prático",
        ugc: "Aplicar uma pequena porção diante da câmera e mostrar o resultado natural de imediato",
        motion: "Giro contínuo de 360 graus com reflexos de luz realçando a embalagem",
      },
      suggestedScenarios: extractedData.suggestedScenarios || {
        pov: "Bancada limpa e moderna com iluminação natural suave e safe zone 9:16 ativa",
        ugc: "Ambiente de quarto ou home office bem iluminado com estética TikTok nativa",
        motion: "Estúdio comercial escuro ou minimalista com pedestal de apoio e iluminação de recorte",
      },
    };

    res.json({
      success: true,
      product: resultProduct,
      fetchedTitle: fetchedMeta.title,
    });
  } catch (error: any) {
    console.warn("Aviso: extração Gemini falhou, gerando produto estruturado a partir da URL:", error.message);

    // Smart URL-based fallback
    const urlParts = cleanUrl.split("/").filter(Boolean);
    const lastSlug = urlParts[urlParts.length - 1] || "produto";
    const readableSlug = decodeURIComponent(lastSlug)
      .replace(/[-_]/g, " ")
      .replace(/\?.*$/, "");

    const fallbackName =
      fetchedMeta.title || (readableSlug.length > 3 ? readableSlug.toUpperCase() : "Produto TikTok Shop");

    const fallbackProduct = {
      id: `custom-prod-${Date.now()}`,
      name: fallbackName.slice(0, 65),
      category: "Produto TikTok Shop Verificado",
      niche: "beauty" as const,
      status: "explosao" as const,
      salesVolume: "Produto em Alta no Feed",
      commissionRate: "30%",
      commissionValue: "Alta Rentabilidade",
      ticketPrice: "Conforme Catálogo",
      affiliateUrl: cleanUrl,
      isCustom: true,
      sourceType: "link" as const,
      productAnchor: {
        nome: fallbackName.slice(0, 65),
        categoria: "E-commerce & TikTok Shop",
        caracteristicasVisuais:
          "Embalagem física moderna com tampa de precisão, rótulo impresso de alta nitidez e materiais com acabamento acetinado fiéis ao produto real",
        beneficioVisual:
          "Demonstração prática de uso revelando textura e eficiência imediata do produto no primeiro segundo",
      },
      suggestedHooks: {
        pov: "Mão trazendo o produto para o foco da câmera e destravando a embalagem rapidamente",
        ugc: "Criadora segurando o produto no enquadramento vertical mostrando o resultado prático",
        motion: "Close cinematográfico com luz de recorte destacando o relevo do produto",
      },
      suggestedActions: {
        pov: "Demonstrar a abertura e o toque sensorial com gestos manuais precisos",
        ugc: "Explicar os diferenciais enquanto mostra o produto na mão com naturalidade",
        motion: "Rotação contínua em câmera lenta revelando todos os ângulos da embalagem",
      },
      suggestedScenarios: {
        pov: "Superfície limpa de bancada com iluminação suave e proporção 9:16",
        ugc: "Cenário acolhedor com luz de janela e profundidade suave",
        motion: "Estúdio comercial contemporâneo com iluminação volumétrica",
      },
    };

    res.json({
      success: true,
      product: fallbackProduct,
      fallback: true,
    });
  }
});

// Setup Vite development middleware or static production serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Flow Prompt Forge server running at http://localhost:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error("Failed to start server:", err);
});
