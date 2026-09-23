export const DAILY_LIMIT = 50;

// Persistência de contagem de uso. Implementações: usageRepo.ts (Supabase) e
// testing/memoryUsageRepo.ts.
export interface UsageRepo {
  // Incrementa atomicamente o contador do usuário para `dateStr` (YYYY-MM-DD,
  // já calculado em America/Sao_Paulo) e devolve o novo total.
  incrementAndGetUsage(userId: string, dateStr: string): Promise<number>;
}
