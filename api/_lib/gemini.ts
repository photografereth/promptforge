import { GoogleGenAI } from '@google/genai';
import { pickModelOrder } from './quota/circuitBreaker.js';
import { createSupabaseCircuitBreakerRepo } from './quota/circuitBreakerRepo.js';
import type { CircuitBreakerRepo } from './quota/types.js';
import { logWarn } from './logging/logger.js';
import { errorName } from './logging/errorName.js';

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

// Estado do circuit breaker agora vive no Postgres (public.gemini_circuit_breaker),
// compartilhado entre invocações — sobrevive a cold starts da Vercel. Falhas ao
// ler/escrever esse estado nunca devem impedir a chamada real ao Gemini: sempre
// cai de volta pra ordem padrão de modelos.
async function getPreferredModels(repo: CircuitBreakerRepo): Promise<string[]> {
  try {
    return pickModelOrder(await repo.getLastHighDemandAt(), new Date());
  } catch (err) {
    logWarn('circuit_breaker_read_failed', { errorName: errorName(err) });
    return pickModelOrder(null, new Date());
  }
}

export async function generateWithFallback(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
  },
  timeoutMs = 18000,
  breakerRepo: CircuitBreakerRepo = createSupabaseCircuitBreakerRepo()
): Promise<any> {
  const models = await getPreferredModels(breakerRepo);
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
        try {
          await breakerRepo.setHighDemandNow(new Date().toISOString());
        } catch (breakerErr) {
          logWarn('circuit_breaker_write_failed', { errorName: errorName(breakerErr) });
        }
      }
    }
  }

  throw lastError || new Error('Falha em todos os modelos de IA disponíveis.');
}
