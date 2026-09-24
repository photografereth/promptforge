import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIpRateLimit } from './_lib/rateLimit/requireIpRateLimit.js';
import { authenticate } from './_lib/auth.js';
import { requireActiveSubscription } from './_lib/billing/requireSubscription.js';
import { requireQuota } from './_lib/billing/requireQuota.js';
import { getGemini, generateWithFallback } from './_lib/gemini.js';
import { logInfo, logWarn } from './_lib/logging/logger.js';
import { errorName } from './_lib/logging/errorName.js';
import { parseImageData } from './_lib/parseImageData.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  if (!(await requireIpRateLimit(req, res))) return;

  const user = await authenticate(req, res);
  if (!user) return;
  if (!(await requireActiveSubscription(user, res))) return;
  if (!(await requireQuota(user, res))) return;

  const { url, rawNotes, image } = req.body ?? {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'O link real do produto é obrigatório.' });
  }

  const cleanUrl = url.trim();

  let fetchedMeta = {
    title: '',
    description: '',
    ogImage: '',
    rawSnippet: '',
    fetchSucceeded: false,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
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

      fetchedMeta.title = ogTitleMatch?.[1] || titleMatch?.[1] || '';
      fetchedMeta.description = ogDescMatch?.[1] || metaDescMatch?.[1] || '';
      fetchedMeta.ogImage = ogImgMatch?.[1] || '';

      const strippedBody = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 2500);

      fetchedMeta.rawSnippet = strippedBody;
      fetchedMeta.fetchSucceeded = true;
    }
  } catch (err: any) {
    logInfo('metadata_fetch_fallback', { errorName: errorName(err) });
  }

  try {
    const ai = getGemini();

    const parts: any[] = [];

    const parsedImage = parseImageData(image);
    if (parsedImage) {
      parts.push({ inlineData: { mimeType: parsedImage.mimeType, data: parsedImage.data } });
      parts.push({
        text: `[IMAGEM ANEXADA DA PÁGINA / EMBALAGEM DO PRODUTO NO TIKTOK SHOP]: Analise com precisão o design físico da embalagem, rótulo, tampa, cores e forma.`,
      });
    }

    const extractionPrompt = `Você é um engenheiro de produto e diretor de criativos para TikTok Shop.
Um usuário colou o seguinte link real de produto ou loja:
URL: "${cleanUrl}"

Dados recuperados da URL:
- Título detectado: "${fetchedMeta.title || 'Não disponível via scraping direto'}"
- Descrição detectada: "${fetchedMeta.description || 'Não disponível via scraping direto'}"
- Trecho da página: "${fetchedMeta.rawSnippet.slice(0, 1000) || 'Sem acesso direto ao HTML'}"
${rawNotes ? `- Observações ou texto adicional do usuário: "${rawNotes}"` : ''}

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
          responseMimeType: 'application/json',
        },
      },
      16000
    );

    const responseText = response.text || '{}';
    let extractedData: any;
    try {
      extractedData = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedData = JSON.parse(cleaned);
    }

    const uniqueId = `custom-prod-${Date.now()}`;
    const resultProduct = {
      id: uniqueId,
      name: extractedData.name || fetchedMeta.title || 'Produto Importado via Link Real',
      category: extractedData.category || 'Produtos em Alta',
      niche: extractedData.niche || 'beauty',
      status: extractedData.status || 'explosao',
      salesVolume: extractedData.salesVolume || 'Alta procura no TikTok',
      commissionRate: extractedData.commissionRate || '25% a 35%',
      commissionValue: extractedData.commissionValue || 'Comissão de Afiliado',
      ticketPrice: extractedData.ticketPrice || 'Conforme Loja',
      affiliateUrl: cleanUrl,
      isCustom: true,
      sourceType: 'link' as const,
      productAnchor: {
        nome: extractedData.productAnchor?.nome || extractedData.name || 'Produto Ancorado',
        categoria: extractedData.productAnchor?.categoria || extractedData.category || 'Geral',
        caracteristicasVisuais:
          extractedData.productAnchor?.caracteristicasVisuais ||
          'Embalagem física moderna com acabamento de alta definição conforme link oficial',
        beneficioVisual:
          extractedData.productAnchor?.beneficioVisual ||
          'Aplicação sensorial destacando a textura e o benefício do produto em primeiro plano',
      },
      suggestedHooks: extractedData.suggestedHooks || {
        pov: 'Mãos trazendo o produto direto para o centro da câmera abrindo a tampa nos primeiros 2s',
        ugc: 'Criadora segurando o produto ao lado do rosto com expressão de surpresa nos primeiros segundos',
        motion: 'Travelling dinâmico de aproximação com iluminação comercial suave sobre o produto',
      },
      suggestedActions: extractedData.suggestedActions || {
        pov: 'Manusear a embalagem com firmeza, demonstrando a facilidade de abertura e o uso prático',
        ugc: 'Aplicar uma pequena porção diante da câmera e mostrar o resultado natural de imediato',
        motion: 'Giro contínuo de 360 graus com reflexos de luz realçando a embalagem',
      },
      suggestedScenarios: extractedData.suggestedScenarios || {
        pov: 'Bancada limpa e moderna com iluminação natural suave e safe zone 9:16 ativa',
        ugc: 'Ambiente de quarto ou home office bem iluminado com estética TikTok nativa',
        motion: 'Estúdio comercial escuro ou minimalista com pedestal de apoio e iluminação de recorte',
      },
    };

    res.json({
      success: true,
      product: resultProduct,
      fetchedTitle: fetchedMeta.title,
    });
  } catch (error: any) {
    logWarn('gemini_fallback', { route: 'parse-product-url', errorName: errorName(error) });

    const urlParts = cleanUrl.split('/').filter(Boolean);
    const lastSlug = urlParts[urlParts.length - 1] || 'produto';
    const readableSlug = decodeURIComponent(lastSlug)
      .replace(/[-_]/g, ' ')
      .replace(/\?.*$/, '');

    const fallbackName =
      fetchedMeta.title || (readableSlug.length > 3 ? readableSlug.toUpperCase() : 'Produto TikTok Shop');

    const fallbackProduct = {
      id: `custom-prod-${Date.now()}`,
      name: fallbackName.slice(0, 65),
      category: 'Produto TikTok Shop Verificado',
      niche: 'beauty' as const,
      status: 'explosao' as const,
      salesVolume: 'Produto em Alta no Feed',
      commissionRate: '30%',
      commissionValue: 'Alta Rentabilidade',
      ticketPrice: 'Conforme Catálogo',
      affiliateUrl: cleanUrl,
      isCustom: true,
      sourceType: 'link' as const,
      productAnchor: {
        nome: fallbackName.slice(0, 65),
        categoria: 'E-commerce & TikTok Shop',
        caracteristicasVisuais:
          'Embalagem física moderna com tampa de precisão, rótulo impresso de alta nitidez e materiais com acabamento acetinado fiéis ao produto real',
        beneficioVisual:
          'Demonstração prática de uso revelando textura e eficiência imediata do produto no primeiro segundo',
      },
      suggestedHooks: {
        pov: 'Mão trazendo o produto para o foco da câmera e destravando a embalagem rapidamente',
        ugc: 'Criadora segurando o produto no enquadramento vertical mostrando o resultado prático',
        motion: 'Close cinematográfico com luz de recorte destacando o relevo do produto',
      },
      suggestedActions: {
        pov: 'Demonstrar a abertura e o toque sensorial com gestos manuais precisos',
        ugc: 'Explicar os diferenciais enquanto mostra o produto na mão com naturalidade',
        motion: 'Rotação contínua em câmera lenta revelando todos os ângulos da embalagem',
      },
      suggestedScenarios: {
        pov: 'Superfície limpa de bancada com iluminação suave e proporção 9:16',
        ugc: 'Cenário acolhedor com luz de janela e profundidade suave',
        motion: 'Estúdio comercial contemporâneo com iluminação volumétrica',
      },
    };

    res.json({
      success: true,
      product: fallbackProduct,
      fallback: true,
    });
  }
}
