import { describe, it, expect } from 'vitest';
import { decideIpRateLimit } from './decideIpRateLimit.js';
import { createMemoryRepo } from './testing/memoryRepo.js';
import { IP_RATE_LIMIT } from './types.js';

const NOW = new Date('2026-09-23T17:03:00.000Z'); // janela 17:00:00.000Z

describe('decideIpRateLimit', () => {
  it('ok abaixo do limite', async () => {
    const repo = createMemoryRepo();
    expect(await decideIpRateLimit(repo, '203.0.113.5', NOW)).toBe('ok');
  });

  it('ok exatamente no limite', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T17:00:00.000Z': IP_RATE_LIMIT - 1 });
    expect(await decideIpRateLimit(repo, '203.0.113.5', NOW)).toBe('ok');
  });

  it('limited acima do limite', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T17:00:00.000Z': IP_RATE_LIMIT });
    expect(await decideIpRateLimit(repo, '203.0.113.5', NOW)).toBe('limited');
  });

  it('IPs diferentes têm baldes independentes', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T17:00:00.000Z': IP_RATE_LIMIT });
    expect(await decideIpRateLimit(repo, '198.51.100.1', NOW)).toBe('ok');
  });

  it('janelas diferentes não se misturam', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T16:55:00.000Z': IP_RATE_LIMIT });
    expect(await decideIpRateLimit(repo, '203.0.113.5', NOW)).toBe('ok');
  });

  it('duas chamadas "simultâneas" não perdem contagem', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T17:00:00.000Z': IP_RATE_LIMIT - 2 });
    const [a, b] = await Promise.all([
      decideIpRateLimit(repo, '203.0.113.5', NOW),
      decideIpRateLimit(repo, '203.0.113.5', NOW),
    ]);
    expect([a, b].sort()).toEqual(['ok', 'ok']);
    expect(repo.counts.get('203.0.113.5|2026-09-23T17:00:00.000Z')).toBe(IP_RATE_LIMIT);
  });

  it('falha fechada: erro no repo vira "error", nunca "ok"', async () => {
    const repo = createMemoryRepo();
    repo.incrementAndGetCount = async () => {
      throw new Error('db fora do ar');
    };
    expect(await decideIpRateLimit(repo, '203.0.113.5', NOW)).toBe('error');
  });
});
