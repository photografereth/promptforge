import type { CircuitBreakerRepo } from '../types.js';

export interface MemoryCircuitBreakerRepo extends CircuitBreakerRepo {
  lastHighDemandAt: string | null;
}

export function createMemoryCircuitBreakerRepo(initial: string | null = null): MemoryCircuitBreakerRepo {
  let lastHighDemandAt = initial;
  return {
    get lastHighDemandAt() {
      return lastHighDemandAt;
    },
    async getLastHighDemandAt() {
      return lastHighDemandAt;
    },
    async setHighDemandNow(nowIso) {
      lastHighDemandAt = nowIso;
    },
  };
}
