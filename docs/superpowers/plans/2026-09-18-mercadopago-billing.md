# Pilar 2: Cobrança Recorrente via Mercado Pago Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cobrança recorrente real via Mercado Pago (planos mensal R$119/anual R$948), com webhook validado criptograficamente sincronizando `profiles.subscription_status`, e bloqueio real de acesso às rotas de IA para quem não está com assinatura ativa.

**Architecture:** Backend ganha um conjunto de rotas `/api/mercadopago/*` (criar assinatura, cancelar, trocar cartão, listar faturas) e `/api/webhooks/mercadopago` (recebe eventos assíncronos do Mercado Pago, valida `x-signature`, sincroniza o banco). Um Vercel Cron Job diário processa cancelamentos agendados. O frontend ganha um "paywall" que substitui a bancada de trabalho quando o usuário não tem assinatura ativa, e um portal simples de gestão (cancelar/trocar cartão/faturas).

**Tech Stack:** Mesmo stack do Pilar 1 (React/Vite, Vercel Serverless Functions, Supabase). Sem dependências novas — a API do Mercado Pago é chamada via `fetch` puro (não usa o SDK oficial `mercadopago` para Node, para manter o padrão já estabelecido de helpers finos em `api/_lib/`).

**Spec:** `docs/superpowers/specs/2026-09-18-mercadopago-billing-design.md`

## Global Constraints

- Toda copy de UI é em português do Brasil, no mesmo tom já usado no projeto.
- Não introduzir framework de testes automatizados — mesma decisão do Pilar 1.
- Nomes de variáveis de ambiente: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CRON_SECRET` (todas server-only, nunca `VITE_`-prefixadas). **Nenhum valor real dessas variáveis deve aparecer literalmente em código, commits ou neste plano** — sempre lidas de `process.env`.
- Toda escrita em `profiles` relacionada a assinatura passa pelo `supabaseAdmin` (service role) no backend — nunca escrita direto do cliente.
- A API do Mercado Pago não tem ambiente de sandbox: toda chamada, de teste ou produção, vai para `https://api.mercadopago.com`. Testes de ponta a ponta com assinatura `authorized` agendam cobranças reais (contra saldo de teste) e nunca devem ser automatizados — são sempre manuais, únicos, seguidos de cancelamento imediato (ver Task 14).
- **Atenção a dois pontos não 100% confirmados na pesquisa técnica**, que a implementação deve verificar contra a resposta real da API ao integrar (não são bloqueadores, mas podem exigir um pequeno ajuste): (1) os valores exatos do campo `status` em `GET /authorized_payments/{id}` (`approved`/`processed` foram assumidos com base em convenções da API de Payments — confirmar contra uma resposta real); (2) se `preapproval` expõe um campo `next_payment_date` que simplificaria o cálculo de `current_period_end` (a Task 5 já calcula isso localmente como alternativa robusta, então isso é uma otimização opcional, não uma correção obrigatória).
- Registro de webhook no painel do Mercado Pago exige uma URL pública HTTPS — indisponível localmente. Testes de webhook na Task 5 usam envio manual de payload sintético (`curl`) contra `vercel dev`; o teste com um webhook real do Mercado Pago só é possível após o deploy (Pilar 4) ou com um túnel (ex: ngrok), fora de escopo deste plano.

---

### Task 1: Provisionar credenciais do Mercado Pago

**Este é um passo manual** — o usuário já tem conta e credenciais do Mercado Pago (diferente do Supabase no Pilar 1, aqui não é preciso criar conta do zero).

**Files:**
- Modify: `.env.example`

**Interfaces:**
- Produces: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CRON_SECRET` disponíveis em `.env.local` para todas as tasks seguintes.

- [ ] **Step 1: Copiar o Access Token**

No painel do Mercado Pago (developers.mercadopago.com.br), em **Suas integrações → [sua aplicação] → Credenciais de produção** (ou de teste, se preferir testar primeiro com uma aplicação de teste), copie o Access Token.

- [ ] **Step 2: Gerar o segredo de assinatura de webhook**

Em **Suas integrações → [sua aplicação] → Webhooks**, configure uma URL de notificação (pode ser um placeholder por enquanto, ex: `https://example.com/api/webhooks/mercadopago` — só será exercitada de verdade após o deploy) e copie o segredo de assinatura gerado nessa tela.

- [ ] **Step 3: Gerar um segredo para o cron**

Gere uma string aleatória longa (ex: `openssl rand -hex 32`) — não vem do Mercado Pago, é só um segredo nosso para proteger o endpoint de cron contra chamadas externas.

- [ ] **Step 4: Atualizar `.env.example`**

Adicionar ao final do arquivo três linhas, seguindo exatamente o mesmo padrão das variáveis já existentes (nome da variável, sinal de igual, um valor placeholder entre aspas que deixe claro que não é um segredo real — nunca um valor real neste arquivo, que é commitado):

- Uma linha de comentário explicando que são credenciais da aplicação Mercado Pago (developers.mercadopago.com.br), seguida de `MP_ACCESS_TOKEN` com um placeholder curto indicando "cole seu access token aqui".
- Uma linha de comentário explicando que é o segredo de assinatura da tela de Webhooks da aplicação, seguida de `MP_WEBHOOK_SECRET` com um placeholder curto indicando "cole o segredo aqui".
- Uma linha de comentário explicando que é gerado localmente (ex: `openssl rand -hex 32`) para proteger o endpoint de cron, seguida de `CRON_SECRET` com um placeholder curto indicando "cole o segredo aqui".

Use placeholders curtos e obviamente genéricos (algo como `"cole-aqui"`), não frases longas que possam se parecer com um valor real — mantenha o mesmo espírito do `GEMINI_API_KEY`/`SUPABASE_ANON_KEY` já documentados no arquivo, só que com um placeholder mais curto para essas três novas linhas.

- [ ] **Step 5: Atualizar `.env.local`**

