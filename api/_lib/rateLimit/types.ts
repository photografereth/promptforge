export const IP_RATE_LIMIT = 100;

// Persistência da contagem por IP. Implementações: repo.ts (Supabase) e
// testing/memoryRepo.ts.
export interface IpRateLimitRepo {
  // Incrementa atomicamente o contador do IP para `windowStartIso` (ISO,
  // já truncado pro início da janela de 5 min) e devolve o novo total.
  incrementAndGetCount(ip: string, windowStartIso: string): Promise<number>;
}
