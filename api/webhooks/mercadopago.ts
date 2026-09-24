import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDeps } from '../_lib/billing/deps.js';
import { handleWebhook } from '../_lib/billing/service/webhook.js';
import { verifyMpSignature } from '../_lib/billing/webhookSignature.js';
import { logInfo, logWarn, logError } from '../_lib/logging/logger.js';
import { errorName } from '../_lib/logging/errorName.js';

function header(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    await logError('mp_webhook_secret_missing');
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

  const type = String(body.type ?? '');
  // Só tipo e id (nunca corpo/e-mail): ajuda a diagnosticar tópicos inesperados sem expor PII.
  logInfo('webhook_received', { type, dataId });

  const deps = buildDeps();

  // DIAGNÓSTICO TEMPORÁRIO (Task 18): o tópico `payment` chega para Assinaturas (confirmado
  // empiricamente) mas ainda não é processado pelo fluxo principal. Loga só campos não sensíveis
  // para descobrir a forma da resposta antes de decidir como tratá-lo. Nunca falha o webhook.
  if (type === 'payment' && dataId) {
    try {
      const payment = await deps.mp.getPayment(dataId);
      logInfo('payment_diagnostic', {
        status: payment.status,
        status_detail: payment.status_detail ?? null,
        has_external_reference: Boolean(payment.external_reference),
        transaction_amount: payment.transaction_amount ?? null,
        point_of_interaction_type: payment.point_of_interaction?.type ?? null,
      });
    } catch (error) {
      logWarn('payment_diagnostic_failed', { errorName: errorName(error) });
    }
  }

  try {
    const status = await handleWebhook(deps, {
      type,
      dataId,
      requestId: requestId as string,
    });
    return res.status(status).json({ received: status === 200 });
  } catch (error) {
    await logError('webhook_handler_failed', { errorName: errorName(error) });
    return res.status(500).json({ error: 'Erro interno.' });
  }
}
