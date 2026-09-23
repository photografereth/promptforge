import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIpRateLimit } from './_lib/rateLimit/requireIpRateLimit.js';
import { authenticate } from './_lib/auth.js';
import { requireActiveSubscription } from './_lib/billing/requireSubscription.js';
import { requireQuota } from './_lib/billing/requireQuota.js';
import { getGemini, generateWithFallback } from './_lib/gemini.js';

// Fallback local calibrado para os 3 agentes TikTok Shop & âncora de produto
function parseIdeaLocally(
  idea: string,
  mode: 'video' | 'image',
  agent: 'pov' | 'ugc' | 'motion' = 'ugc',
  product?: any
) {
  const prodName = product?.nome?.trim() || 'o produto';
  const prodDetails = product?.caracteristicasVisuais?.trim() || '';

  if (mode === 'video') {
    if (agent === 'pov') {
      return {
        sujeito: `Mãos do criador interagindo em close-up com ${prodName}${prodDetails ? ` (${prodDetails})` : ''}`,
        acao: 'abrindo a embalagem e demonstrando o uso prático com gestos firmes e naturais',
        cenario: 'bancada limpa e moderna com iluminação lateral suave e espaço livre inferior',
        estilo: 'Filme ultra realista em 4K, ótica real com detalhes táteis nítidos, textura orgânica de pele',
        enquadramento: 'Plano médio em 1ª pessoa (POV), ângulo ligeiramente inclinado para baixo',
        lente: 'Profundidade de campo rasa focando no produto e nas mãos',
        iluminacao: 'luz natural suave de janela com reflexos autênticos nos materiais',
        humor: 'imersivo, autêntico e focado na experiência sensorial',
        dialogo: '',
        sfx: 'som tátil sutil de abertura da tampa e clique da embalagem',
        somAmbiente: 'sala tranquila com sensação acolhedora e realista',
        hookVisual: 'mão trazendo o produto rapidamente para o centro da câmera nos primeiros 2 segundos',
        evitar: 'sem alegações médicas exageradas, sem elementos cobrindo a barra de compra do TikTok',
        duracao: '8s',
        proporcao: '9:16',
      };
    } else if (agent === 'ugc') {
      return {
        sujeito: `Criador autêntico do TikTok segurando ${prodName} com expressão natural de teste real`,
        acao: 'mostrando o produto para a câmera frontal de smartphone e aplicando de forma descomplicada',
        cenario: 'quarto contemporâneo bem organizado com iluminação acolhedora e estética TikTok real',
        estilo: 'Vídeo ultra realista em 4K gravado com smartphone de alta gama, cores fiéis e textura de pele real',
        enquadramento: 'Plano médio vertical (câmera frontal na altura dos olhos)',
        lente: 'Grande angular suave típica de smartphone de última geração',
        iluminacao: 'iluminação difusa suave (softbox caseiro) sem estourar o produto',
        humor: 'espontâneo, confiável e vibrante sem parecer comercial engessado',
        dialogo: 'Olha a textura disso aqui quando você aplica na prática',
        sfx: 'som natural de manuseio e voz limpa',
        somAmbiente: 'ambiente acústico controlado de quarto moderno',
        hookVisual: 'expressão surpresa mostrando o produto logo no primeiro segundo',
        evitar: 'sem promessas milagrosas ou cura, sem logotipos concorrentes, sem cobrir o canto inferior direito',
        duracao: '8s',
        proporcao: '9:16',
      };
    } else {
      return {
        sujeito: `${prodName} em destaque comercial cinematográfico${prodDetails ? ` com ${prodDetails}` : ''}`,
        acao: 'girando suavemente em 360 graus em slow-motion fluido enquanto a luz varre o acabamento',
        cenario: 'estúdio comercial minimalista com pedestal de apoio e iluminação volumétrica',
        estilo: 'Comercial de produto ultra realista em 4K com física precisa de luz e materiais reais',
        enquadramento: 'Travelling orbital dinâmico e plano detalhe com foco nas texturas',
        lente: 'Lente macro cinema com foco seletivo no logotipo e detalhes da fórmula',
        iluminacao: 'iluminação de estúdio comercial com luz de recorte e reflexos metálicos/vidro precisos',
        humor: 'sofisticado, hipnótico e com alto valor percebido de produto',
        dialogo: '',
        sfx: 'woosh suave de transição de câmera e som límpido de alta definição',
        somAmbiente: 'graves elegantes e sensação de estúdio comercial moderno',
        hookVisual: 'câmera mergulhando em alta velocidade e desacelerando no produto com reflexo luminoso',
        evitar: 'sem distorções digitais, sem efeito plástico de CGI falso, sem elementos na área da sacola de compras',
        duracao: '8s',
        proporcao: '9:16',
      };
    }
  } else {
    return {
      sujeito: `${prodName} em composição ultra realista${prodDetails ? ` (${prodDetails})` : ''}`,
      acao: agent === 'pov' ? 'segurado por mãos cuidadosas em ângulo em 1ª pessoa' : 'posicionado em ângulo de destaque comercial',
      cenario: 'ambiente limpo e com iluminação de alta qualidade para e-commerce TikTok Shop',
      estilo: 'Fotografia comercial ultra realista em 8K, ótica de alta definição e física de luz natural',
      composicao: 'vertical 9:16 centralizada com safe zone inferior para carrinho do TikTok Shop',
      iluminacao: 'luz suave e bem direcionada revelando relevo e acabamento do material',
      paleta: 'cores realistas e fiéis ao produto real',
      humor: 'atraente, profissional e autêntico',
      materiais: prodDetails || 'vidro/plástico com reflexos nítidos e acabamento premium',
      evitar: 'sem claims médicos, sem filtros artificiais plásticos, sem texto nos cantos',
      proporcao: '9:16',
      isEdit: false,
      editMudar: '',
      editManter: '',
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  if (!(await requireIpRateLimit(req, res))) return;

  const user = await authenticate(req, res);
  if (!user) return;
  if (!(await requireActiveSubscription(user, res))) return;
  if (!(await requireQuota(user, res))) return;

  const { idea, mode, agent = 'ugc', product = {} } = req.body ?? {};
  if (!idea || typeof idea !== 'string') {
    return res.status(400).json({ error: 'A descrição da ideia é obrigatória.' });
  }

  try {
    const ai = getGemini();

    const agentDescription =
      agent === 'pov'
        ? 'AGENTE POV (Ponto de Vista em 1ª pessoa): foco absoluto na perspectiva dos olhos do usuário, mãos interagindo, unboxing ou aplicação direta do produto, profundidade de campo sutil.'
        : agent === 'ugc'
        ? 'AGENTE UGC (Criador Autêntico TikTok Shop): estilo smartphone 4K real, criador espontâneo reagindo e testando o produto, com gancho (hook) visual forte nos primeiros 2 segundos, energia autêntica de social proof.'
        : 'AGENTE MOVIMENTO (B-Roll Dinâmico Comercial): planos cinematográficos de produto em movimento, rotação 360°, slow-motion, iluminação de estúdio comercial com reflexos nos materiais.';

    const productAnchorInfo = product?.nome
      ? `PRODUTO ANCORADO (Consistência inegociável):
- Nome: ${product.nome}
- Categoria: ${product.categoria || 'Geral'}
- Características visuais invariáveis: ${product.caracteristicasVisuais || 'Não especificado'}
- Benefício/Ação visual: ${product.beneficioVisual || 'Uso padrão'}
MANTENHA ESTAS CARACTERÍSTICAS FÍSICAS RIGOROSAMENTE IDÊNTICAS!`
      : 'Nenhum produto pré-ancorado especificado; defina o sujeito de produto claramente a partir da ideia.';

    const promptText = `Você é um diretor de cena e estrategista de criativos para TikTok Shop especializado no Google Flow (modelos de vídeo como Omni 1.1 Flash e Veo para vídeo de até 10s, e Nano Banana para imagem).
Sua missão é decompor a ideia do usuário em campos estruturados em português do Brasil, garantindo:
1. Agente Selecionado: ${agentDescription}
2. Consistência de Produto: ${productAnchorInfo}
3. Conformidade estrita com Políticas do TikTok Shop: PROIBIDO alegações médicas de cura ("cura rugas", "elimina 100% de celulite"), proibições financeiras, antes/depois milagroso. Foco na demonstração sensorial e funcional autêntica.
4. Padrão "VÍDEO ULTRA REALISTA": Câmera real, textura natural de pele e materiais físicos, sem look plástico de IA.
5. Formato padrão: vertical 9:16 com Safe Zone para o carrinho e botões do TikTok Shop.
6. Duração compatível: 4s, 6s, 8s ou 10s (máximo 10s para alta retenção).

O modo atual é: ${mode === 'video' ? 'VÍDEO (Google Flow Omni 1.1 Flash / Veo - Ultra Realista até 10s)' : 'IMAGEM (Google Flow Nano Banana - Ultra Realista)'}.

Retorne ESTRITAMENTE um JSON puro válido (sem markdown, sem explicações):
${
  mode === 'video'
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
          responseMimeType: 'application/json',
        },
      },
      15000
    );
    const text = response.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      data = JSON.parse(cleaned);
    }

    res.json({ success: true, data });
  } catch (error: any) {
    console.warn('Aviso: autofill Gemini encontrou erro, utilizando extração inteligente de contingência:', error.message);
    const fallbackData = parseIdeaLocally(idea, mode, agent, product);
    res.json({ success: true, data: fallbackData, fallback: true });
  }
}