Copie as 3 variáveis com os valores reais para `.env.local` (arquivo gitignored, nunca commitado).

- [ ] **Step 6: Commit**

```bash
git add .env.example
git commit -m "chore: document Mercado Pago and cron env vars"
```

---

### Task 2: Migração do banco + service role client

**Files:**
- Create: `supabase/migrations/0002_billing.sql`
- Create: `api/_lib/supabaseAdmin.ts`

**Interfaces:**
- Produces: colunas `mercadopago_preapproval_id`, `pending_preapproval_id`, `current_period_end`, `cancel_at_period_end` em `public.profiles`; tabela `public.webhook_events`; `supabaseAdmin: SupabaseClient` (service role, uso server-only).
- Consumes: nada.

- [ ] **Step 1: Escrever a migração**

Criar `supabase/migrations/0002_billing.sql`:

```sql
-- Pilar 2: Cobrança recorrente via Mercado Pago

alter table public.profiles
  add column mercadopago_preapproval_id text,
  add column pending_preapproval_id text,
  add column current_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false;

create table public.webhook_events (
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  primary key (event_id, event_type)
);

alter table public.webhook_events enable row level security;
-- Nenhuma policy para usuários comuns: só o service role (usado pelo
-- webhook handler) lê/escreve esta tabela.

-- Fecha a brecha de segurança deixada pendente pelo Pilar 1: a policy de
-- update permitia o usuário alterar seu próprio subscription_status via
-- anon key. A partir deste pilar, toda escrita em profiles relacionada a
-- assinatura passa pelos endpoints de backend (service role).
drop policy if exists "profiles_update_own" on public.profiles;
```

- [ ] **Step 2: Aplicar a migração**

No painel do Supabase, SQL Editor → New query → cole o conteúdo do arquivo → Run. Confirme em Table Editor que `profiles` tem as 4 novas colunas e que `webhook_events` foi criada.

- [ ] **Step 3: Criar `api/_lib/supabaseAdmin.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas no ambiente do servidor.'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

- [ ] **Step 4: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_billing.sql api/_lib/supabaseAdmin.ts
git commit -m "feat: add billing columns/webhook_events table and service-role client"
```

---

### Task 3: `api/_lib/mercadopago.ts` — client HTTP + validação de assinatura

**Files:**
- Create: `api/_lib/mercadopago.ts`

**Interfaces:**
- Produces:
  - `mpFetch(path: string, init?: RequestInit): Promise<any>` — chama `https://api.mercadopago.com<path>` com `Authorization: Bearer <MP_ACCESS_TOKEN>`, lança erro em resposta não-ok.
  - `verifyWebhookSignature(params: { xSignature?: string; xRequestId?: string; dataId: string }): boolean`
  - `PLAN_CONFIG: Record<'monthly' | 'annual', { reason: string; frequency: number; frequency_type: 'months' | 'years'; transaction_amount: number }>`
- Consumes: nada.

- [ ] **Step 1: Criar `api/_lib/mercadopago.ts`**

