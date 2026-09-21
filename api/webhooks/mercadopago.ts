import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDeps } from '../_lib/billing/deps.js';
import { handleWebhook } from '../_lib/billing/service/webhook.js';
import { verifyMpSignature } from '../_lib/billing/webhookSignature.js';

function header(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.error('MP_WEBHOOK_SECRET não configurada');
    return res.status(500).json({ error: 'Webhook não configurado.' });
  }

  const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, any>) : {};
  const queryId = req.query['data.id'];
  const dataId = String(body?.data?.id ?? (Array.isArray(queryId) ? queryId[0] : queryId) ?? '');
  const requestId = header(req, 'x-request-id');

  const verified = verifyMpSignature({
    signatureHeader: header(req, 'x-signature'),
    requestId,
    dataId,
    secret,
    nowMs: Date.now(),
  });
  if (!verified.ok) return res.status(401).json({ error: 'Assinatura inválida.' });

  try {
    const status = await handleWebhook(buildDeps(), {
      type: String(body.type ?? ''),
      dataId,
      requestId: requestId as string,
    });
    return res.status(status).json({ received: status === 200 });
  } catch (error) {
    console.error('webhook error:', error instanceof Error ? error.name : 'unknown');
    return res.status(500).json({ error: 'Erro interno.' });
  }
}
