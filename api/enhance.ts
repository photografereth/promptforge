import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIpRateLimit } from './_lib/rateLimit/requireIpRateLimit.js';
import { authenticate } from './_lib/auth.js';
import { requireActiveSubscription } from './_lib/billing/requireSubscription.js';
import { requireQuota } from './_lib/billing/requireQuota.js';
import { getGemini, generateWithFallback } from './_lib/gemini.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  if (!(await requireIpRateLimit(req, res))) return;

  const user = await authenticate(req, res);
  if (!user) return;
  if (!(await requireActiveSubscription(user, res))) return;
  if (!(await requireQuota(user, res))) return;

  const { prompt, mode, agent = 'ugc', product = {}, meta } = req.body ?? {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt base é obrigatório.' });
  }

  try {
    const ai = getGemini();

    const instructions =
      mode === 'video'
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
    console.warn('Aviso: enhance Gemini encontrou erro, utilizando versão aprimorada fotográfica:', error.message);
    let fallbackEnhanced = prompt;
    if (mode === 'video') {
      fallbackEnhanced = prompt.replace(
        /A cena é iluminada por ([^.]+)\./i,
        'A cena é banhada por $1, capturando reflexos físicos precisos nos materiais do produto e micro-texturas reais com iluminação ultra realista.'
      );
    } else {
      fallbackEnhanced = prompt.replace(
        /A atmosfera é ([^.]+)\./i,
        'A atmosfera transmite uma sensação $1, com ótica comercial nítida em 8K, foco cirúrgico no produto e fidelidade física de materiais.'
      );
    }
    res.json({ success: true, enhancedPrompt: fallbackEnhanced, fallback: true });
  }
}