```ts
import crypto from 'crypto';

const MP_API_BASE = 'https://api.mercadopago.com';

export const PLAN_CONFIG = {
  monthly: {
    reason: 'Flow Prompt Forge — Plano Mensal',
    frequency: 1,
    frequency_type: 'months' as const,
    transaction_amount: 119.0,
  },
  annual: {
    reason: 'Flow Prompt Forge — Plano Anual',
    frequency: 1,
    frequency_type: 'years' as const,
    transaction_amount: 948.0,
  },
};

function getMPAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MP_ACCESS_TOKEN não configurada no ambiente do servidor.');
  }
  return token;
}

export async function mpFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = getMPAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${MP_API_BASE}${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || `Erro na API do Mercado Pago (${response.status}).`);
  }

  return data;
}

export function verifyWebhookSignature(params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string;
}): boolean {
  const { xSignature, xRequestId, dataId } = params;
  if (!xSignature || !xRequestId) return false;

  const parts: Record<string, string> = {};
  for (const part of xSignature.split(',')) {
    const [key, value] = part.split('=');
    if (key && value) parts[key.trim()] = value.trim();
  }

  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  const envSecret = process.env.MP_WEBHOOK_SECRET;
  if (!envSecret) {
    throw new Error('MP_WEBHOOK_SECRET não configurada no ambiente do servidor.');
  }

  const canonical = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', envSecret).update(canonical).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(v1, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Testar a validação de assinatura isoladamente**

Escreva um script temporário local (não commitado, ex: `/tmp/verify-signature-check.mjs`) que importa `verifyWebhookSignature` de `api/_lib/mercadopago.ts`, define a variável de ambiente que a função lê com um valor de teste qualquer definido na hora (não reaproveite o segredo real de produção neste script), calcula manualmente o HMAC esperado para uma combinação arbitrária de `dataId`/`ts`/`xRequestId` usando o módulo `crypto` do Node (mesma fórmula do arquivo: `HMAC-SHA256` sobre `id:<dataId>;request-id:<xRequestId>;ts:<ts>;`), e confirma que:
1. Passar exatamente esses três valores retorna `true`.
2. Alterar um único caractere do hash calculado retorna `false`.
3. Omitir `xRequestId` retorna `false`.

Apague o script depois de confirmar (é só uma verificação pontual, não faz parte do repositório).

- [ ] **Step 4: Commit**

```bash
git add api/_lib/mercadopago.ts
git commit -m "feat: add Mercado Pago API client and webhook signature validation"
```

---

### Task 4: `POST /api/mercadopago/create-subscription`

**Files:**
- Create: `api/mercadopago/create-subscription.ts`

**Interfaces:**
- Consumes: `authenticate` (`api/_lib/auth.ts`), `mpFetch`/`PLAN_CONFIG` (`api/_lib/mercadopago.ts`, Task 3), `supabaseAdmin` (`api/_lib/supabaseAdmin.ts`, Task 2).
- Produces: endpoint `POST /api/mercadopago/create-subscription`, body `{ plan: 'monthly' | 'annual' }` → `{ success: true, initPoint: string }`.

- [ ] **Step 1: Criar `api/mercadopago/create-subscription.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from '../_lib/auth';
import { mpFetch, PLAN_CONFIG } from '../_lib/mercadopago';
import { supabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
  if (!user) return;

  const { plan } = req.body ?? {};
  if (plan !== 'monthly' && plan !== 'annual') {
    return res.status(400).json({ error: "O campo 'plan' deve ser 'monthly' ou 'annual'." });
  }

  const config = PLAN_CONFIG[plan];
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

  try {
    const preapproval = await mpFetch('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: config.reason,
        external_reference: user.id,
        payer_email: user.email,
        auto_recurring: {
          frequency: config.frequency,
          frequency_type: config.frequency_type,
          transaction_amount: config.transaction_amount,
          currency_id: 'BRL',
        },
        back_url: `${appUrl}/?subscription_confirm=1`,
        status: 'pending',
      }),
    });

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ mercadopago_preapproval_id: preapproval.id })
      .eq('id', user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    res.json({ success: true, initPoint: preapproval.init_point });
  } catch (error: any) {
    console.error('Falha ao criar assinatura no Mercado Pago:', error.message);
    res.status(500).json({ error: 'Não foi possível iniciar sua assinatura. Tente novamente.' });
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Testar sem token (401) e sem plano válido (400, com token)**

```bash
curl -i -X POST http://localhost:3000/api/mercadopago/create-subscription \
  -H "Content-Type: application/json" \
  -d '{"plan":"monthly"}'
# Expected: 401

curl -i -X POST http://localhost:3000/api/mercadopago/create-subscription \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"plan":"invalid"}'
# Expected: 400
```

- [ ] **Step 4: Commit**

```bash
git add api/mercadopago/create-subscription.ts
git commit -m "feat: add /api/mercadopago/create-subscription"
```

---

### Task 5: Webhook `POST /api/webhooks/mercadopago`

**Files:**
- Create: `api/webhooks/mercadopago.ts`

**Interfaces:**
- Consumes: `mpFetch`/`verifyWebhookSignature` (Task 3), `supabaseAdmin` (Task 2).
- Produces: endpoint público `POST /api/webhooks/mercadopago`, sempre responde `200` quando a assinatura é válida (mesmo se o processamento interno falhar — ver tratamento de erro no código).

- [ ] **Step 1: Criar `api/webhooks/mercadopago.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mpFetch, verifyWebhookSignature } from '../_lib/mercadopago';
import { supabaseAdmin } from '../_lib/supabaseAdmin';

function mapMPStatusToSubscriptionStatus(
  mpStatus: string
): 'active' | 'past_due' | 'canceled' | null {
  switch (mpStatus) {
    case 'authorized':
      return 'active';
    case 'paused':
      return 'past_due';
    case 'cancelled':
      return 'canceled';
    default:
      return null;
  }
}

function derivePlanFromAutoRecurring(autoRecurring: any): 'monthly' | 'annual' | null {
  if (!autoRecurring) return null;
  if (autoRecurring.frequency_type === 'years') return 'annual';
  if (autoRecurring.frequency_type === 'months' && autoRecurring.frequency === 1) return 'monthly';
  return null;
}

// Nota: se `preapproval` expuser um campo nativo de próxima cobrança
// (ex: next_payment_date), prefira-o a este cálculo — verificar contra a
// resposta real da API durante a implementação (ver Global Constraints).
function computeNextPeriodEnd(autoRecurring: any, fromDate: Date): Date | null {
  if (!autoRecurring) return null;
  const next = new Date(fromDate);
  if (autoRecurring.frequency_type === 'months') {
    next.setMonth(next.getMonth() + (autoRecurring.frequency || 1));
  } else if (autoRecurring.frequency_type === 'years') {
    next.setFullYear(next.getFullYear() + (autoRecurring.frequency || 1));
  } else {
    return null;
  }
  return next;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { type, data } = req.body ?? {};
  const dataId = data?.id;

  if (!type || !dataId) {
    return res.status(400).json({ error: 'Payload de webhook inválido.' });
  }

  const xSignature = req.headers['x-signature'] as string | undefined;
  const xRequestId = req.headers['x-request-id'] as string | undefined;

  let signatureValid = false;
  try {
    signatureValid = verifyWebhookSignature({ xSignature, xRequestId, dataId: String(dataId) });
  } catch (error: any) {
    console.error('Falha ao validar assinatura do webhook:', error.message);
    return res.status(500).json({ error: 'Erro interno ao validar webhook.' });
  }

  if (!signatureValid) {
    return res.status(401).json({ error: 'Assinatura inválida.' });
  }

  // Idempotência: registra o evento antes de processar. Se a inserção falhar
  // por violação de chave primária, o evento já foi processado — encerra sem
  // reprocessar.
  const { error: insertError } = await supabaseAdmin
    .from('webhook_events')
    .insert({ event_id: String(dataId), event_type: type });

  if (insertError) {
    if (insertError.code === '23505') {
      return res.status(200).json({ received: true, duplicate: true });
    }
    console.error('Falha ao registrar evento de webhook:', insertError.message);
    return res.status(500).json({ error: 'Erro interno ao processar webhook.' });
  }

  try {
    if (type === 'subscription_preapproval') {
      const preapproval = await mpFetch(`/preapproval/${dataId}`);
      const userId = preapproval.external_reference;
      if (!userId) {
        console.warn('Webhook subscription_preapproval sem external_reference:', dataId);
        return res.status(200).json({ received: true });
      }

      const mappedStatus = mapMPStatusToSubscriptionStatus(preapproval.status);
      const plan = derivePlanFromAutoRecurring(preapproval.auto_recurring);

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('mercadopago_preapproval_id, pending_preapproval_id')
        .eq('id', userId)
        .single();

      const updates: Record<string, any> = {};

      // Se esta preapproval é uma substituição pendente (troca de cartão) e
      // acabou de ser autorizada, promove-a a assinatura principal e cancela
      // a antiga.
      if (
        profile?.pending_preapproval_id === String(dataId) &&
        preapproval.status === 'authorized'
      ) {
        const oldPreapprovalId = profile.mercadopago_preapproval_id;
        if (oldPreapprovalId && oldPreapprovalId !== String(dataId)) {
          try {
            await mpFetch(`/preapproval/${oldPreapprovalId}`, {
              method: 'PUT',
              body: JSON.stringify({ status: 'cancelled' }),
            });
          } catch (err: any) {
            console.warn('Falha ao cancelar preapproval antiga na troca de cartão:', err.message);
          }
        }
        updates.mercadopago_preapproval_id = String(dataId);
        updates.pending_preapproval_id = null;
      }

      if (mappedStatus) {
        updates.subscription_status = mappedStatus;
      }
      if (plan) {
        updates.plan = plan;
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
      }
    } else if (type === 'subscription_authorized_payment') {
      const payment = await mpFetch(`/authorized_payments/${dataId}`);
      const preapprovalId = payment.preapproval_id;
      if (!preapprovalId) {
        console.warn('Webhook subscription_authorized_payment sem preapproval_id:', dataId);
        return res.status(200).json({ received: true });
      }

      const preapproval = await mpFetch(`/preapproval/${preapprovalId}`);
      const userId = preapproval.external_reference;
      if (!userId) {
        return res.status(200).json({ received: true });
      }

      if (payment.status === 'approved' || payment.status === 'processed') {
        const nextPeriodEnd = computeNextPeriodEnd(preapproval.auto_recurring, new Date());
        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_status: 'active',
            current_period_end: nextPeriodEnd ? nextPeriodEnd.toISOString() : null,
          })
          .eq('id', userId);
      } else {
        await supabaseAdmin
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('id', userId);
      }
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Falha ao processar webhook do Mercado Pago:', error.message);
    // Responde 200 mesmo em erro de processamento: o evento já foi marcado
    // como recebido (idempotência acima) — um 5xx aqui faria o Mercado Pago
    // reenviar e colidir com a constraint de idempotência sem nunca
    // completar o processamento.
    res.status(200).json({ received: true, processingError: true });
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Testar rejeição de assinatura inválida**

```bash
curl -i -X POST http://localhost:3000/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=1700000000,v1=nao-e-um-hmac-valido" \
  -H "x-request-id: test-request" \
  -d '{"type":"subscription_preapproval","data":{"id":"123"}}'
# Expected: 401
```

E teste payload sem headers de assinatura:

```bash
curl -i -X POST http://localhost:3000/api/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -d '{"type":"subscription_preapproval","data":{"id":"123"}}'
# Expected: 401 (sem x-signature/x-request-id)
```

- [ ] **Step 4: Commit**

```bash
git add api/webhooks/mercadopago.ts
git commit -m "feat: add Mercado Pago webhook receiver with signature validation and idempotency"
```

---

### Task 6: Cancelamento (flag + cron)

**Files:**
- Create: `api/mercadopago/cancel-subscription.ts`
- Create: `api/cron/process-cancellations.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `authenticate` (Task 3 do Pilar 1), `mpFetch` (Task 3), `supabaseAdmin` (Task 2).
- Produces: endpoint `POST /api/mercadopago/cancel-subscription` → `{ success: true }`; endpoint `GET /api/cron/process-cancellations` (protegido por `CRON_SECRET`), acionado diariamente pelo Vercel Cron.

- [ ] **Step 1: Criar `api/mercadopago/cancel-subscription.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from '../_lib/auth';
import { supabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
  if (!user) return;

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ cancel_at_period_end: true })
    .eq('id', user.id);

  if (error) {
    console.error('Falha ao marcar cancelamento:', error.message);
    return res.status(500).json({ error: 'Não foi possível cancelar sua assinatura. Tente novamente.' });
  }

  res.json({ success: true });
}
```

- [ ] **Step 2: Criar `api/cron/process-cancellations.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mpFetch } from '../_lib/mercadopago';
import { supabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization || '';
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  const nowIso = new Date().toISOString();

  const { data: dueProfiles, error: selectError } = await supabaseAdmin
    .from('profiles')
    .select('id, mercadopago_preapproval_id')
    .eq('cancel_at_period_end', true)
    .eq('subscription_status', 'active')
    .lte('current_period_end', nowIso);

  if (selectError) {
    console.error('Falha ao buscar assinaturas a cancelar:', selectError.message);
    return res.status(500).json({ error: 'Erro interno.' });
  }

  const results = { processed: 0, failed: 0 };

  for (const profile of dueProfiles || []) {
    if (!profile.mercadopago_preapproval_id) continue;
    try {
      await mpFetch(`/preapproval/${profile.mercadopago_preapproval_id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_status: 'canceled', cancel_at_period_end: false })
        .eq('id', profile.id);
      results.processed += 1;
    } catch (error: any) {
      console.error(`Falha ao cancelar assinatura do usuário ${profile.id}:`, error.message);
      results.failed += 1;
    }
  }

  res.json({ success: true, ...results });
}
```

- [ ] **Step 3: Criar `vercel.json`**

Na raiz do projeto (não existe ainda):

```json
{
  "crons": [
    {
      "path": "/api/cron/process-cancellations",
      "schedule": "0 9 * * *"
    }
  ]
}
```

(9h UTC = 6h no horário de Brasília, um horário de baixo tráfego para rodar o job diário.)

- [ ] **Step 4: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 5: Testar o endpoint de cron sem/com o secret correto**

```bash
curl -i http://localhost:3000/api/cron/process-cancellations
# Expected: 401

