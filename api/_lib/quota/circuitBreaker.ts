const HIGH_DEMAND_WINDOW_MS = 180_000;

// Lógica pura: dado quando foi a última alta demanda e o instante atual,
// decide a ordem de modelos preferida. Sem I/O — testável sem repo.
export function pickModelOrder(lastHighDemandAt: string | null, now: Date): string[] {
  const last = lastHighDemandAt ? new Date(lastHighDemandAt).getTime() : 0;
  if (now.getTime() - last < HIGH_DEMAND_WINDOW_MS) {
    return ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  }
  return ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
}
