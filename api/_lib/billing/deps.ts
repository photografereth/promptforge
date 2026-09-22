import { createResendMailer } from './mailer.js';
import { createMpClient } from './mercadopago.js';
import { createSupabaseRepo } from './repo.js';
import type { Deps } from './service/context.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} precisa estar definida no ambiente do servidor.`);
  return value;
}

// Fiação real (produção/dev). Testes nunca chamam isto: montam Deps com fakes.
export function buildDeps(): Deps {
  const appUrl = required('APP_URL').replace(/\/$/, '');
  return {
    mp: createMpClient(required('MP_ACCESS_TOKEN')),
    repo: createSupabaseRepo(),
    // Sem RESEND_API_KEY/MAIL_FROM o envio falha e é registrado, sem afetar a operação.
    mailer: createResendMailer(process.env.RESEND_API_KEY ?? '', process.env.MAIL_FROM ?? ''),
    now: () => new Date(),
    appUrl,
    publicKey: process.env.MP_PUBLIC_KEY ?? '',
    // MP_NOTIFICATION_URL_OVERRIDE existe só para ambientes protegidos (ex.: Preview da Vercel
    // com Deployment Protection ligado), onde a URL do webhook precisa carregar o bypass como
    // query param. Em produção com domínio próprio, a Deployment Protection não se aplica e
    // esta variável deve ficar vazia — o padrão (sem override) já é o correto.
    notificationUrl: process.env.MP_NOTIFICATION_URL_OVERRIDE || `${appUrl}/api/webhooks/mercadopago`,
  };
}
