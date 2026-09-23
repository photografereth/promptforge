import { describe, it, expect, vi } from 'vitest';
import { requireQuota } from './requireQuota.js';
import { createMemoryUsageRepo } from '../quota/testing/memoryUsageRepo.js';
import { DAILY_LIMIT } from '../quota/types.js';
import type { VercelResponse } from '@vercel/node';

const USER = { id: 'user-1', email: 'user1@example.com' };
const NOW = new Date('2026-09-23T17:00:00.000Z'); // 14h em SP, 2026-09-23

function fakeRes(): VercelResponse {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireQuota', () => {
  it('permite e não escreve resposta quando abaixo do limite', async () => {
    const repo = createMemoryUsageRepo();
    const res = fakeRes();

    const allowed = await requireQuota(USER, res, repo, NOW);

    expect(allowed).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('bloqueia com 429, code e resetAt em São Paulo quando acima do limite', async () => {
    const repo = createMemoryUsageRepo({ 'user-1|2026-09-23': DAILY_LIMIT });
    const res = fakeRes();

    const allowed = await requireQuota(USER, res, repo, NOW);

    expect(allowed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
    const body = (res.json as any).mock.calls[0][0];
    expect(body.code).toBe('quota_exceeded');
    expect(body.resetAt).toBe('2026-09-24T03:00:00.000Z');
  });

  it('responde 503 quando o repo falha (falha fechada)', async () => {
    const repo = createMemoryUsageRepo();
    repo.incrementAndGetUsage = async () => {
      throw new Error('db fora do ar');
    };
    const res = fakeRes();

    const allowed = await requireQuota(USER, res, repo, NOW);

    expect(allowed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
