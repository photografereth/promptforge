import { describe, it, expect, vi } from 'vitest';
import { requireIpRateLimit } from './requireIpRateLimit.js';
import { createMemoryRepo } from './testing/memoryRepo.js';
import { IP_RATE_LIMIT } from './types.js';
import { createMemoryRepo as createMemoryLogRepo } from '../logging/testing/memoryRepo.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const NOW = new Date('2026-09-23T17:03:00.000Z');

function fakeReq(ip: string): VercelRequest {
  return { headers: { 'x-forwarded-for': ip } } as unknown as VercelRequest;
}

function fakeRes(): VercelResponse {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireIpRateLimit', () => {
  it('permite e não escreve resposta quando abaixo do limite', async () => {
    const repo = createMemoryRepo();
    const res = fakeRes();

    const allowed = await requireIpRateLimit(fakeReq('203.0.113.5'), res, repo, NOW);

    expect(allowed).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('bloqueia com 429 e code quando acima do limite', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T17:00:00.000Z': IP_RATE_LIMIT });
    const res = fakeRes();

    const allowed = await requireIpRateLimit(fakeReq('203.0.113.5'), res, repo, NOW);

    expect(allowed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
    const body = (res.json as any).mock.calls[0][0];
    expect(body.code).toBe('rate_limited');
  });

  it('responde 503 (não 429) quando o repo falha — falha fechada, mas visível como erro de servidor', async () => {
    const repo = createMemoryRepo();
    repo.incrementAndGetCount = async () => {
      throw new Error('db fora do ar');
    };
    const logRepo = createMemoryLogRepo();
    const res = fakeRes();

    const allowed = await requireIpRateLimit(fakeReq('203.0.113.5'), res, repo, NOW, logRepo);

    expect(allowed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(logRepo.logs).toHaveLength(1);
    expect(logRepo.logs[0].event).toBe('ip_rate_limit_check_failed');
  });
});
