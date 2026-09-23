import { describe, it, expect } from 'vitest';
import { getClientIp } from './getClientIp.js';
import type { VercelRequest } from '@vercel/node';

function fakeReq(headers: Record<string, string | string[] | undefined>): VercelRequest {
  return { headers } as unknown as VercelRequest;
}

describe('getClientIp', () => {
  it('usa o primeiro IP de x-forwarded-for', () => {
    expect(getClientIp(fakeReq({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5');
  });
  it('funciona com um único IP, sem vírgula', () => {
    expect(getClientIp(fakeReq({ 'x-forwarded-for': '203.0.113.5' }))).toBe('203.0.113.5');
  });
  it('tira espaço em volta do IP', () => {
    expect(getClientIp(fakeReq({ 'x-forwarded-for': ' 203.0.113.5 , 10.0.0.1' }))).toBe('203.0.113.5');
  });
  it('trata array (múltiplos headers) pegando o primeiro', () => {
    expect(getClientIp(fakeReq({ 'x-forwarded-for': ['203.0.113.5', '198.51.100.1'] }))).toBe('203.0.113.5');
  });
  it('cai em "unknown" sem o header', () => {
    expect(getClientIp(fakeReq({}))).toBe('unknown');
  });
});
