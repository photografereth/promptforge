import { createHmac } from 'node:crypto';
import { safeEqual } from './safeEqual';

export type SignatureResult =
  | { ok: true }
  | { ok: false; reason: 'missing_headers' | 'malformed_signature' | 'stale_timestamp' | 'invalid_signature' };

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

export function verifyMpSignature(input: {
  signatureHeader?: string;
  requestId?: string;
  dataId?: string;
  secret: string;
  nowMs: number;
  toleranceMs?: number;
}): SignatureResult {
  const { signatureHeader, requestId, dataId, secret, nowMs } = input;
  if (!signatureHeader || !requestId || !dataId) return { ok: false, reason: 'missing_headers' };

  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of signatureHeader.split(',')) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=').trim();
    if (key.trim() === 'ts') ts = value;
    else if (key.trim() === 'v1') v1 = value;
  }
  if (!ts || !v1) return { ok: false, reason: 'malformed_signature' };

  const tsNumber = Number(ts);
  if (!Number.isFinite(tsNumber)) return { ok: false, reason: 'malformed_signature' };
  // O MP envia ts em segundos; aceitamos milissegundos por robustez.
  const tsMs = tsNumber < 1e12 ? tsNumber * 1000 : tsNumber;
  if (Math.abs(nowMs - tsMs) > (input.toleranceMs ?? DEFAULT_TOLERANCE_MS)) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  // data.id alfanumérico é assinado em minúsculas pelo MP.
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  if (!safeEqual(expected, v1)) return { ok: false, reason: 'invalid_signature' };
  return { ok: true };
}