curl -i http://localhost:3000/api/cron/process-cancellations \
  -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d'\"' -f2)"
# Expected: 200, { success: true, processed: 0, failed: 0 } (sem assinaturas vencidas ainda)
```

- [ ] **Step 6: Commit**

```bash
git add api/mercadopago/cancel-subscription.ts api/cron/process-cancellations.ts vercel.json
git commit -m "feat: add cancel-at-period-end flow with daily Vercel Cron enforcement"
```

---

### Task 7: Trocar cartão — `POST /api/mercadopago/update-card`

**Files:**
- Create: `api/mercadopago/update-card.ts`

**Interfaces:**
- Consumes: `authenticate`, `mpFetch`/`PLAN_CONFIG` (Task 3), `supabaseAdmin` (Task 2). Produz o estado (`pending_preapproval_id`) que o webhook da Task 5 já sabe consumir para promover/trocar a assinatura.
- Produces: endpoint `POST /api/mercadopago/update-card` → `{ success: true, initPoint: string }`.

- [ ] **Step 1: Criar `api/mercadopago/update-card.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from '../_lib/auth';
import { mpFetch, PLAN_CONFIG } from '../_lib/mercadopago';
import { supabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
  if (!user) return;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.plan) {
    return res.status(400).json({ error: 'Nenhuma assinatura ativa encontrada para trocar o cartão.' });
  }

  const config = PLAN_CONFIG[profile.plan as 'monthly' | 'annual'];
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

  try {
    const preapproval = await mpFetch('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: config.reason,
        external_reference: user.id,
        payer_email: user.email,
        auto_recurring: {
          frequency: config.frequency,
          frequency_type: config.frequency_type,
          transaction_amount: config.transaction_amount,
          currency_id: 'BRL',
        },
        back_url: `${appUrl}/?subscription_confirm=1`,
        status: 'pending',
      }),
    });

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ pending_preapproval_id: preapproval.id })
      .eq('id', user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    res.json({ success: true, initPoint: preapproval.init_point });
  } catch (error: any) {
    console.error('Falha ao iniciar troca de cartão:', error.message);
    res.status(500).json({ error: 'Não foi possível iniciar a troca de cartão. Tente novamente.' });
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Testar sem token (401) e sem assinatura (400, com token)**

```bash
curl -i -X POST http://localhost:3000/api/mercadopago/update-card \
  -H "Content-Type: application/json"
# Expected: 401

curl -i -X POST http://localhost:3000/api/mercadopago/update-card \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
# Expected: 400 se o usuário não tiver `plan` definido ainda em profiles
```

- [ ] **Step 4: Commit**

```bash
git add api/mercadopago/update-card.ts
git commit -m "feat: add /api/mercadopago/update-card (cancel-and-recreate flow)"
```

---

### Task 8: Histórico de faturas — `GET /api/mercadopago/invoices`

**Files:**
- Create: `api/mercadopago/invoices.ts`

**Interfaces:**
- Consumes: `authenticate`, `mpFetch` (Task 3), `supabaseAdmin` (Task 2).
- Produces: endpoint `GET /api/mercadopago/invoices` → `{ success: true, invoices: Array<{ id: string; date: string; amount: number; status: string }> }`.

- [ ] **Step 1: Criar `api/mercadopago/invoices.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from '../_lib/auth';
import { mpFetch } from '../_lib/mercadopago';
import { supabaseAdmin } from '../_lib/supabaseAdmin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
  if (!user) return;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('mercadopago_preapproval_id')
    .eq('id', user.id)
    .single();

  if (!profile?.mercadopago_preapproval_id) {
    return res.json({ success: true, invoices: [] });
  }

  try {
    const result = await mpFetch(
      `/authorized_payments/search?preapproval_id=${encodeURIComponent(profile.mercadopago_preapproval_id)}`
    );

    const invoices = (result.results || []).map((payment: any) => ({
      id: payment.id,
      date: payment.date_created,
      amount: payment.transaction_amount,
      status: payment.status,
    }));

    res.json({ success: true, invoices });
  } catch (error: any) {
    console.error('Falha ao buscar histórico de faturas:', error.message);
    res.status(500).json({ error: 'Não foi possível carregar o histórico de faturas.' });
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Testar sem token (401) e sem assinatura (200 com lista vazia)**

```bash
curl -i http://localhost:3000/api/mercadopago/invoices
# Expected: 401

curl -i http://localhost:3000/api/mercadopago/invoices \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
# Expected: 200, { success: true, invoices: [] } se o usuário não tiver mercadopago_preapproval_id
```

- [ ] **Step 4: Commit**

```bash
git add api/mercadopago/invoices.ts
git commit -m "feat: add /api/mercadopago/invoices"
```

---

### Task 9: Paywall no backend — bloquear as 4 rotas de IA

**Files:**
- Create: `api/_lib/subscription.ts`
- Modify: `api/autofill.ts`, `api/enhance.ts`, `api/analyze-references.ts`, `api/parse-product-url.ts`

**Interfaces:**
- Produces: `requireActiveSubscription(userId: string, res: VercelResponse): Promise<boolean>` — já escreve a resposta 403 e retorna `false` se a assinatura não estiver ativa.
- Consumes (nas 4 rotas): `authenticate` (já existente), `requireActiveSubscription` (novo).

- [ ] **Step 1: Criar `api/_lib/subscription.ts`**

```ts
import type { VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';

export async function requireActiveSubscription(
  userId: string,
  res: VercelResponse
): Promise<boolean> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single();

  if (error || !profile || profile.subscription_status !== 'active') {
    res.status(403).json({ error: 'Assinatura necessária para usar este recurso.' });
    return false;
  }

  return true;
}
```

- [ ] **Step 2: Adicionar o gate em `api/autofill.ts`**

Adicionar o import no topo:

```ts
import { requireActiveSubscription } from './_lib/subscription';
```

Logo após o bloco existente:

```ts
  const user = await authenticate(req, res);
  if (!user) return;
```

adicionar:

```ts
  const hasActiveSubscription = await requireActiveSubscription(user.id, res);
  if (!hasActiveSubscription) return;
```

- [ ] **Step 3: Repetir o mesmo padrão em `api/enhance.ts`, `api/analyze-references.ts` e `api/parse-product-url.ts`**

Mesmo import e mesmo bloco de 2 linhas, logo após o `if (!user) return;` existente em cada arquivo.

- [ ] **Step 4: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 5: Testar com token válido mas sem assinatura ativa (403)**

```bash
curl -i -X POST http://localhost:3000/api/autofill \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"idea":"teste","mode":"video"}'
# Expected: 403, { error: "Assinatura necessária para usar este recurso." }
# (assumindo que este usuário de teste ainda não tem subscription_status = 'active')
```

- [ ] **Step 6: Commit**

```bash
git add api/_lib/subscription.ts api/autofill.ts api/enhance.ts api/analyze-references.ts api/parse-product-url.ts
git commit -m "feat: require an active subscription on all AI generation routes"
```

---

### Task 10: Frontend — `useProfile` hook

**Files:**
- Create: `src/hooks/useProfile.ts`

**Interfaces:**
- Produces: `useProfile(): { profile: Profile | null; isLoading: boolean; refetch: () => Promise<void> }`, `Profile = { subscriptionStatus: 'trial'|'active'|'past_due'|'canceled'; plan: 'monthly'|'annual'|null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean }`.
- Consumes: `useSupabaseSession` (Pilar 1, `src/hooks/useSupabaseSession.ts`), `supabase` (Pilar 1, `src/lib/supabaseClient.ts`).

- [ ] **Step 1: Criar `src/hooks/useProfile.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseSession } from './useSupabaseSession';

