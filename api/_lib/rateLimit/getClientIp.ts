import type { VercelRequest } from '@vercel/node';

export function getClientIp(req: VercelRequest): string {
  const header = req.headers['x-forwarded-for'];
  const raw = Array.isArray(header) ? header[0] : header;
  const first = raw?.split(',')[0]?.trim();
  return first || 'unknown';
}
