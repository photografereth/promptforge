import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDeps } from '../_lib/billing/deps';
import { safeEqual } from '../_lib/billing/safeEqual';
import { runBillingCron } from '../_lib/billing/service/cron';

// A Vercel chama crons com GET e `Authorization: Bearer $CRON_SECRET`.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET não configurada');
    return res.status(500).json({ error: 'Cron não configurado.' });
  }
  if (!safeEqual(req.headers.authorization ?? '', `Bearer ${secret}`)) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  try {
    const summary = await runBillingCron(buildDeps());
    return res.status(200).json({ ok: true, ...summary });
  } catch (error) {
    console.error('cron error:', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ error: 'Erro interno.' });
  }
}
