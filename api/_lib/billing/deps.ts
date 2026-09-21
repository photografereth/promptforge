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
  return {
    mp: createMpClient(required('MP_ACCESS_TOKEN')),
    repo: createSupabaseRepo(),
    // Sem RESEND_API_KEY/MAIL_FROM o envio falha e é registrado, sem afetar a operação.
    mailer: createResendMailer(process.env.RESEND_API_KEY ?? '', process.env.MAIL_FROM ?? ''),
    now: () => new Date(),
    appUrl: required('APP_URL').replace(/\/$/, ''),
    publicKey: process.env.MP_PUBLIC_KEY ?? '',
  };
}
