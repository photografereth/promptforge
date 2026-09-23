import { describe, it, expect } from 'vitest';
import { decideQuota } from './decideQuota.js';
import { createMemoryUsageRepo } from './testing/memoryUsageRepo.js';
import { DAILY_LIMIT } from './types.js';

const NOW = new Date('2026-09-23T17:00:00.000Z'); // 14h em SP, 2026-09-23

describe('decideQuota', () => {
  it('ok abaixo do limite', async () => {
    const repo = createMemoryUsageRepo();
    expect(await decideQuota(repo, 'user-1', NOW)).toBe('ok');
  });

  it('ok exatamente no limite (a chamada que atinge o limite ainda passa)', async () => {
    const repo = createMemoryUsageRepo({ 'user-1|2026-09-23': DAILY_LIMIT - 1 });
    expect(await decideQuota(repo, 'user-1', NOW)).toBe('ok');
  });

  it('exceeded acima do limite', async () => {
    const repo = createMemoryUsageRepo({ 'user-1|2026-09-23': DAILY_LIMIT });
    expect(await decideQuota(repo, 'user-1', NOW)).toBe('exceeded');
  });

  it('cota é isolada por usuário', async () => {
    const repo = createMemoryUsageRepo({ 'user-1|2026-09-23': DAILY_LIMIT });
    expect(await decideQuota(repo, 'user-2', NOW)).toBe('ok');
  });

  it('cota é isolada por dia (São Paulo)', async () => {
    const repo = createMemoryUsageRepo({ 'user-1|2026-09-22': DAILY_LIMIT });
    expect(await decideQuota(repo, 'user-1', NOW)).toBe('ok');
  });

  it('duas chamadas "simultâneas" não perdem contagem (incremento atômico)', async () => {
    const repo = createMemoryUsageRepo({ 'user-1|2026-09-23': DAILY_LIMIT - 2 });
    const [a, b] = await Promise.all([decideQuota(repo, 'user-1', NOW), decideQuota(repo, 'user-1', NOW)]);
    // A primeira leva a contagem a LIMIT-1 (ok), a segunda a LIMIT (ok) — nenhuma se perde.
    expect([a, b].sort()).toEqual(['ok', 'ok']);
    expect(repo.counts.get('user-1|2026-09-23')).toBe(DAILY_LIMIT);
  });

  it('falha fechada: erro no repo vira "error", nunca "ok"', async () => {
    const repo = createMemoryUsageRepo();
    repo.incrementAndGetUsage = async () => {
      throw new Error('db fora do ar');
    };
    expect(await decideQuota(repo, 'user-1', NOW)).toBe('error');
  });
});
