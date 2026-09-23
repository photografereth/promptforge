export const DAILY_LIMIT = 50;

// Persistência de contagem de uso. Implementações: usageRepo.ts (Supabase) e
// testing/memoryUsageRepo.ts.
export interface UsageRepo {
  // Incrementa atomicamente o contador do usuário para `dateStr` (YYYY-MM-DD,
  // já calculado em America/Sao_Paulo) e devolve o novo total.
  incrementAndGetUsage(userId: string, dateStr: string): Promise<number>;
}

// Persistência do circuit breaker de alta demanda do Gemini. Implementações:
// circuitBreakerRepo.ts (Supabase) e testing/memoryCircuitBreakerRepo.ts.
export interface CircuitBreakerRepo {
  getLastHighDemandAt(): Promise<string | null>;
  setHighDemandNow(nowIso: string): Promise<void>;
}
