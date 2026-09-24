import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDeps } from '../_lib/billing/deps.js';
import { safeEqual } from '../_lib/billing/safeEqual.js';
import { runBillingCron } from '../_lib/billing/service/cron.js';
import { cleanupOldWindows } from '../_lib/rateLimit/cleanup.js';
import { logWarn, logError } from '../_lib/logging/logger.js';
import { errorName } from '../_lib/logging/errorName.js';

// A Vercel chama crons com GET e `Authorization: Bearer $CRON_SECRET`.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    await logError('cron_secret_missing');
    return res.status(500).json({ error: 'Cron não configurado.' });
  }
  if (!safeEqual(req.headers.authorization ?? '', `Bearer ${secret}`)) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  try {
    const summary = await runBillingCron(buildDeps());
    await cleanupOldWindows().catch((err) => {
      logWarn('ip_rate_limit_cleanup_failed', { errorName: errorName(err) });
    });
    return res.status(200).json({ ok: true, ...summary });
  } catch (error) {
    await logError('cron_failed', { errorName: errorName(error) });
    return res.status(500).json({ error: 'Erro interno.' });
  }
}
