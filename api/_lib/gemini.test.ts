import { describe, it, expect } from 'vitest';
import { generateWithFallback } from './gemini.js';
import { createMemoryCircuitBreakerRepo } from './quota/testing/memoryCircuitBreakerRepo.js';
import type { CircuitBreakerRepo } from './quota/types.js';

function fakeAi(behavior: (model: string) => any) {
  return {
    models: {
      generateContent: async ({ model }: { model: string }) => behavior(model),
    },
  } as any;
}

// Delay real (macrotask), não um fake síncrono: um repo em memória sem I/O real
// resolve a escrita antes mesmo de terminar a chamada, "passando" mesmo se o
// código não desse `await` na escrita (fire-and-forget também "funcionaria").
// Esse double distingue de verdade um `await breakerRepo.setHighDemandNow(...)`
// de um `void breakerRepo.setHighDemandNow(...).catch(...)`.
function createDelayedCircuitBreakerRepo(): CircuitBreakerRepo & { lastHighDemandAt: string | null } {
  const state: { lastHighDemandAt: string | null } = { lastHighDemandAt: null };
  return {
    get lastHighDemandAt() {
      return state.lastHighDemandAt;
    },
    async getLastHighDemandAt() {
      return state.lastHighDemandAt;
    },
    async setHighDemandNow(nowIso) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      state.lastHighDemandAt = nowIso;
    },
  };
}

describe('generateWithFallback', () => {
  it('erro de alta demanda é gravado no circuit breaker antes da função lançar', async () => {
    const breaker = createDelayedCircuitBreakerRepo();
    const ai = fakeAi(() => {
      throw new Error('503 UNAVAILABLE: modelo sob alta demanda');
    });

    await expect(generateWithFallback(ai, { contents: 'oi' }, 1000, breaker)).rejects.toThrow();

    expect(breaker.lastHighDemandAt).not.toBeNull();
  });

  it('erro ao ler o circuit breaker não impede a chamada (cai pra ordem padrão)', async () => {
    const breaker = createMemoryCircuitBreakerRepo();
    breaker.getLastHighDemandAt = async () => {
      throw new Error('db fora do ar');
    };
    const ai = fakeAi(() => ({ text: 'resposta ok' }));

    const response = await generateWithFallback(ai, { contents: 'oi' }, 1000, breaker);

    expect(response.text).toBe('resposta ok');
  });

  it('erro ao escrever no circuit breaker não derruba o erro real do Gemini', async () => {
    const breaker = createMemoryCircuitBreakerRepo();
    breaker.setHighDemandNow = async () => {
      throw new Error('escrita falhou');
    };
    const ai = fakeAi(() => {
      throw new Error('503 UNAVAILABLE: modelo sob alta demanda');
    });

    await expect(generateWithFallback(ai, { contents: 'oi' }, 1000, breaker)).rejects.toThrow(
      /503 UNAVAILABLE/
    );
  });
});
