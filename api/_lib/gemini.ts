import { GoogleGenAI } from '@google/genai';

export function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente do servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Nota: este estado vive na memória do processo da função serverless. Em cold starts
// da Vercel, uma nova invocação pode não compartilhar essa memória, então o circuit
// breaker perde efeito entre invocações frias — limitação conhecida, resolvida de
// verdade só quando o Pilar 3 introduzir estado compartilhado (quota/fila).
let lastGeminiHighDemandTime = 0;

function getPreferredModels(): string[] {
  if (Date.now() - lastGeminiHighDemandTime < 180000) {
    return ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  }
  return ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
}

export async function generateWithFallback(
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
      const msg = String(err?.message || '');
      if (
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('429')
      ) {
        lastGeminiHighDemandTime = Date.now();
      }
    }
  }

  throw lastError || new Error('Falha em todos os modelos de IA disponíveis.');
}