export interface Profile {
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'canceled';
  plan: 'monthly' | 'annual' | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export function useProfile() {
  const { session } = useSupabaseSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!session) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_status, plan, current_period_end, cancel_at_period_end')
      .eq('id', session.user.id)
      .single();

    if (error || !data) {
      setProfile(null);
    } else {
      setProfile({
        subscriptionStatus: data.subscription_status,
        plan: data.plan,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
      });
    }
    setIsLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, isLoading, refetch: fetchProfile };
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProfile.ts
git commit -m "feat: add useProfile hook for subscription state"
```

---

### Task 11: Paywall no frontend — `SubscriptionGate`, tela de confirmação, e wiring em `App.tsx`

**Files:**
- Create: `src/components/SubscriptionGate.tsx`
- Create: `src/components/SubscriptionConfirmView.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useProfile` (Task 10), `apiFetch` (Pilar 1, `src/lib/apiFetch.ts`), `useSupabaseSession`/`isAuthenticated` (já existentes em `App.tsx` desde o Pilar 1).
- Produces: substitui a bancada de trabalho por uma tela de assinatura quando `isAuthenticated && profile.subscriptionStatus !== 'active'`.

- [ ] **Step 1: Criar `src/components/SubscriptionGate.tsx`**

```tsx
import React, { useState } from 'react';
import { apiFetch } from '../lib/apiFetch';

