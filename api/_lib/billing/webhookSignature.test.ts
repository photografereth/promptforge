import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyMpSignature } from './webhookSignature';
import { safeEqual } from './safeEqual';

const SECRET = 'segredo-de-teste';
const NOW_MS = Date.UTC(2026, 8, 18, 12, 0, 0);
const TS_S = String(Math.floor(NOW_MS / 1000));

function sign(dataId: string, requestId: string, ts: string, secret = SECRET) {
  const v1 = createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

const base = { dataId: 'abc123', requestId: 'req-1', secret: SECRET, nowMs: NOW_MS };

describe('verifyMpSignature', () => {
  it('aceita assinatura válida', () => {
    expect(verifyMpSignature({ ...base, signatureHeader: sign('abc123', 'req-1', TS_S) })).toEqual({ ok: true });
  });
  it('normaliza data.id alfanumérico para minúsculas antes de assinar', () => {
    expect(verifyMpSignature({ ...base, dataId: 'ABC123', signatureHeader: sign('abc123', 'req-1', TS_S) })).toEqual({ ok: true });
  });
  it('rejeita headers ausentes', () => {
    expect(verifyMpSignature({ ...base, signatureHeader: undefined })).toEqual({ ok: false, reason: 'missing_headers' });
    expect(verifyMpSignature({ ...base, requestId: undefined, signatureHeader: sign('abc123', 'req-1', TS_S) })).toEqual({ ok: false, reason: 'missing_headers' });
    expect(verifyMpSignature({ ...base, dataId: undefined, signatureHeader: sign('abc123', 'req-1', TS_S) })).toEqual({ ok: false, reason: 'missing_headers' });
  });
  it('rejeita assinatura malformada', () => {
    expect(verifyMpSignature({ ...base, signatureHeader: 'lixo' })).toEqual({ ok: false, reason: 'malformed_signature' });
    expect(verifyMpSignature({ ...base, signatureHeader: 'ts=abc,v1=ff' })).toEqual({ ok: false, reason: 'malformed_signature' });
  });
  it('rejeita assinatura adulterada ou com segredo errado', () => {
    expect(verifyMpSignature({ ...base, signatureHeader: sign('abc123', 'req-1', TS_S, 'outro') })).toEqual({ ok: false, reason: 'invalid_signature' });
    expect(verifyMpSignature({ ...base, dataId: 'zzz999', signatureHeader: sign('abc123', 'req-1', TS_S) })).toEqual({ ok: false, reason: 'invalid_signature' });
  });
  it('rejeita replay (timestamp com mais de 5 minutos)', () => {
    const old = String(Math.floor(NOW_MS / 1000) - 6 * 60);
    expect(verifyMpSignature({ ...base, signatureHeader: sign('abc123', 'req-1', old) })).toEqual({ ok: false, reason: 'stale_timestamp' });
  });
  it('aceita ts em milissegundos', () => {
    expect(verifyMpSignature({ ...base, signatureHeader: sign('abc123', 'req-1', String(NOW_MS)) })).toEqual({ ok: true });
  });
});

describe('safeEqual', () => {
  it('compara em tempo constante e lida com tamanhos diferentes', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
