import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIpRateLimit } from '../_lib/rateLimit/requireIpRateLimit.js';
import { authenticate } from '../_lib/auth.js';
import { buildDeps } from '../_lib/billing/deps.js';
import { routeBilling } from '../_lib/billing/router.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireIpRateLimit(req, res))) return;

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const user = await authenticate(req, res);
  if (!user) return;

  const raw = req.query.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};

  try {
    const result = await routeBilling(buildDeps(), user, String(action ?? ''), req.method ?? 'GET', body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    // Só o nome do erro: a mensagem pode conter dados pessoais.
    console.error('billing error:', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ error: 'Erro interno. Tente novamente em instantes.' });
  }
}