export const SubscriptionGate: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState<'monthly' | 'annual' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    setIsProcessing(plan);
    setErrorMessage(null);
    try {
      const response = await apiFetch('/api/mercadopago/create-subscription', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (!response.ok || !data.initPoint) {
        throw new Error(data.error || 'Não foi possível iniciar a assinatura.');
      }
      window.location.href = data.initPoint;
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível iniciar a assinatura. Tente novamente.');
      setIsProcessing(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-neutral-900/60 border border-neutral-800 rounded-lg p-8 text-center space-y-6">
        <div>
          <span className="font-mono text-[10px] tracking-widest uppercase text-amber-400">
            ASSINATURA NECESSÁRIA
          </span>
          <h2 className="text-xl font-black uppercase text-neutral-100 mt-1">
            Assine para continuar usando o Flow Prompt Forge
          </h2>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-950/70 border border-red-800/80 rounded text-xs text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleSubscribe('monthly')}
            disabled={isProcessing !== null}
            className="p-4 border border-neutral-800 rounded-lg hover:border-amber-400 transition-all text-left disabled:opacity-50 cursor-pointer"
          >
            <div className="text-xs font-mono uppercase text-neutral-400">Mensal</div>
            <div className="text-lg font-black text-amber-400">R$ 119,00</div>
            <div className="text-[10px] text-neutral-500">por mês</div>
            {isProcessing === 'monthly' && (
              <div className="text-[10px] text-amber-400 mt-1">Redirecionando...</div>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSubscribe('annual')}
            disabled={isProcessing !== null}
            className="p-4 border border-neutral-800 rounded-lg hover:border-amber-400 transition-all text-left disabled:opacity-50 cursor-pointer"
          >
            <div className="text-xs font-mono uppercase text-neutral-400">Anual</div>
            <div className="text-lg font-black text-amber-400">R$ 948,00</div>
            <div className="text-[10px] text-neutral-500">equivale a 12x R$ 79,00</div>
            {isProcessing === 'annual' && (
              <div className="text-[10px] text-amber-400 mt-1">Redirecionando...</div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Criar `src/components/SubscriptionConfirmView.tsx`**

```tsx
import React, { useEffect, useState } from 'react';

interface SubscriptionConfirmViewProps {
  isActive: boolean;
  onRefetch: () => Promise<void>;
  onConfirmed: () => void;
}

export const SubscriptionConfirmView: React.FC<SubscriptionConfirmViewProps> = ({
  isActive,
  onRefetch,
  onConfirmed,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (isActive) {
      onConfirmed();
      return;
    }

    if (elapsedSeconds >= 30) return;

    const timer = setTimeout(async () => {
      await onRefetch();
      setElapsedSeconds((s) => s + 3);
    }, 3000);

    return () => clearTimeout(timer);
  }, [elapsedSeconds, isActive, onRefetch, onConfirmed]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <span className="font-mono text-[10px] tracking-widest uppercase text-amber-400">
          MERCADO PAGO
        </span>
        <h2 className="text-lg font-black uppercase">
          {elapsedSeconds >= 30 ? 'Ainda processando seu pagamento' : 'Confirmando seu pagamento...'}
        </h2>
        <p className="text-xs text-neutral-400">
          {elapsedSeconds >= 30
            ? 'Isso está demorando mais que o esperado. Atualize a página em alguns instantes.'
            : 'Isso pode levar alguns segundos.'}
        </p>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Ler `src/App.tsx` por completo antes de editar**

Este arquivo já foi editado em várias tasks do Pilar 1 — leia o conteúdo atual (não assuma números de linha) antes de aplicar os edits abaixo, e localize os blocos pelo texto exato.

- [ ] **Step 4: Adicionar imports em `src/App.tsx`**

Junto aos outros imports de `./hooks`/`./lib` (adicionados no Pilar 1):

```ts
import { useProfile } from './hooks/useProfile';
import { SubscriptionGate } from './components/SubscriptionGate';
import { SubscriptionConfirmView } from './components/SubscriptionConfirmView';
```

- [ ] **Step 5: Adicionar o hook de perfil e a detecção da URL de confirmação**

Logo após a linha que declara `const { session } = useSupabaseSession();` (adicionada no Pilar 1, dentro do componente `App`), adicionar:

```ts
  const { profile, refetch: refetchProfile } = useProfile();
  const isSubscriptionConfirmView =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('subscription_confirm') === '1';
```

- [ ] **Step 6: Interceptar a view de app para mostrar confirmação ou paywall**

Localize o comentário `// 2. Application Workbench View` e o `return (` logo abaixo dele (a view principal do app, que hoje renderiza a bancada de trabalho direto quando `currentView === 'app'`). Imediatamente **antes** desse `return`, adicionar:

```tsx
  if (currentView === 'app' && isSubscriptionConfirmView) {
    return (
      <SubscriptionConfirmView
        isActive={profile?.subscriptionStatus === 'active'}
        onRefetch={refetchProfile}
        onConfirmed={() => {
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  if (currentView === 'app' && isAuthenticated && profile && profile.subscriptionStatus !== 'active') {
    return <SubscriptionGate />;
  }
```

(`isAuthenticated` já existe desde o Pilar 1, Task 11.)

- [ ] **Step 7: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add src/components/SubscriptionGate.tsx src/components/SubscriptionConfirmView.tsx src/App.tsx
git commit -m "feat: gate the app workbench behind an active subscription"
```

---

### Task 12: Portal de gestão da assinatura

**Files:**
- Create: `src/components/SubscriptionPortalModal.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `apiFetch` (Pilar 1), `Profile` type (Task 10), `useProfile` (Task 10).
- Produces: um botão no Header (visível quando `profile?.subscriptionStatus === 'active'`) que abre o portal.

- [ ] **Step 1: Criar `src/components/SubscriptionPortalModal.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch';
import type { Profile } from '../hooks/useProfile';

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: string;
}

interface SubscriptionPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onProfileChange: () => Promise<void>;
}

export const SubscriptionPortalModal: React.FC<SubscriptionPortalModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileChange,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isChangingCard, setIsChangingCard] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoadingInvoices(true);
    apiFetch('/api/mercadopago/invoices')
      .then((res) => res.json())
      .then((data) => setInvoices(data.invoices || []))
      .catch(() => setInvoices([]))
      .finally(() => setIsLoadingInvoices(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancel = async () => {
    setIsCanceling(true);
    setErrorMessage(null);
    try {
      const response = await apiFetch('/api/mercadopago/cancel-subscription', { method: 'POST' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Não foi possível cancelar.');
      }
      await onProfileChange();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsCanceling(false);
    }
  };

  const handleChangeCard = async () => {
    setIsChangingCard(true);
    setErrorMessage(null);
    try {
      const response = await apiFetch('/api/mercadopago/update-card', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.initPoint) {
        throw new Error(data.error || 'Não foi possível iniciar a troca de cartão.');
      }
      window.location.href = data.initPoint;
    } catch (err: any) {
      setErrorMessage(err.message);
      setIsChangingCard(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-lg p-6 sm:p-8 shadow-2xl text-neutral-100 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <h3 className="text-base font-black uppercase">Minha Assinatura</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono text-neutral-400 hover:text-white px-2 py-1 bg-neutral-900 border border-neutral-800 rounded cursor-pointer"
          >
            [ FECHAR ]
          </button>
        </div>

        <div className="mt-5 space-y-5 text-xs">
          <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-400">Plano</span>
              <span className="font-bold">{profile?.plan === 'annual' ? 'Anual' : 'Mensal'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Status</span>
              <span className="font-bold uppercase">{profile?.subscriptionStatus}</span>
            </div>
            {profile?.cancelAtPeriodEnd && profile?.currentPeriodEnd && (
              <div className="text-amber-400 text-[11px] pt-2 border-t border-neutral-800">
                Cancelada — acesso continua até{' '}
                {new Date(profile.currentPeriodEnd).toLocaleDateString('pt-BR')}.
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-950/70 border border-red-800/80 rounded text-red-200">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleChangeCard}
              disabled={isChangingCard}
              className="flex-1 py-2.5 border border-neutral-700 rounded font-semibold hover:bg-neutral-900 disabled:opacity-50 cursor-pointer"
            >
              {isChangingCard ? 'REDIRECIONANDO...' : 'TROCAR CARTÃO'}
            </button>
            {!profile?.cancelAtPeriodEnd && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCanceling}
                className="flex-1 py-2.5 border border-red-900 text-red-400 rounded font-semibold hover:bg-red-950/40 disabled:opacity-50 cursor-pointer"
              >
                {isCanceling ? 'CANCELANDO...' : 'CANCELAR ASSINATURA'}
              </button>
            )}
          </div>

          <div>
            <div className="font-mono uppercase text-neutral-400 mb-2">Histórico de Faturas</div>
            {isLoadingInvoices ? (
              <div className="text-neutral-500">Carregando...</div>
            ) : invoices.length === 0 ? (
              <div className="text-neutral-500">Nenhuma fatura encontrada ainda.</div>
            ) : (
              <div className="space-y-1">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between py-1.5 border-b border-neutral-900">
                    <span className="text-neutral-400">
                      {new Date(inv.date).toLocaleDateString('pt-BR')}
                    </span>
                    <span>R$ {inv.amount.toFixed(2)}</span>
                    <span className="uppercase text-neutral-500">{inv.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Adicionar um botão em `src/components/Header.tsx`**

Ler o arquivo atual (já editado no Pilar 1, Task 11 — tem `userEmail`/`onLogout`). Adicionar `onOpenSubscription?: () => void` à interface `HeaderProps` e à desestruturação, e um botão no bloco `{/* Right actions */}`, próximo ao bloco de `userEmail`/`onLogout` já existente:

```tsx
          {onOpenSubscription && (
            <button
              type="button"
              onClick={onOpenSubscription}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700/60 transition-all cursor-pointer"
            >
              Minha Assinatura
            </button>
          )}
```

- [ ] **Step 3: Ligar tudo em `src/App.tsx`**

Adicionar import:

```ts
import { SubscriptionPortalModal } from './components/SubscriptionPortalModal';
```

Adicionar um novo estado (junto aos outros `useState` de modais/drawers já existentes, ex: `isSettingsOpen`/`isHistoryOpen`):

```ts
  const [isSubscriptionPortalOpen, setIsSubscriptionPortalOpen] = useState(false);
```

No `<Header ... />` da view de app (já recebe `userEmail`/`onLogout` desde o Pilar 1), adicionar:

```tsx
        onOpenSubscription={() => setIsSubscriptionPortalOpen(true)}
```

E, próximo aos outros modais renderizados no fim do componente (`<PreferencesModal .../>`, `<HistoryDrawer .../>`), adicionar:

```tsx
      <SubscriptionPortalModal
        isOpen={isSubscriptionPortalOpen}
        onClose={() => setIsSubscriptionPortalOpen(false)}
        profile={profile}
        onProfileChange={refetchProfile}
      />
```

- [ ] **Step 4: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/components/SubscriptionPortalModal.tsx src/components/Header.tsx src/App.tsx
git commit -m "feat: add subscription management portal (cancel, change card, invoices)"
```

---

### Task 13: Revisão de segurança dedicada (Mercado Pago)

**Files:** nenhum arquivo de código — task de revisão.

**Interfaces:** nenhuma.

- [ ] **Step 1: Rodar o skill `mercadopago:mp-review`**

Invocar o skill `mercadopago:mp-review` (checklist de segurança local + checklist oficial de qualidade via MCP, se disponível) sobre toda a integração criada nas Tasks 1-9 (`api/mercadopago/*`, `api/webhooks/mercadopago.ts`, `api/cron/process-cancellations.ts`, `api/_lib/mercadopago.ts`, `api/_lib/subscription.ts`).

- [ ] **Step 2: Endereçar achados Críticos/Importantes**

Qualquer achado Crítico ou Importante do checklist deve ser corrigido antes de prosseguir. Achados Menores podem ser registrados e adiados.

- [ ] **Step 3: Commit (se houver correções)**

```bash
git add -A
git commit -m "fix: address findings from mp-review security checklist"
```

---

### Task 14: Verificação manual de ponta a ponta

**Files:** nenhum (task de validação).

**Pré-requisito:** a Task 1 precisa estar completa (credenciais reais no `.env.local`).

- [ ] **Step 1: Subir o ambiente**

```bash
npx vercel dev
```

- [ ] **Step 2: Criar um usuário de teste do Mercado Pago**

Use o skill `mercadopago:mp-test-setup` para criar um comprador de teste com saldo, e `mercadopago:mp-test-cards` para obter um número de cartão de teste aprovado para o Brasil.

- [ ] **Step 3: Assinar o plano mensal**

Com uma sessão Supabase ativa (signup/login do Pilar 1) e sem assinatura, confirme que a tela de paywall aparece. Escolha o plano mensal, complete o checkout do Mercado Pago com o cartão de teste, confirme o retorno via `back_url` e que a tela de "Confirmando seu pagamento..." eventualmente libera o acesso ao app.

- [ ] **Step 4: Confirmar bloqueio antes da assinatura**

Com um segundo usuário (sem assinatura), chame uma rota de IA autenticada e confirme `403`.

- [ ] **Step 5: Cancelar e verificar o cron**

Cancele a assinatura pelo portal, confirme que `cancel_at_period_end = true` e o acesso continua. Force `current_period_end` para o passado diretamente no Supabase (só para este teste) e rode o cron manualmente (`curl` com o segredo do cron lido de `.env.local`, sem digitá-lo literalmente em nenhum arquivo commitado) — confirme que a assinatura foi cancelada de verdade no Mercado Pago e o acesso foi revogado.

- [ ] **Step 6: Trocar cartão**

Pelo portal, inicie a troca de cartão, complete com um novo cartão de teste, confirme que a assinatura antiga foi cancelada no Mercado Pago após a nova ser autorizada.

- [ ] **Step 7: Histórico de faturas**

Confirme que ao menos a cobrança inicial aparece na lista.

- [ ] **Step 8: Cancelar a assinatura de teste no painel do Mercado Pago**

Confirme manualmente no painel que nenhuma assinatura de teste ficou ativa agendando cobranças futuras indesejadas.

- [ ] **Step 9: Registro final**

Se tudo acima passou, este pilar está funcionalmente completo (webhook real, em produção, só pode ser validado após o deploy — Pilar 4). Nenhum commit de código nesta task.
