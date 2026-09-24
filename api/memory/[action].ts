import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIpRateLimit } from '../_lib/rateLimit/requireIpRateLimit.js';
import { authenticate } from '../_lib/auth.js';
import { requireActiveSubscription } from '../_lib/billing/requireSubscription.js';
import { buildMemoryDeps } from '../_lib/memory/deps.js';
import { queryInput, routeMemory } from '../_lib/memory/router.js';
import { logError } from '../_lib/logging/logger.js';
import { errorName } from '../_lib/logging/errorName.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireIpRateLimit(req, res))) return;

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const user = await authenticate(req, res);
  if (!user) return;
  if (!(await requireActiveSubscription(user, res))) return;

  const raw = req.query.action;
  const action = String((Array.isArray(raw) ? raw[0] : raw) ?? '');
  const method = req.method ?? 'GET';
  const input =
    method === 'GET' || method === 'DELETE'
      ? queryInput(req.query)
      : req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};

  try {
    const result = await routeMemory(buildMemoryDeps(), user, action, method, input);
    return res.status(result.status).json(result.body);
  } catch (error) {
    await logError('memory_handler_failed', { errorName: errorName(error), action, method });
    return res.status(500).json({ error: 'Erro interno. Tente novamente em instantes.' });
  }
}
