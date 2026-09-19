# Pilar 2: Assinaturas e Cobrança Recorrente (Mercado Pago) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Controle completo do ciclo de vida da assinatura via Mercado Pago (assinar com Card Payment Brick, trocar plano no fim do período, trocar cartão, cancelar/retomar, arrependimento com reembolso, carência de 7 dias em falha de cobrança, faturas e e-mails), com bloqueio real de acesso às 4 rotas de IA no backend.

**Architecture:** Uma `preapproval` sem plano por usuário, alterada com `PUT`. Estado de negócio em `public.subscriptions` (+ espelho em `profiles`), alimentado por webhook validado (HMAC) e por um cron diário de reconciliação. Regras de negócio vivem em serviços puros (`api/_lib/billing/service/*`) que recebem dependências injetadas (`Deps`), testáveis com Vitest sem rede; os handlers Vercel são finos. Frontend: hook `useSubscription`, paywall, tela de confirmação, portal e banner de carência.

**Tech Stack:** React 19/Vite, Vercel Serverless Functions (Node), Supabase (Postgres + Auth), Mercado Pago via `fetch` puro (sem SDK Node), Resend via `fetch`, Vitest (novo, só devDependency), SDK JS do Mercado Pago (CDN) para o Card Payment Brick.

**Spec:** `docs/superpowers/specs/2026-09-18-mercadopago-billing-design.md`

## Global Constraints

- Planos e preços (fonte única no servidor, `api/_lib/plans.ts`): **Mensal R$ 119,00** (`frequency 1`, `months`) e **Anual R$ 948,00** (`frequency 1`, `years`), moeda `BRL`. Preço, plano e frequência nunca são aceitos do navegador.
- Uma `preapproval` **sem** `preapproval_plan_id` por usuário; `status: "authorized"` na criação, com `card_token_id` do Card Payment Brick. Troca de plano e de cartão = `PUT /preapproval/{id}` na mesma assinatura.
- Troca de plano **sempre no fim do período**. Cancelamento no fim do período. Arrependimento: **7 dias** da primeira cobrança (`WITHDRAW_DAYS = 7`), reembolso total. Carência em falha de cobrança: **7 dias** (`GRACE_DAYS = 7`).
- Acesso liberado somente se `status = 'active'` **ou** (`status = 'past_due'` e `grace_until > now`), decidido **no backend**.
- Toda escrita em `subscriptions`, `billing_events`, `webhook_events` e toda escrita de assinatura em `profiles` usa o `supabaseAdmin` (service role). O usuário nunca escreve nessas tabelas. `user_id` vem sempre do JWT verificado, nunca do corpo.
- Toda chamada mutante ao Mercado Pago envia `X-Idempotency-Key`.
- Webhook: `x-signature` (`ts=<ts>,v1=<hex>`) + `x-request-id`; string canônica `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`; HMAC-SHA256 com `MP_WEBHOOK_SECRET`; `crypto.timingSafeEqual`; `ts` com mais de 5 minutos de diferença é rejeitado; header ausente ou assinatura divergente → `401`.
- Variáveis de ambiente (server-only, nunca `VITE_`): `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`. Pública via rota de config: `MP_PUBLIC_KEY`. **Nenhum valor real aparece em código, commits ou neste plano.**
- Logs nunca contêm token, e-mail completo ou corpo bruto de webhook: só ids e status.
- Toda copy de UI em português do Brasil, no tom já usado no projeto.
- O Mercado Pago **não tem sandbox**: toda chamada vai para `https://api.mercadopago.com`. Testes ponta a ponta com assinatura `authorized` agendam cobranças reais (contra saldo de teste) e nunca rodam em pipeline: são manuais, únicos, seguidos de cancelamento (Task 18).
- Limite de funções serverless do plano Hobby da Vercel (12): os endpoints de cobrança ficam num único `api/billing/[action].ts`, mais `api/webhooks/mercadopago.ts` e `api/cron/billing.ts`.
- Testes: Vitest (`npm test`), sem rede, arquivos `*.test.ts` dentro de `api/_lib/` (a pasta `_lib` não vira função da Vercel). Testes nunca importam `supabaseAdmin` nem `repo.ts` (que lança se faltar env).
- `npm run lint` (`tsc --noEmit`) e `npm test` precisam passar ao fim de cada task.

## File Structure

```
api/
  _lib/
    plans.ts                          # PLANS, GRACE_DAYS, WITHDRAW_DAYS, autoRecurringFor, isPlanId
    supabaseAdmin.ts                  # cliente service role (server-only)
    billing/
      types.ts                        # PlanId, SubStatus, Subscription, BillingRepo, BillingEventInput
      access.ts                       # hasAccess, checkWithdraw, profileMirror, addDays (puro)
      accessGate.ts                   # decideAccess(repo, userId, now) (puro)
      requireSubscription.ts          # helper das rotas de IA (usa repo real)
      webhookSignature.ts             # verifyMpSignature (puro)
      safeEqual.ts                    # comparação em tempo constante
      mercadopago.ts                  # MpClient (fetch), MpError, paymentOutcome
      mailer.ts                       # Mailer, createResendMailer, templates `emails`
      repo.ts                         # createSupabaseRepo (service role)
      deps.ts                         # buildDeps() (fiação real a partir do env)
      router.ts                       # routeBilling(deps, user, action, method, body)
      service/
        context.ts                    # Deps, User, Result, ok/fail, guard, safeSend, idemKey, canceledState, cancelPreapproval
        subscribe.ts
        manage.ts                     # changePlan, undoPlanChange, updateCard, cancelSubscription, resumeSubscription
        withdraw.ts
        status.ts                     # getStatus, getInvoices
        webhook.ts                    # processPreapprovalEvent, processAuthorizedPaymentEvent, handleWebhook
        cron.ts                       # runBillingCron
      testing/
        fixtures.ts                   # NOW, makeSub
        memoryRepo.ts                 # BillingRepo em memória
        fakes.ts                      # createFakeMp, createFakeMailer, makeDeps
  billing/[action].ts                 # handler HTTP único
  webhooks/mercadopago.ts             # handler do webhook
  cron/billing.ts                     # handler do cron
supabase/migrations/0002_billing.sql
vercel.json                           # rewrites SPA + crons
src/
  lib/billingApi.ts  lib/apiFetch.ts (modificar)
  hooks/useSubscription.ts
  data/plans.ts  utils/format.ts
  components/billing/
    CardBrickForm.tsx  SubscriptionGate.tsx  SubscriptionConfirm.tsx
    SubscriptionPortal.tsx  GraceBanner.tsx  BillingStateScreens.tsx
  App.tsx  components/Header.tsx (modificar)
```

---

### Task 1: Porta de verificação, emendas do spec e variáveis de ambiente

**Files:**
- Modify: `docs/superpowers/specs/2026-09-18-mercadopago-billing-design.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nada.
- Produces: seção "Resultados da verificação" no spec (fatos confirmados usados pelas Tasks 6, 9, 11); novas variáveis documentadas.

- [ ] **Step 1: Conectar o MCP do Mercado Pago**

Rodar `/mp-connect` e seguir o link de autorização (Cmd+Click). Sem MCP autenticado, os Steps 2–3 não podem ser concluídos.

- [ ] **Step 2: Verificar na documentação oficial (MCP `search_documentation`)**

Consultar e registrar a resposta de cada item:

1. `PUT /preapproval/{id}` aceita alterar `auto_recurring.frequency_type` **e** `transaction_amount` numa assinatura sem plano? Vale a partir de qual cobrança?
2. `GET /authorized_payments/{id}`: valores de `status`, e o campo que traz o `id`/`status` do pagamento (`payment.id`, `payment.status`).
3. `GET /authorized_payments/search?preapproval_id=` devolve `{ results: [...] }`?
4. `POST /v1/payments/{id}/refunds` (reembolso total, corpo `{}`) funciona para o pagamento gerado por assinatura?
5. `GET /preapproval/{id}` expõe `next_payment_date`?
6. O `token` do Card Payment Brick é aceito como `card_token_id` no `POST /preapproval`, e `PUT` com novo `card_token_id` troca o cartão?

**Gate A:** se o item 1 for **não**, PARE aqui. O `change-plan` (Task 9) depende dele. Volte ao brainstorming para revisar a seção "Troca de plano" do spec (plano B: cancelar e recriar no vencimento com novo token do Brick) antes de continuar. As demais tasks (2–8 e 10–17) não dependem do item 1 e podem prosseguir se o usuário decidir seguir em paralelo.

Se algum dos itens 2–6 divergir do assumido neste plano, anote a divergência: as Tasks 6 (`mercadopago.ts`) e 11 (`webhook.ts`) concentram esses campos e são os únicos pontos a ajustar.

- [ ] **Step 3: Registrar os resultados no spec**

Anexar ao final do spec uma seção `## Resultados da verificação (Task 1)` com uma tabela `Item | Resultado | Fonte (URL da doc)` para os 6 itens acima.

- [ ] **Step 4: Aplicar as emendas do spec**

Aplicar estas 4 edições em `docs/superpowers/specs/2026-09-18-mercadopago-billing-design.md`:

1. Em "Webhook", trocar a linha de idempotência:
   - De: ``- **Idempotência:** insere `(data.id, type)` em `webhook_events`; se já existir,`` + quebra + ``  responde `200` sem reprocessar.``
   - Para: ``- **Idempotência:** insere `(<data.id>:<x-request-id>, type)` em `webhook_events`; se já existir, responde `200` sem reprocessar. O `data.id` sozinho não serve como chave: o MP notifica o mesmo `authorized_payment` várias vezes ao mudar de estado, e descartar as posteriores perderia a cobrança confirmada. Os handlers também são idempotentes por estado (não gravam nem enviam e-mail se nada mudou).``
2. Na linha da tabela de endpoints de `subscribe`, trocar ``Recusa se já existe assinatura `active`/`pending`.`` por ``Recusa se já existe assinatura em qualquer estado diferente de `canceled`. Preserva `refunded_at` na reassinatura (um reembolso por conta).``
3. Em `billing_events`, trocar ``user_id uuid references public.profiles(id) on delete set null,`` por ``user_id uuid, -- sem FK: a trilha de auditoria sobrevive à exclusão da conta (o trigger de imutabilidade bloquearia o `set null`)``
4. Abaixo do título "## Endpoints", acrescentar: ``Implementação: um único `api/billing/[action].ts` despacha todas as ações (limite de 12 funções do plano Hobby da Vercel).``

- [ ] **Step 5: Atualizar `.env.example`**

```bash
sed -i.bak 's#/api/cron/process-cancellations#/api/cron/billing#' .env.example && rm .env.example.bak
printf '\n# MP_PUBLIC_KEY: chave pública do app no Mercado Pago (vai ao navegador via /api/billing/config).\nMP_PUBLIC_KEY=\n\n# Resend (e-mails transacionais). MAIL_FROM precisa ser de um domínio verificado (SPF/DKIM).\nRESEND_API_KEY=\nMAIL_FROM=\n' >> .env.example
```

Conferir com `git diff .env.example` (só nomes de variáveis, nenhum valor).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-18-mercadopago-billing-design.md .env.example
git commit -m "docs: record MP verification results, spec amendments and new env vars"
```

---

### Task 2: Ferramenta de testes (Vitest)

**Files:**
- Create: `vitest.config.ts`
- Create: `api/_lib/billing/testing/smoke.test.ts` (removido no Step 5)
- Modify: `package.json`

**Interfaces:**
- Produces: script `npm test` (`vitest run`) que executa `api/**/*.test.ts`.

- [ ] **Step 1: Instalar**

```bash
npm install --save-dev vitest@^3
```

- [ ] **Step 2: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

// Config separada de vite.config.ts para não carregar o plugin de mídia do AI Studio.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Adicionar script em `package.json`**

Em `"scripts"`, acrescentar `"test": "vitest run"` (depois de `"lint"`).

- [ ] **Step 4: Teste de fumaça, rodar e ver passar**

`api/_lib/billing/testing/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest', () => {
  it('roda', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Remover o teste de fumaça e commitar**

```bash
rm api/_lib/billing/testing/smoke.test.ts
npm run lint
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for backend unit tests"
```

---

### Task 3: Domínio puro — tipos, planos e regras de acesso

**Files:**
- Create: `api/_lib/billing/types.ts`
- Create: `api/_lib/plans.ts`
- Create: `api/_lib/billing/access.ts`
- Create: `api/_lib/billing/testing/fixtures.ts`
- Test: `api/_lib/billing/access.test.ts`

**Interfaces:**
- Produces (usados por todas as tasks seguintes):
  - `types.ts`: `PlanId`, `SubStatus`, `BillingActor`, `Subscription`, `BillingEventInput`, `BillingRepo`.
  - `plans.ts`: `PLANS`, `GRACE_DAYS`, `WITHDRAW_DAYS`, `isPlanId(v: unknown): v is PlanId`, `autoRecurringFor(plan: PlanId)`.
  - `access.ts`: `addDays(from: Date, days: number): Date`, `hasAccess(sub, now): boolean`, `checkWithdraw(sub, now): WithdrawCheck`, `profileMirror(sub): { subscription_status; plan }`.
  - `fixtures.ts`: `NOW: Date`, `makeSub(overrides?): Subscription`.

- [ ] **Step 1: Criar `api/_lib/billing/types.ts`**

```ts
export type PlanId = 'monthly' | 'annual';
export type SubStatus = 'pending' | 'active' | 'past_due' | 'canceled';
export type BillingActor = 'user' | 'webhook' | 'cron' | 'system';

export interface Subscription {
  user_id: string;
  mp_preapproval_id: string | null;
  plan: PlanId;
  status: SubStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  pending_plan: PlanId | null;
  pending_plan_effective_at: string | null;
  grace_until: string | null;
  first_charge_at: string | null;
  first_payment_id: string | null;
  refunded_at: string | null;
}

export interface BillingEventInput {
  user_id: string | null;
  actor: BillingActor;
  action: string;
  before?: unknown;
  after?: unknown;
  mp_id?: string | null;
}

// Persistência de cobrança. Implementações: repo.ts (Supabase) e testing/memoryRepo.ts.
export interface BillingRepo {
  getByUser(userId: string): Promise<Subscription | null>;
  getByPreapprovalId(preapprovalId: string): Promise<Subscription | null>;
  // Upsert da linha inteira + espelho em profiles.
  save(sub: Subscription): Promise<void>;
  recordEvent(event: BillingEventInput): Promise<void>;
  countEvents(userId: string, action: string, sinceIso: string): Promise<number>;
  // true se o evento foi registrado agora; false se já existia.
  claimWebhookEvent(eventId: string, eventType: string): Promise<boolean>;
  releaseWebhookEvent(eventId: string, eventType: string): Promise<void>;
  listCancellationsDue(nowIso: string): Promise<Subscription[]>;
  listGraceExpired(nowIso: string): Promise<Subscription[]>;
  // pending/active/past_due + canceladas atualizadas desde `recentCanceledSinceIso`.
  listReconcilable(recentCanceledSinceIso: string): Promise<Subscription[]>;
  getProfileEmail(userId: string): Promise<string | null>;
}
```

- [ ] **Step 2: Criar `api/_lib/plans.ts`**

```ts
import type { PlanId } from './billing/types';

export const GRACE_DAYS = 7;
export const WITHDRAW_DAYS = 7;

export const PLANS = {
  monthly: { amount: 119.0, frequency: 1, frequencyType: 'months', label: 'Plano Mensal' },
  annual: { amount: 948.0, frequency: 1, frequencyType: 'years', label: 'Plano Anual' },
} as const satisfies Record<
  PlanId,
  { amount: number; frequency: number; frequencyType: 'months' | 'years'; label: string }
>;

export function isPlanId(value: unknown): value is PlanId {
  return value === 'monthly' || value === 'annual';
}

export function autoRecurringFor(plan: PlanId) {
  const p = PLANS[plan];
  return {
    frequency: p.frequency,
    frequency_type: p.frequencyType,
    transaction_amount: p.amount,
    currency_id: 'BRL' as const,
  };
}
```

- [ ] **Step 3: Criar `api/_lib/billing/testing/fixtures.ts`**

```ts
import type { Subscription } from '../types';

export const NOW = new Date('2026-09-18T12:00:00.000Z');

export function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

export function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    user_id: 'user-1',
    mp_preapproval_id: 'pre_1',
    plan: 'monthly',
    status: 'active',
    current_period_end: daysFromNow(27),
    cancel_at_period_end: false,
    pending_plan: null,
    pending_plan_effective_at: null,
    grace_until: null,
    first_charge_at: daysFromNow(-3),
    first_payment_id: '999',
    refunded_at: null,
    ...overrides,
  };
}
```

- [ ] **Step 4: Escrever o teste que falha**

`api/_lib/billing/access.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hasAccess, checkWithdraw, profileMirror, addDays } from './access';
import { makeSub, NOW, daysFromNow } from './testing/fixtures';

describe('hasAccess', () => {
  it('nega sem assinatura', () => {
    expect(hasAccess(null, NOW)).toBe(false);
  });
  it('libera active', () => {
    expect(hasAccess(makeSub({ status: 'active' }), NOW)).toBe(true);
  });
  it('nega pending e canceled', () => {
    expect(hasAccess(makeSub({ status: 'pending' }), NOW)).toBe(false);
    expect(hasAccess(makeSub({ status: 'canceled' }), NOW)).toBe(false);
  });
  it('libera past_due dentro da carência', () => {
    expect(hasAccess(makeSub({ status: 'past_due', grace_until: daysFromNow(2) }), NOW)).toBe(true);
  });
  it('nega past_due com carência vencida ou ausente', () => {
    expect(hasAccess(makeSub({ status: 'past_due', grace_until: daysFromNow(-1) }), NOW)).toBe(false);
    expect(hasAccess(makeSub({ status: 'past_due', grace_until: null }), NOW)).toBe(false);
  });
});

describe('checkWithdraw', () => {
  it('permite dentro de 7 dias da primeira cobrança e informa o prazo', () => {
    const r = checkWithdraw(makeSub({ first_charge_at: daysFromNow(-3) }), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.deadline.toISOString()).toBe(daysFromNow(4));
  });
  it('nega após 7 dias', () => {
    expect(checkWithdraw(makeSub({ first_charge_at: daysFromNow(-8) }), NOW)).toEqual({
      ok: false,
      reason: 'expired',
    });
  });
  it('nega sem assinatura ativa', () => {
    expect(checkWithdraw(null, NOW)).toEqual({ ok: false, reason: 'not_active' });
    expect(checkWithdraw(makeSub({ status: 'past_due' }), NOW)).toEqual({ ok: false, reason: 'not_active' });
  });
  it('nega sem primeira cobrança registrada', () => {
    expect(checkWithdraw(makeSub({ first_charge_at: null }), NOW)).toEqual({ ok: false, reason: 'no_charge' });
    expect(checkWithdraw(makeSub({ first_payment_id: null }), NOW)).toEqual({ ok: false, reason: 'no_charge' });
  });
  it('nega se já reembolsou', () => {
    expect(checkWithdraw(makeSub({ refunded_at: daysFromNow(-1) }), NOW)).toEqual({
      ok: false,
      reason: 'already_refunded',
    });
  });
});

describe('profileMirror', () => {
  it('pending vira trial (sem assinatura) e sem plano', () => {
    expect(profileMirror(makeSub({ status: 'pending' }))).toEqual({ subscription_status: 'trial', plan: null });
  });
  it('active e past_due carregam o plano', () => {
    expect(profileMirror(makeSub({ status: 'active', plan: 'annual' }))).toEqual({
      subscription_status: 'active',
      plan: 'annual',
    });
    expect(profileMirror(makeSub({ status: 'past_due' }))).toEqual({
      subscription_status: 'past_due',
      plan: 'monthly',
    });
  });
  it('canceled zera o plano', () => {
    expect(profileMirror(makeSub({ status: 'canceled' }))).toEqual({
      subscription_status: 'canceled',
      plan: null,
    });
  });
});

describe('addDays', () => {
  it('soma dias em UTC', () => {
    expect(addDays(NOW, 7).toISOString()).toBe('2026-09-25T12:00:00.000Z');
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/access.test.ts`
Expected: FAIL (`Cannot find module './access'`).

- [ ] **Step 6: Implementar `api/_lib/billing/access.ts`**

```ts
import { WITHDRAW_DAYS } from '../plans';
import type { PlanId, Subscription } from './types';

const DAY_MS = 86_400_000;

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

// Regra única de acesso, avaliada só no backend.
export function hasAccess(
  sub: Pick<Subscription, 'status' | 'grace_until'> | null,
  now: Date
): boolean {
  if (!sub) return false;
  if (sub.status === 'active') return true;
  if (sub.status === 'past_due' && sub.grace_until) {
    return new Date(sub.grace_until).getTime() > now.getTime();
  }
  return false;
}

export type WithdrawCheck =
  | { ok: true; deadline: Date }
  | { ok: false; reason: 'not_active' | 'no_charge' | 'already_refunded' | 'expired' };

export function checkWithdraw(sub: Subscription | null, now: Date): WithdrawCheck {
  if (!sub || sub.status !== 'active') return { ok: false, reason: 'not_active' };
  if (sub.refunded_at) return { ok: false, reason: 'already_refunded' };
  if (!sub.first_charge_at || !sub.first_payment_id) return { ok: false, reason: 'no_charge' };
  const deadline = addDays(new Date(sub.first_charge_at), WITHDRAW_DAYS);
  if (now.getTime() >= deadline.getTime()) return { ok: false, reason: 'expired' };
  return { ok: true, deadline };
}

// Espelho em public.profiles (legado do Pilar 1). 'trial' significa "sem assinatura":
// nenhum trial é concedido, e o acesso nunca é decidido a partir de profiles.
export function profileMirror(sub: Pick<Subscription, 'status' | 'plan'>): {
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled';
  plan: PlanId | null;
} {
  const subscription_status = sub.status === 'pending' ? 'trial' : sub.status;
  const plan = sub.status === 'active' || sub.status === 'past_due' ? sub.plan : null;
  return { subscription_status, plan };
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx vitest run api/_lib/billing/access.test.ts && npm run lint`
Expected: PASS, sem erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add api/_lib/plans.ts api/_lib/billing/types.ts api/_lib/billing/access.ts api/_lib/billing/access.test.ts api/_lib/billing/testing/fixtures.ts
git commit -m "feat: billing domain types, plan map and access rules"
```

---

### Task 4: Validação de assinatura do webhook e comparação segura

**Files:**
- Create: `api/_lib/billing/webhookSignature.ts`
- Create: `api/_lib/billing/safeEqual.ts`
- Test: `api/_lib/billing/webhookSignature.test.ts`

**Interfaces:**
- Produces:
  - `verifyMpSignature(i: { signatureHeader?: string; requestId?: string; dataId?: string; secret: string; nowMs: number; toleranceMs?: number }): { ok: true } | { ok: false; reason: 'missing_headers' | 'malformed_signature' | 'stale_timestamp' | 'invalid_signature' }`
  - `safeEqual(a: string, b: string): boolean`

- [ ] **Step 1: Escrever o teste que falha**

`api/_lib/billing/webhookSignature.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyMpSignature } from './webhookSignature';
import { safeEqual } from './safeEqual';

const SECRET = 'segredo-de-teste';
const NOW_MS = Date.UTC(2026, 8, 18, 12, 0, 0);
const TS_S = String(Math.floor(NOW_MS / 1000));

function sign(dataId: string, requestId: string, ts: string, secret = SECRET) {
  const v1 = createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

const base = { dataId: 'abc123', requestId: 'req-1', secret: SECRET, nowMs: NOW_MS };

describe('verifyMpSignature', () => {
  it('aceita assinatura válida', () => {
    expect(verifyMpSignature({ ...base, signatureHeader: sign('abc123', 'req-1', TS_S) })).toEqual({ ok: true });
  });
  it('normaliza data.id alfanumérico para minúsculas antes de assinar', () => {
    expect(verifyMpSignature({ ...base, dataId: 'ABC123', signatureHeader: sign('abc123', 'req-1', TS_S) })).toEqual({ ok: true });
  });
  it('rejeita headers ausentes', () => {
    expect(verifyMpSignature({ ...base, signatureHeader: undefined })).toEqual({ ok: false, reason: 'missing_headers' });
    expect(verifyMpSignature({ ...base, requestId: undefined, signatureHeader: sign('abc123', 'req-1', TS_S) })).toEqual({ ok: false, reason: 'missing_headers' });
    expect(verifyMpSignature({ ...base, dataId: undefined, signatureHeader: sign('abc123', 'req-1', TS_S) })).toEqual({ ok: false, reason: 'missing_headers' });
  });
  it('rejeita assinatura malformada', () => {
    expect(verifyMpSignature({ ...base, signatureHeader: 'lixo' })).toEqual({ ok: false, reason: 'malformed_signature' });
    expect(verifyMpSignature({ ...base, signatureHeader: 'ts=abc,v1=ff' })).toEqual({ ok: false, reason: 'malformed_signature' });
  });
  it('rejeita assinatura adulterada ou com segredo errado', () => {
    expect(verifyMpSignature({ ...base, signatureHeader: sign('abc123', 'req-1', TS_S, 'outro') })).toEqual({ ok: false, reason: 'invalid_signature' });
    expect(verifyMpSignature({ ...base, dataId: 'zzz999', signatureHeader: sign('abc123', 'req-1', TS_S) })).toEqual({ ok: false, reason: 'invalid_signature' });
  });
  it('rejeita replay (timestamp com mais de 5 minutos)', () => {
    const old = String(Math.floor(NOW_MS / 1000) - 6 * 60);
    expect(verifyMpSignature({ ...base, signatureHeader: sign('abc123', 'req-1', old) })).toEqual({ ok: false, reason: 'stale_timestamp' });
  });
  it('aceita ts em milissegundos', () => {
    expect(verifyMpSignature({ ...base, signatureHeader: sign('abc123', 'req-1', String(NOW_MS)) })).toEqual({ ok: true });
  });
});

describe('safeEqual', () => {
  it('compara em tempo constante e lida com tamanhos diferentes', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/webhookSignature.test.ts`
Expected: FAIL (módulos não encontrados).

- [ ] **Step 3: Implementar `api/_lib/billing/safeEqual.ts`**

```ts
import { timingSafeEqual } from 'node:crypto';

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
```

- [ ] **Step 4: Implementar `api/_lib/billing/webhookSignature.ts`**

```ts
import { createHmac } from 'node:crypto';
import { safeEqual } from './safeEqual';

export type SignatureResult =
  | { ok: true }
  | { ok: false; reason: 'missing_headers' | 'malformed_signature' | 'stale_timestamp' | 'invalid_signature' };

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

export function verifyMpSignature(input: {
  signatureHeader?: string;
  requestId?: string;
  dataId?: string;
  secret: string;
  nowMs: number;
  toleranceMs?: number;
}): SignatureResult {
  const { signatureHeader, requestId, dataId, secret, nowMs } = input;
  if (!signatureHeader || !requestId || !dataId) return { ok: false, reason: 'missing_headers' };

  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of signatureHeader.split(',')) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=').trim();
    if (key.trim() === 'ts') ts = value;
    else if (key.trim() === 'v1') v1 = value;
  }
  if (!ts || !v1) return { ok: false, reason: 'malformed_signature' };

  const tsNumber = Number(ts);
  if (!Number.isFinite(tsNumber)) return { ok: false, reason: 'malformed_signature' };
  // O MP envia ts em segundos; aceitamos milissegundos por robustez.
  const tsMs = tsNumber < 1e12 ? tsNumber * 1000 : tsNumber;
  if (Math.abs(nowMs - tsMs) > (input.toleranceMs ?? DEFAULT_TOLERANCE_MS)) {
    return { ok: false, reason: 'stale_timestamp' };
  }

  // data.id alfanumérico é assinado em minúsculas pelo MP.
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  if (!safeEqual(expected, v1)) return { ok: false, reason: 'invalid_signature' };
  return { ok: true };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run api/_lib/billing/webhookSignature.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/billing/webhookSignature.ts api/_lib/billing/safeEqual.ts api/_lib/billing/webhookSignature.test.ts
git commit -m "feat: webhook signature verification with replay protection"
```

---

### Task 5: Migração, cliente service role e repositórios

**Files:**
- Create: `supabase/migrations/0002_billing.sql`
- Create: `api/_lib/supabaseAdmin.ts`
- Create: `api/_lib/billing/repo.ts`
- Create: `api/_lib/billing/testing/memoryRepo.ts`
- Test: `api/_lib/billing/testing/memoryRepo.test.ts`

**Interfaces:**
- Consumes: `BillingRepo`, `Subscription`, `BillingEventInput` (Task 3); `profileMirror` (Task 3).
- Produces: `supabaseAdmin`; `createSupabaseRepo(client?): BillingRepo`; `createMemoryRepo(seed?, clock?): MemoryRepo` (um `BillingRepo` com `events`, `subs`, `setEmail(userId, email)`).

- [ ] **Step 1: Escrever a migração**

`supabase/migrations/0002_billing.sql`:

```sql
-- Pilar 2: assinaturas e cobrança recorrente (Mercado Pago)

create table public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mp_preapproval_id text unique,
  plan text not null check (plan in ('monthly', 'annual')),
  status text not null check (status in ('pending', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  pending_plan text check (pending_plan in ('monthly', 'annual')),
  pending_plan_effective_at timestamptz,
  grace_until timestamptz,
  first_charge_at timestamptz,
  first_payment_id text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_status_period_idx on public.subscriptions (status, current_period_end);
create index subscriptions_status_grace_idx on public.subscriptions (status, grace_until);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- Sem policies de insert/update/delete: só o service role escreve.

create table public.billing_events (
  id bigint generated always as identity primary key,
  -- Sem FK: a trilha de auditoria sobrevive à exclusão da conta
  -- (o trigger de imutabilidade bloquearia um "on delete set null").
  user_id uuid,
  actor text not null check (actor in ('user', 'webhook', 'cron', 'system')),
  action text not null,
  before jsonb,
  after jsonb,
  mp_id text,
  created_at timestamptz not null default now()
);

create index billing_events_user_action_idx on public.billing_events (user_id, action, created_at);

alter table public.billing_events enable row level security;
-- Sem policies: só o service role acessa.

create function public.billing_events_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'billing_events is append-only';
end;
$$;

create trigger billing_events_no_update
  before update or delete on public.billing_events
  for each row execute function public.billing_events_immutable();

create table public.webhook_events (
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  primary key (event_id, event_type)
);

alter table public.webhook_events enable row level security;
-- Sem policies: só o service role acessa.

-- Fecha a brecha do Pilar 1: o usuário podia alterar o próprio subscription_status
-- via anon key. A partir daqui, escritas de assinatura em profiles só via backend.
drop policy if exists "profiles_update_own" on public.profiles;
```

- [ ] **Step 2: Aplicar a migração**

Supabase → SQL Editor → New query → colar o arquivo → Run. Conferir em Table Editor que `subscriptions`, `billing_events` e `webhook_events` existem, e rodar:

```sql
select tablename, policyname, cmd from pg_policies
where tablename in ('subscriptions', 'billing_events', 'webhook_events', 'profiles');
```

Expected: só `subscriptions_select_own` (select) e `profiles_select_own` (select). Nenhuma policy de update/insert/delete.

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

// Service role ignora RLS: uso exclusivo do backend, nunca importar em src/.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

- [ ] **Step 4: Criar `api/_lib/billing/repo.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin';
import { profileMirror } from './access';
import type { BillingEventInput, BillingRepo, Subscription } from './types';

const COLUMNS =
  'user_id, mp_preapproval_id, plan, status, current_period_end, cancel_at_period_end, ' +
  'pending_plan, pending_plan_effective_at, grace_until, first_charge_at, first_payment_id, refunded_at';

export function createSupabaseRepo(client: SupabaseClient = supabaseAdmin): BillingRepo {
  const one = async (column: string, value: string): Promise<Subscription | null> => {
    const { data, error } = await client.from('subscriptions').select(COLUMNS).eq(column, value).maybeSingle();
    if (error) throw error;
    return (data as unknown as Subscription | null) ?? null;
  };
  const many = async (rows: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const { data, error } = await rows;
    if (error) throw new Error(error.message);
    return (data as unknown as Subscription[]) ?? [];
  };

  return {
    getByUser: (userId) => one('user_id', userId),
    getByPreapprovalId: (id) => one('mp_preapproval_id', id),

    async save(sub) {
      const { error } = await client
        .from('subscriptions')
        .upsert({ ...sub, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      const { error: mirrorError } = await client
        .from('profiles')
        .update(profileMirror(sub))
        .eq('id', sub.user_id);
      if (mirrorError) throw mirrorError;
    },

    async recordEvent(event: BillingEventInput) {
      const { error } = await client.from('billing_events').insert({
        user_id: event.user_id,
        actor: event.actor,
        action: event.action,
        before: event.before ?? null,
        after: event.after ?? null,
        mp_id: event.mp_id ?? null,
      });
      if (error) throw error;
    },

    async countEvents(userId, action, sinceIso) {
      const { count, error } = await client
        .from('billing_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action', action)
        .gte('created_at', sinceIso);
      if (error) throw error;
      return count ?? 0;
    },

    async claimWebhookEvent(eventId, eventType) {
      const { error } = await client.from('webhook_events').insert({ event_id: eventId, event_type: eventType });
      if (!error) return true;
      if (error.code === '23505') return false; // unique_violation: já processado
      throw error;
    },

    async releaseWebhookEvent(eventId, eventType) {
      const { error } = await client
        .from('webhook_events')
        .delete()
        .eq('event_id', eventId)
        .eq('event_type', eventType);
      if (error) throw error;
    },

    listCancellationsDue: (nowIso) =>
      many(
        client
          .from('subscriptions')
          .select(COLUMNS)
          .eq('status', 'active')
          .eq('cancel_at_period_end', true)
          .lte('current_period_end', nowIso)
      ),

    listGraceExpired: (nowIso) =>
      many(client.from('subscriptions').select(COLUMNS).eq('status', 'past_due').lte('grace_until', nowIso)),

    listReconcilable: (sinceIso) =>
      many(
        client
          .from('subscriptions')
          .select(COLUMNS)
          .or(`status.in.(pending,active,past_due),and(status.eq.canceled,updated_at.gte.${sinceIso})`)
      ),

    async getProfileEmail(userId) {
      const { data, error } = await client.from('profiles').select('email').eq('id', userId).maybeSingle();
      if (error) throw error;
      return (data as { email: string } | null)?.email ?? null;
    },
  };
}
```

- [ ] **Step 5: Escrever o teste do repositório em memória (falha)**

`api/_lib/billing/testing/memoryRepo.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createMemoryRepo } from './memoryRepo';
import { makeSub, NOW, daysFromNow } from './fixtures';

const clock = () => new Date(NOW);

describe('memoryRepo', () => {
  it('salva e busca por usuário e por preapproval', async () => {
    const repo = createMemoryRepo([], clock);
    await repo.save(makeSub());
    expect((await repo.getByUser('user-1'))?.mp_preapproval_id).toBe('pre_1');
    expect((await repo.getByPreapprovalId('pre_1'))?.user_id).toBe('user-1');
    expect(await repo.getByUser('nobody')).toBeNull();
  });

  it('claim de webhook é atômico e liberável', async () => {
    const repo = createMemoryRepo([], clock);
    expect(await repo.claimWebhookEvent('e1', 't')).toBe(true);
    expect(await repo.claimWebhookEvent('e1', 't')).toBe(false);
    await repo.releaseWebhookEvent('e1', 't');
    expect(await repo.claimWebhookEvent('e1', 't')).toBe(true);
  });

  it('conta eventos por usuário, ação e janela', async () => {
    const repo = createMemoryRepo([], clock);
    await repo.recordEvent({ user_id: 'user-1', actor: 'user', action: 'rl:x' });
    await repo.recordEvent({ user_id: 'user-1', actor: 'user', action: 'rl:x' });
    await repo.recordEvent({ user_id: 'user-2', actor: 'user', action: 'rl:x' });
    expect(await repo.countEvents('user-1', 'rl:x', daysFromNow(-1))).toBe(2);
    expect(await repo.countEvents('user-1', 'rl:x', daysFromNow(1))).toBe(0);
  });

  it('lista cancelamentos vencidos, carências vencidas e reconciliáveis', async () => {
    const repo = createMemoryRepo(
      [
        makeSub({ user_id: 'a', mp_preapproval_id: 'pa', cancel_at_period_end: true, current_period_end: daysFromNow(-1) }),
        makeSub({ user_id: 'b', mp_preapproval_id: 'pb', status: 'past_due', grace_until: daysFromNow(-1) }),
        makeSub({ user_id: 'c', mp_preapproval_id: 'pc', status: 'canceled' }),
      ],
      clock
    );
    expect((await repo.listCancellationsDue(NOW.toISOString())).map((s) => s.user_id)).toEqual(['a']);
    expect((await repo.listGraceExpired(NOW.toISOString())).map((s) => s.user_id)).toEqual(['b']);
    const rec = (await repo.listReconcilable(daysFromNow(-3))).map((s) => s.user_id).sort();
    // 'c' está cancelada mas foi atualizada dentro da janela de 3 dias: entra na reconciliação.
    expect(rec).toEqual(['a', 'b', 'c']);
    expect((await repo.listReconcilable(daysFromNow(1))).map((s) => s.user_id).sort()).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/testing/memoryRepo.test.ts`
Expected: FAIL (`Cannot find module './memoryRepo'`).

- [ ] **Step 7: Implementar `api/_lib/billing/testing/memoryRepo.ts`**

```ts
import type { BillingEventInput, BillingRepo, Subscription } from '../types';

export interface MemoryRepo extends BillingRepo {
  events: BillingEventInput[];
  subs: Map<string, Subscription>;
  setEmail(userId: string, email: string): void;
}

// Implementação em memória de BillingRepo, só para testes. `clock` controla o "agora".
export function createMemoryRepo(seed: Subscription[] = [], clock: () => Date = () => new Date()): MemoryRepo {
  const subs = new Map<string, Subscription>();
  const updatedAt = new Map<string, number>();
  const events: BillingEventInput[] = [];
  const eventTimes: number[] = [];
  const claims = new Set<string>();
  const emails = new Map<string, string>();

  for (const s of seed) {
    subs.set(s.user_id, { ...s });
    updatedAt.set(s.user_id, clock().getTime());
  }

  const list = (predicate: (s: Subscription) => boolean) => [...subs.values()].filter(predicate).map((s) => ({ ...s }));

  return {
    events,
    subs,
    setEmail: (userId, email) => void emails.set(userId, email),

    async getByUser(userId) {
      const s = subs.get(userId);
      return s ? { ...s } : null;
    },
    async getByPreapprovalId(id) {
      const s = [...subs.values()].find((x) => x.mp_preapproval_id === id);
      return s ? { ...s } : null;
    },
    async save(sub) {
      subs.set(sub.user_id, { ...sub });
      updatedAt.set(sub.user_id, clock().getTime());
    },
    async recordEvent(event) {
      events.push(event);
      eventTimes.push(clock().getTime());
    },
    async countEvents(userId, action, sinceIso) {
      const since = new Date(sinceIso).getTime();
      return events.filter((e, i) => e.user_id === userId && e.action === action && eventTimes[i] >= since).length;
    },
    async claimWebhookEvent(eventId, eventType) {
      const key = `${eventId}|${eventType}`;
      if (claims.has(key)) return false;
      claims.add(key);
      return true;
    },
    async releaseWebhookEvent(eventId, eventType) {
      claims.delete(`${eventId}|${eventType}`);
    },
    async listCancellationsDue(nowIso) {
      const now = new Date(nowIso).getTime();
      return list(
        (s) =>
          s.status === 'active' &&
          s.cancel_at_period_end &&
          !!s.current_period_end &&
          new Date(s.current_period_end).getTime() <= now
      );
    },
    async listGraceExpired(nowIso) {
      const now = new Date(nowIso).getTime();
      return list((s) => s.status === 'past_due' && !!s.grace_until && new Date(s.grace_until).getTime() <= now);
    },
    async listReconcilable(sinceIso) {
      const since = new Date(sinceIso).getTime();
      return list(
        (s) =>
          s.status === 'pending' ||
          s.status === 'active' ||
          s.status === 'past_due' ||
          (s.status === 'canceled' && (updatedAt.get(s.user_id) ?? 0) >= since)
      );
    },
    async getProfileEmail(userId) {
      return emails.get(userId) ?? null;
    },
  };
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run api/_lib/billing/testing/memoryRepo.test.ts && npm run lint`
Expected: PASS, sem erros de tipo (inclui checar `repo.ts` contra `BillingRepo`).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0002_billing.sql api/_lib/supabaseAdmin.ts api/_lib/billing/repo.ts api/_lib/billing/testing/memoryRepo.ts api/_lib/billing/testing/memoryRepo.test.ts
git commit -m "feat: billing tables, RLS hardening and repositories"
```

---

### Task 6: Cliente HTTP do Mercado Pago

**Files:**
- Create: `api/_lib/billing/mercadopago.ts`
- Test: `api/_lib/billing/mercadopago.test.ts`

**Interfaces:**
- Consumes: nada (só `fetch`).
- Produces:
  - Tipos: `MpAutoRecurring`, `MpPreapproval`, `MpAuthorizedPayment`, `MpCreatePreapproval`, `MpUpdatePreapproval`, `MpClient`, `MpError`.
  - `createMpClient(accessToken: string, fetchImpl?: typeof fetch): MpClient`.
  - `paymentOutcome(ap: MpAuthorizedPayment): 'paid' | 'failed' | 'ignore'`.
  - `MpClient`: `createPreapproval(input, idempotencyKey)`, `getPreapproval(id)`, `updatePreapproval(id, body, idempotencyKey)`, `getAuthorizedPayment(id)`, `searchAuthorizedPayments(preapprovalId)`, `refundPayment(paymentId, idempotencyKey)`.
- **Atenção:** os campos de `MpAuthorizedPayment` e os valores de `status` foram assumidos a partir da documentação; conferir contra o resultado da Task 1 e ajustar só este arquivo se divergirem.

- [ ] **Step 1: Escrever o teste que falha**

`api/_lib/billing/mercadopago.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createMpClient, MpError, paymentOutcome } from './mercadopago';

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const recurring = { frequency: 1, frequency_type: 'months' as const, transaction_amount: 119, currency_id: 'BRL' as const };

describe('createMpClient', () => {
  it('cria preapproval com bearer, JSON e X-Idempotency-Key', async () => {
    const f = fakeFetch(201, { id: 'pre_1', status: 'authorized' });
    const mp = createMpClient('tok-secreto', f);
    const res = await mp.createPreapproval(
      { reason: 'r', external_reference: 'u1', payer_email: 'a@b.c', card_token_id: 'ct', auto_recurring: recurring, back_url: 'https://x/y', status: 'authorized' },
      'idem-1'
    );
    expect(res.id).toBe('pre_1');
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/preapproval');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-secreto');
    expect(init.headers['X-Idempotency-Key']).toBe('idem-1');
    expect(JSON.parse(init.body).card_token_id).toBe('ct');
  });

  it('GET não envia corpo nem idempotency key', async () => {
    const f = fakeFetch(200, { id: 'pre_1' });
    await createMpClient('t', f).getPreapproval('pre_1');
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/preapproval/pre_1');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers['X-Idempotency-Key']).toBeUndefined();
  });

  it('PUT atualiza a preapproval', async () => {
    const f = fakeFetch(200, { id: 'pre_1' });
    await createMpClient('t', f).updatePreapproval('pre_1', { status: 'cancelled' }, 'k');
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/preapproval/pre_1');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ status: 'cancelled' });
  });

  it('busca cobranças e devolve a lista de results', async () => {
    const f = fakeFetch(200, { results: [{ id: 1, preapproval_id: 'pre_1', status: 'processed', transaction_amount: 119 }] });
    const list = await createMpClient('t', f).searchAuthorizedPayments('pre_1');
    expect(list).toHaveLength(1);
    expect((f as any).mock.calls[0][0]).toBe('https://api.mercadopago.com/authorized_payments/search?preapproval_id=pre_1');
  });

  it('devolve lista vazia quando results não existe', async () => {
    const f = fakeFetch(200, {});
    expect(await createMpClient('t', f).searchAuthorizedPayments('pre_1')).toEqual([]);
  });

  it('reembolso total via POST /v1/payments/{id}/refunds com corpo vazio', async () => {
    const f = fakeFetch(201, { id: 5 });
    await createMpClient('t', f).refundPayment('999', 'k');
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/v1/payments/999/refunds');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({});
  });

  it('erro HTTP vira MpError sem vazar o corpo da resposta', async () => {
    const f = fakeFetch(400, { message: 'dado sensível do cartão 4111' });
    await expect(createMpClient('t', f).getPreapproval('x')).rejects.toSatisfy(
      (e: unknown) => e instanceof MpError && e.status === 400 && !e.message.includes('4111')
    );
  });
});

describe('paymentOutcome', () => {
  it('interpreta o status do pagamento, com fallback para o status da cobrança', () => {
    const base = { id: 1, preapproval_id: 'p', transaction_amount: 1 };
    expect(paymentOutcome({ ...base, status: 'processed', payment: { id: 9, status: 'approved' } })).toBe('paid');
    expect(paymentOutcome({ ...base, status: 'processed', payment: { id: 9, status: 'rejected' } })).toBe('failed');
    expect(paymentOutcome({ ...base, status: 'processed' })).toBe('paid');
    expect(paymentOutcome({ ...base, status: 'recycling' })).toBe('failed');
    expect(paymentOutcome({ ...base, status: 'scheduled' })).toBe('ignore');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/mercadopago.test.ts`
Expected: FAIL (`Cannot find module './mercadopago'`).

- [ ] **Step 3: Implementar `api/_lib/billing/mercadopago.ts`**

```ts
export interface MpAutoRecurring {
  frequency: number;
  frequency_type: 'months' | 'years';
  transaction_amount: number;
  currency_id: 'BRL';
}

export interface MpPreapproval {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled';
  external_reference: string;
  payer_email?: string;
  next_payment_date?: string | null;
  auto_recurring: MpAutoRecurring;
}

export interface MpAuthorizedPayment {
  id: number | string;
  preapproval_id: string;
  status: string;
  transaction_amount: number;
  debit_date?: string;
  payment?: { id: number | string; status: string };
}

export interface MpCreatePreapproval {
  reason: string;
  external_reference: string;
  payer_email: string;
  card_token_id: string;
  auto_recurring: MpAutoRecurring;
  back_url: string;
  status: 'authorized';
}

export type MpUpdatePreapproval = {
  auto_recurring?: MpAutoRecurring;
  card_token_id?: string;
  status?: 'cancelled';
};

export interface MpClient {
  createPreapproval(input: MpCreatePreapproval, idempotencyKey: string): Promise<MpPreapproval>;
  getPreapproval(id: string): Promise<MpPreapproval>;
  updatePreapproval(id: string, body: MpUpdatePreapproval, idempotencyKey: string): Promise<MpPreapproval>;
  getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment>;
  searchAuthorizedPayments(preapprovalId: string): Promise<MpAuthorizedPayment[]>;
  refundPayment(paymentId: string, idempotencyKey: string): Promise<{ id: number | string }>;
}

// O corpo da resposta de erro pode conter dados pessoais: não entra na mensagem.
export class MpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'MpError';
  }
}

const BASE_URL = 'https://api.mercadopago.com';

export function createMpClient(accessToken: string, fetchImpl: typeof fetch = fetch): MpClient {
  async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
    const res = await fetchImpl(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new MpError(res.status, `Mercado Pago ${method} ${path} respondeu ${res.status}`);
    return (await res.json()) as T;
  }

  return {
    createPreapproval: (input, key) => call('POST', '/preapproval', input, key),
    getPreapproval: (id) => call('GET', `/preapproval/${encodeURIComponent(id)}`),
    updatePreapproval: (id, body, key) => call('PUT', `/preapproval/${encodeURIComponent(id)}`, body, key),
    getAuthorizedPayment: (id) => call('GET', `/authorized_payments/${encodeURIComponent(id)}`),
    async searchAuthorizedPayments(preapprovalId) {
      const res = await call<{ results?: MpAuthorizedPayment[] }>(
        'GET',
        `/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`
      );
      return res.results ?? [];
    },
    refundPayment: (paymentId, key) =>
      call('POST', `/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {}, key),
  };
}

// Resultado de uma tentativa de cobrança recorrente. Usa o status do pagamento
// quando presente; senão, o status da própria cobrança.
export function paymentOutcome(ap: MpAuthorizedPayment): 'paid' | 'failed' | 'ignore' {
  const s = ap.payment?.status ?? ap.status;
  if (s === 'approved' || s === 'processed') return 'paid';
  if (s === 'rejected' || s === 'cancelled' || s === 'recycling') return 'failed';
  return 'ignore';
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/_lib/billing/mercadopago.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/billing/mercadopago.ts api/_lib/billing/mercadopago.test.ts
git commit -m "feat: Mercado Pago HTTP client with idempotency and payment outcome"
```

---

### Task 7: E-mails transacionais (Resend)

**Files:**
- Create: `api/_lib/billing/mailer.ts`
- Test: `api/_lib/billing/mailer.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `EmailMessage { subject: string; html: string }`, `Mailer { send(to: string, message: EmailMessage): Promise<void> }`.
  - `createResendMailer(apiKey: string, from: string, fetchImpl?: typeof fetch): Mailer` (lança se `apiKey`/`from` vazios no envio).
  - `emails.paymentFailed({ graceUntil: Date; updateCardUrl: string })`, `emails.subscriptionCanceled({ accessUntil: Date | null })`, `emails.planChangeScheduled({ planLabel: string; effectiveAt: Date })`, `emails.refundDone({ amount: number })`, `emails.receipt({ planLabel: string; amount: number; nextChargeAt: Date | null })`, todos retornando `EmailMessage`.

- [ ] **Step 1: Escrever o teste que falha**

`api/_lib/billing/mailer.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createResendMailer, emails } from './mailer';

describe('createResendMailer', () => {
  it('envia via API do Resend com bearer e destinatário', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    await createResendMailer('re_key', 'Forge <no-reply@x.com>', f).send('ana@example.com', { subject: 'Oi', html: '<p>x</p>' });
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_key');
    expect(JSON.parse(init.body)).toEqual({ from: 'Forge <no-reply@x.com>', to: ['ana@example.com'], subject: 'Oi', html: '<p>x</p>' });
  });
  it('lança se não configurado ou se o Resend falhar', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    await expect(createResendMailer('', '', f).send('a@b.c', { subject: 's', html: 'h' })).rejects.toThrow();
    await expect(createResendMailer('k', 'f', f).send('a@b.c', { subject: 's', html: 'h' })).rejects.toThrow();
  });
});

describe('emails', () => {
  it('paymentFailed traz a data limite e o link do cartão', () => {
    const m = emails.paymentFailed({ graceUntil: new Date('2026-09-25T12:00:00Z'), updateCardUrl: 'https://app.example.com' });
    expect(m.subject).toMatch(/cobrança/i);
    expect(m.html).toContain('25/09/2026');
    expect(m.html).toContain('https://app.example.com');
  });
  it('subscriptionCanceled com e sem data de acesso', () => {
    expect(emails.subscriptionCanceled({ accessUntil: new Date('2026-10-18T12:00:00Z') }).html).toContain('18/10/2026');
    expect(emails.subscriptionCanceled({ accessUntil: null }).html).not.toContain('undefined');
  });
  it('planChangeScheduled, refundDone e receipt formatam valores em BRL', () => {
    expect(emails.planChangeScheduled({ planLabel: 'Plano Anual', effectiveAt: new Date('2026-10-18T12:00:00Z') }).html).toContain('Plano Anual');
    expect(emails.refundDone({ amount: 119 }).html).toContain('119,00');
    const r = emails.receipt({ planLabel: 'Plano Mensal', amount: 119, nextChargeAt: new Date('2026-10-18T12:00:00Z') });
    expect(r.html).toContain('119,00');
    expect(r.html).toContain('18/10/2026');
  });
  it('escapa HTML em valores dinâmicos', () => {
    expect(emails.planChangeScheduled({ planLabel: '<script>x</script>', effectiveAt: new Date() }).html).not.toContain('<script>');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/mailer.test.ts`
Expected: FAIL (`Cannot find module './mailer'`).

- [ ] **Step 3: Implementar `api/_lib/billing/mailer.ts`**

```ts
export interface EmailMessage {
  subject: string;
  html: string;
}

export interface Mailer {
  send(to: string, message: EmailMessage): Promise<void>;
}

export function createResendMailer(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async send(to, message) {
      if (!apiKey || !from) throw new Error('Resend não configurado (RESEND_API_KEY/MAIL_FROM).');
      const res = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject: message.subject, html: message.html }),
      });
      if (!res.ok) throw new Error(`Resend respondeu ${res.status}`);
    },
  };
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, body: string): string {
  return (
    `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">` +
    `<h2>${esc(title)}</h2>${body}` +
    `<p style="color:#666;font-size:12px;margin-top:24px">Flow Prompt Forge</p></div>`
  );
}

export const emails = {
  paymentFailed(p: { graceUntil: Date; updateCardUrl: string }): EmailMessage {
    return {
      subject: 'Não conseguimos processar a cobrança da sua assinatura',
      html: layout(
        'Cobrança não aprovada',
        `<p>Não conseguimos cobrar o cartão da sua assinatura. Você continua com acesso até <strong>${dateFmt.format(p.graceUntil)}</strong>.</p>` +
          `<p>Para não perder o acesso, atualize seu cartão: <a href="${esc(p.updateCardUrl)}">${esc(p.updateCardUrl)}</a></p>`
      ),
    };
  },
  subscriptionCanceled(p: { accessUntil: Date | null }): EmailMessage {
    const access = p.accessUntil
      ? `<p>Você continua com acesso até <strong>${dateFmt.format(p.accessUntil)}</strong>.</p>`
      : `<p>O acesso foi encerrado.</p>`;
    return {
      subject: 'Sua assinatura foi cancelada',
      html: layout('Assinatura cancelada', `<p>Confirmamos o cancelamento da sua assinatura.</p>${access}`),
    };
  },
  planChangeScheduled(p: { planLabel: string; effectiveAt: Date }): EmailMessage {
    return {
      subject: 'Troca de plano agendada',
      html: layout(
        'Troca de plano agendada',
        `<p>Seu plano mudará para <strong>${esc(p.planLabel)}</strong> em <strong>${dateFmt.format(p.effectiveAt)}</strong>, na próxima renovação. Nenhuma cobrança extra agora.</p>`
      ),
    };
  },
  refundDone(p: { amount: number }): EmailMessage {
    return {
      subject: 'Reembolso concluído',
      html: layout(
        'Reembolso concluído',
        `<p>Reembolsamos <strong>${brl.format(p.amount)}</strong> e encerramos sua assinatura. O valor pode levar alguns dias para aparecer na fatura do cartão.</p>`
      ),
    };
  },
  receipt(p: { planLabel: string; amount: number; nextChargeAt: Date | null }): EmailMessage {
    const next = p.nextChargeAt ? `<p>Próxima cobrança: <strong>${dateFmt.format(p.nextChargeAt)}</strong>.</p>` : '';
    return {
      subject: 'Recibo da sua assinatura',
      html: layout(
        'Pagamento confirmado',
        `<p>Recebemos <strong>${brl.format(p.amount)}</strong> referente ao <strong>${esc(p.planLabel)}</strong>. Obrigado!</p>${next}`
      ),
    };
  },
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/_lib/billing/mailer.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/billing/mailer.ts api/_lib/billing/mailer.test.ts
git commit -m "feat: transactional email templates and Resend mailer"
```

---

### Task 8: Contexto dos serviços e `subscribe`

**Files:**
- Create: `api/_lib/billing/service/context.ts`
- Create: `api/_lib/billing/service/subscribe.ts`
- Create: `api/_lib/billing/testing/fakes.ts`
- Test: `api/_lib/billing/service/context.test.ts`
- Test: `api/_lib/billing/service/subscribe.test.ts`

**Interfaces:**
- Consumes: `MpClient`, `Mailer`, `BillingRepo`, `Subscription`, `PLANS`, `autoRecurringFor`, `isPlanId`, `makeSub`, `NOW`, `createMemoryRepo`.
- Produces:
  - `context.ts`: `Deps { mp: MpClient; repo: BillingRepo; mailer: Mailer; now: () => Date; appUrl: string; publicKey: string }`, `User { id: string; email: string }`, `Result { status: number; body: Record<string, unknown> }`, `MP_ERROR: string`, `ok(body?)`, `fail(status, error, extra?)`, `idemKey(...parts: string[]): string`, `guard(deps, userId, name, limit, windowMs): Promise<Result | null>`, `safeSend(deps, userId, message): Promise<void>`, `canceledState(sub): Subscription`, `cancelPreapproval(deps, sub, tag): Promise<unknown>`.
  - `subscribe.ts`: `subscribe(deps, user, input: { plan?: unknown; cardToken?: unknown }): Promise<Result>`.
  - `fakes.ts`: `USER`, `makePreapproval(overrides?)`, `makeAuthorizedPayment(overrides?)`, `createFakeMp(): FakeMp`, `createFakeMailer(): FakeMailer`, `makeDeps({ subs? })` retornando `{ deps, mp, repo, mailer, setNow }`.

- [ ] **Step 1: Criar `api/_lib/billing/service/context.ts`**

```ts
import { createHash } from 'node:crypto';
import type { EmailMessage, Mailer } from '../mailer';
import type { MpClient } from '../mercadopago';
import type { BillingRepo, Subscription } from '../types';

export interface Deps {
  mp: MpClient;
  repo: BillingRepo;
  mailer: Mailer;
  now: () => Date;
  appUrl: string;
  publicKey: string;
}

export interface User {
  id: string;
  email: string;
}

export interface Result {
  status: number;
  body: Record<string, unknown>;
}

export const MP_ERROR = 'Não foi possível concluir a operação com o Mercado Pago. Tente novamente em instantes.';

export const ok = (body: Record<string, unknown> = {}): Result => ({ status: 200, body: { ok: true, ...body } });

export const fail = (status: number, error: string, extra: Record<string, unknown> = {}): Result => ({
  status,
  body: { error, ...extra },
});

export function idemKey(...parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

// Rate limit por usuário e ação, contado na própria trilha de auditoria.
// Retorna um Result 429 quando estourou; senão registra a tentativa e retorna null.
export async function guard(
  deps: Deps,
  userId: string,
  name: string,
  limit: number,
  windowMs: number
): Promise<Result | null> {
  const action = `rl:${name}`;
  const since = new Date(deps.now().getTime() - windowMs).toISOString();
  const count = await deps.repo.countEvents(userId, action, since);
  if (count >= limit) return fail(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  await deps.repo.recordEvent({ user_id: userId, actor: 'user', action });
  return null;
}

// E-mail nunca desfaz a operação: falhas são registradas e engolidas.
export async function safeSend(deps: Deps, userId: string, message: EmailMessage): Promise<void> {
  try {
    const to = await deps.repo.getProfileEmail(userId);
    if (!to) return;
    await deps.mailer.send(to, message);
  } catch {
    await deps.repo.recordEvent({ user_id: userId, actor: 'system', action: 'email.failed' }).catch(() => {});
  }
}

// Estado terminal de uma assinatura cancelada (usado por cancelamento, arrependimento, cron e webhook).
export function canceledState(sub: Subscription): Subscription {
  return {
    ...sub,
    status: 'canceled',
    grace_until: null,
    cancel_at_period_end: false,
    pending_plan: null,
    pending_plan_effective_at: null,
  };
}

export function cancelPreapproval(deps: Deps, sub: Subscription, tag: string): Promise<unknown> {
  const id = sub.mp_preapproval_id as string;
  return deps.mp.updatePreapproval(id, { status: 'cancelled' }, idemKey(sub.user_id, tag, id));
}
```

- [ ] **Step 2: Criar `api/_lib/billing/testing/fakes.ts`**

```ts
import { vi, type Mock } from 'vitest';
import { autoRecurringFor } from '../../plans';
import type { EmailMessage, Mailer } from '../mailer';
import type { MpAuthorizedPayment, MpClient, MpPreapproval } from '../mercadopago';
import type { Deps } from '../service/context';
import type { Subscription } from '../types';
import { daysFromNow, NOW } from './fixtures';
import { createMemoryRepo } from './memoryRepo';

export const USER = { id: 'user-1', email: 'ana@example.com' };

export type FakeMp = { [K in keyof MpClient]: Mock<MpClient[K]> };

export function makePreapproval(overrides: Partial<MpPreapproval> = {}): MpPreapproval {
  return {
    id: 'pre_1',
    status: 'authorized',
    external_reference: 'user-1',
    payer_email: 'ana@example.com',
    next_payment_date: daysFromNow(27),
    auto_recurring: autoRecurringFor('monthly'),
    ...overrides,
  };
}

export function makeAuthorizedPayment(overrides: Partial<MpAuthorizedPayment> = {}): MpAuthorizedPayment {
  return {
    id: 'ap_1',
    preapproval_id: 'pre_1',
    status: 'processed',
    transaction_amount: 119,
    debit_date: NOW.toISOString(),
    payment: { id: 555, status: 'approved' },
    ...overrides,
  };
}

export function createFakeMp(): FakeMp {
  return {
    createPreapproval: vi.fn<MpClient['createPreapproval']>(async () => makePreapproval({ next_payment_date: null })),
    getPreapproval: vi.fn<MpClient['getPreapproval']>(async () => makePreapproval()),
    updatePreapproval: vi.fn<MpClient['updatePreapproval']>(async () => makePreapproval()),
    getAuthorizedPayment: vi.fn<MpClient['getAuthorizedPayment']>(async () => makeAuthorizedPayment()),
    searchAuthorizedPayments: vi.fn<MpClient['searchAuthorizedPayments']>(async () => []),
    refundPayment: vi.fn<MpClient['refundPayment']>(async () => ({ id: 1 })),
  };
}

export interface FakeMailer extends Mailer {
  sent: { to: string; message: EmailMessage }[];
}

export function createFakeMailer(): FakeMailer {
  const sent: FakeMailer['sent'] = [];
  return {
    sent,
    async send(to, message) {
      sent.push({ to, message });
    },
  };
}

export function makeDeps(opts: { subs?: Subscription[] } = {}) {
  const state = { now: new Date(NOW) };
  const clock = () => new Date(state.now);
  const repo = createMemoryRepo(opts.subs ?? [], clock);
  repo.setEmail('user-1', 'ana@example.com');
  const mp = createFakeMp();
  const mailer = createFakeMailer();
  const deps: Deps = {
    mp,
    repo,
    mailer,
    now: clock,
    appUrl: 'https://app.example.com',
    publicKey: 'public-key-de-teste',
  };
  return {
    deps,
    mp,
    repo,
    mailer,
    setNow: (d: Date) => {
      state.now = d;
    },
  };
}
```

- [ ] **Step 3: Escrever os testes que falham**

`api/_lib/billing/service/context.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { canceledState, guard, idemKey, safeSend } from './context';
import { makeDeps } from '../testing/fakes';
import { makeSub, NOW } from '../testing/fixtures';

describe('idemKey', () => {
  it('é determinística e sensível aos parâmetros', () => {
    expect(idemKey('a', 'b')).toBe(idemKey('a', 'b'));
    expect(idemKey('a', 'b')).not.toBe(idemKey('a', 'c'));
    expect(idemKey('a', 'b')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('guard', () => {
  it('permite até o limite, bloqueia depois e libera após a janela', async () => {
    const { deps, setNow } = makeDeps();
    for (let i = 0; i < 3; i++) expect(await guard(deps, 'user-1', 'x', 3, 60_000)).toBeNull();
    const blocked = await guard(deps, 'user-1', 'x', 3, 60_000);
    expect(blocked?.status).toBe(429);
    setNow(new Date(NOW.getTime() + 61_000));
    expect(await guard(deps, 'user-1', 'x', 3, 60_000)).toBeNull();
  });
  it('isola por usuário', async () => {
    const { deps } = makeDeps();
    await guard(deps, 'user-1', 'x', 1, 60_000);
    expect(await guard(deps, 'user-2', 'x', 1, 60_000)).toBeNull();
  });
});

describe('safeSend', () => {
  it('envia para o e-mail do perfil', async () => {
    const { deps, mailer } = makeDeps();
    await safeSend(deps, 'user-1', { subject: 's', html: 'h' });
    expect(mailer.sent).toEqual([{ to: 'ana@example.com', message: { subject: 's', html: 'h' } }]);
  });
  it('registra e engole falha de envio', async () => {
    const { deps, repo } = makeDeps();
    deps.mailer.send = async () => {
      throw new Error('resend fora do ar');
    };
    await expect(safeSend(deps, 'user-1', { subject: 's', html: 'h' })).resolves.toBeUndefined();
    expect(repo.events.map((e) => e.action)).toContain('email.failed');
  });
});

describe('canceledState', () => {
  it('limpa carência, cancelamento agendado e troca de plano', () => {
    const s = canceledState(
      makeSub({ cancel_at_period_end: true, grace_until: NOW.toISOString(), pending_plan: 'annual', pending_plan_effective_at: NOW.toISOString() })
    );
    expect(s).toMatchObject({
      status: 'canceled',
      grace_until: null,
      cancel_at_period_end: false,
      pending_plan: null,
      pending_plan_effective_at: null,
    });
  });
});
```

`api/_lib/billing/service/subscribe.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { subscribe } from './subscribe';
import { makeDeps, USER } from '../testing/fakes';
import { makeSub, daysFromNow } from '../testing/fixtures';

const TOKEN = 'card-token-12345';

describe('subscribe', () => {
  it('rejeita plano e token inválidos', async () => {
    const { deps, mp } = makeDeps();
    expect((await subscribe(deps, USER, { plan: 'gratis', cardToken: TOKEN })).status).toBe(400);
    expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: 'x' })).status).toBe(400);
    expect((await subscribe(deps, USER, { plan: 'monthly' })).status).toBe(400);
    expect(mp.createPreapproval).not.toHaveBeenCalled();
  });

  it('cria a preapproval com preço do servidor e grava pending', async () => {
    const { deps, mp, repo } = makeDeps();
    const res = await subscribe(deps, USER, { plan: 'annual', cardToken: TOKEN });
    expect(res).toEqual({ status: 200, body: { ok: true, status: 'pending' } });

    const [input, key] = mp.createPreapproval.mock.calls[0];
    expect(input).toMatchObject({
      external_reference: 'user-1',
      payer_email: 'ana@example.com',
      card_token_id: TOKEN,
      status: 'authorized',
      back_url: 'https://app.example.com/subscription/confirm',
      auto_recurring: { frequency: 1, frequency_type: 'years', transaction_amount: 948, currency_id: 'BRL' },
    });
    expect(key).toMatch(/^[0-9a-f]{64}$/);

    const saved = await repo.getByUser('user-1');
    expect(saved).toMatchObject({ plan: 'annual', status: 'pending', mp_preapproval_id: 'pre_1', refunded_at: null });
    expect(repo.events.map((e) => e.action)).toContain('subscribe');
  });

  it('ignora preço enviado pelo cliente', async () => {
    const { deps, mp } = makeDeps();
    await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN, amount: 1 } as never);
    expect(mp.createPreapproval.mock.calls[0][0].auto_recurring.transaction_amount).toBe(119);
  });

  it('recusa quando já existe assinatura não cancelada', async () => {
    for (const status of ['pending', 'active', 'past_due'] as const) {
      const { deps, mp } = makeDeps({ subs: [makeSub({ status })] });
      expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN })).status).toBe(409);
      expect(mp.createPreapproval).not.toHaveBeenCalled();
    }
  });

  it('permite reassinar após cancelamento e preserva refunded_at (um reembolso por conta)', async () => {
    const refundedAt = daysFromNow(-30);
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'canceled', refunded_at: refundedAt, first_charge_at: refundedAt })] });
    const res = await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN });
    expect(res.status).toBe(200);
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'pending', refunded_at: refundedAt, first_charge_at: null, first_payment_id: null });
  });

  it('falha do MP devolve 502 e não grava nada', async () => {
    const { deps, mp, repo } = makeDeps();
    mp.createPreapproval.mockRejectedValueOnce(new Error('mp fora do ar'));
    expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN })).status).toBe(502);
    expect(await repo.getByUser('user-1')).toBeNull();
  });

  it('limita tentativas (5 por 10 minutos); entrada inválida não consome o limite', async () => {
    const { deps } = makeDeps();
    for (let i = 0; i < 10; i++) await subscribe(deps, USER, { plan: 'gratis' as never, cardToken: TOKEN });
    // 1ª válida cria (200); as seguintes batem em 409 mas contam no limite
    expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN })).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN })).status).toBe(409);
    expect((await subscribe(deps, USER, { plan: 'monthly', cardToken: TOKEN })).status).toBe(429);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/service`
Expected: FAIL (`Cannot find module './subscribe'`; `context.test.ts` já passa depois do Step 1, então só `subscribe.test.ts` falha).

- [ ] **Step 5: Implementar `api/_lib/billing/service/subscribe.ts`**

```ts
import { autoRecurringFor, isPlanId, PLANS } from '../../plans';
import type { Subscription } from '../types';
import { fail, guard, idemKey, MP_ERROR, ok, type Deps, type Result, type User } from './context';

const TEN_MIN = 10 * 60_000;

export async function subscribe(
  deps: Deps,
  user: User,
  input: { plan?: unknown; cardToken?: unknown }
): Promise<Result> {
  const { plan, cardToken } = input;
  if (!isPlanId(plan)) return fail(400, 'Plano inválido.');
  if (typeof cardToken !== 'string' || cardToken.length < 8 || cardToken.length > 200) {
    return fail(400, 'Dados do cartão inválidos.');
  }

  const limited = await guard(deps, user.id, 'subscribe', 5, TEN_MIN);
  if (limited) return limited;

  const existing = await deps.repo.getByUser(user.id);
  if (existing && existing.status !== 'canceled') return fail(409, 'Você já possui uma assinatura.');

  let preapproval;
  try {
    preapproval = await deps.mp.createPreapproval(
      {
        reason: `Flow Prompt Forge — ${PLANS[plan].label}`,
        external_reference: user.id,
        payer_email: user.email,
        card_token_id: cardToken,
        auto_recurring: autoRecurringFor(plan),
        back_url: `${deps.appUrl}/subscription/confirm`,
        status: 'authorized',
      },
      // O token é de uso único: a mesma tentativa repetida cai na mesma chave.
      idemKey(user.id, 'subscribe', plan, cardToken)
    );
  } catch {
    return fail(502, MP_ERROR);
  }

  const next: Subscription = {
    user_id: user.id,
    mp_preapproval_id: preapproval.id,
    plan,
    status: 'pending',
    current_period_end: null,
    cancel_at_period_end: false,
    pending_plan: null,
    pending_plan_effective_at: null,
    grace_until: null,
    first_charge_at: null,
    first_payment_id: null,
    // Um reembolso por conta: quem já exerceu o arrependimento não exerce de novo.
    refunded_at: existing?.refunded_at ?? null,
  };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'subscribe',
    before: existing,
    after: next,
    mp_id: preapproval.id,
  });
  return ok({ status: 'pending' });
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run api/_lib/billing/service && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/billing/service api/_lib/billing/testing/fakes.ts
git commit -m "feat: billing service context, test fakes and subscribe"
```

---

### Task 9: Gestão da assinatura — trocar plano, trocar cartão, cancelar, retomar

**Gate:** só iniciar após o **Gate A** da Task 1 (o `PUT` aceita alterar `auto_recurring`).

**Files:**
- Create: `api/_lib/billing/service/manage.ts`
- Test: `api/_lib/billing/service/manage.test.ts`

**Interfaces:**
- Consumes: `Deps`, `User`, `Result`, `ok`, `fail`, `guard`, `idemKey`, `safeSend`, `canceledState`, `cancelPreapproval`, `MP_ERROR` (Task 8); `autoRecurringFor`, `isPlanId`, `PLANS` (Task 3); `emails` (Task 7).
- Produces: `changePlan(deps, user, { plan? })`, `undoPlanChange(deps, user)`, `updateCard(deps, user, { cardToken? })`, `cancelSubscription(deps, user)`, `resumeSubscription(deps, user)`, todos `Promise<Result>`.

- [ ] **Step 1: Escrever o teste que falha**

`api/_lib/billing/service/manage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cancelSubscription, changePlan, resumeSubscription, undoPlanChange, updateCard } from './manage';
import { makeDeps, USER } from '../testing/fakes';
import { daysFromNow, makeSub } from '../testing/fixtures';

const ANNUAL = { frequency: 1, frequency_type: 'years', transaction_amount: 948, currency_id: 'BRL' };
const MONTHLY = { frequency: 1, frequency_type: 'months', transaction_amount: 119, currency_id: 'BRL' };

describe('changePlan', () => {
  it('agenda a troca para o fim do período sem mudar plano nem acesso', async () => {
    const sub = makeSub();
    const { deps, mp, repo, mailer } = makeDeps({ subs: [sub] });
    const res = await changePlan(deps, USER, { plan: 'annual' });
    expect(res).toEqual({ status: 200, body: { ok: true, pendingPlan: 'annual', effectiveAt: sub.current_period_end } });
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { auto_recurring: ANNUAL }, expect.any(String));
    expect(await repo.getByUser('user-1')).toMatchObject({
      plan: 'monthly',
      status: 'active',
      pending_plan: 'annual',
      pending_plan_effective_at: sub.current_period_end,
    });
    expect(repo.events.map((e) => e.action)).toContain('change_plan.scheduled');
    expect(mailer.sent[0].message.subject).toBe('Troca de plano agendada');
  });

  it('valida plano e estado', async () => {
    expect((await changePlan(makeDeps({ subs: [makeSub()] }).deps, USER, { plan: 'x' })).status).toBe(400);
    expect((await changePlan(makeDeps().deps, USER, { plan: 'annual' })).status).toBe(409);
    expect((await changePlan(makeDeps({ subs: [makeSub({ status: 'past_due' })] }).deps, USER, { plan: 'annual' })).status).toBe(409);
    expect((await changePlan(makeDeps({ subs: [makeSub()] }).deps, USER, { plan: 'monthly' })).status).toBe(409);
    expect((await changePlan(makeDeps({ subs: [makeSub({ cancel_at_period_end: true })] }).deps, USER, { plan: 'annual' })).status).toBe(409);
    expect((await changePlan(makeDeps({ subs: [makeSub({ current_period_end: null })] }).deps, USER, { plan: 'annual' })).status).toBe(409);
  });

  it('falha do MP devolve 502 e não grava a troca', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub()] });
    mp.updatePreapproval.mockRejectedValueOnce(new Error('mp'));
    expect((await changePlan(deps, USER, { plan: 'annual' })).status).toBe(502);
    expect((await repo.getByUser('user-1'))?.pending_plan).toBeNull();
  });
});

describe('undoPlanChange', () => {
  it('reverte o valor no MP e limpa a troca agendada', async () => {
    const sub = makeSub({ pending_plan: 'annual', pending_plan_effective_at: daysFromNow(27) });
    const { deps, mp, repo } = makeDeps({ subs: [sub] });
    expect((await undoPlanChange(deps, USER)).status).toBe(200);
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { auto_recurring: MONTHLY }, expect.any(String));
    expect(await repo.getByUser('user-1')).toMatchObject({ pending_plan: null, pending_plan_effective_at: null });
  });
  it('409 quando não há troca agendada', async () => {
    expect((await undoPlanChange(makeDeps({ subs: [makeSub()] }).deps, USER)).status).toBe(409);
  });
});

describe('updateCard', () => {
  it('troca o cartão na mesma assinatura (active e past_due)', async () => {
    for (const status of ['active', 'past_due'] as const) {
      const { deps, mp, repo } = makeDeps({ subs: [makeSub({ status })] });
      expect((await updateCard(deps, USER, { cardToken: 'novo-token-1234' })).status).toBe(200);
      expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { card_token_id: 'novo-token-1234' }, expect.any(String));
      expect(repo.events.map((e) => e.action)).toContain('update_card');
    }
  });
  it('valida token e estado; 502 se o MP falhar', async () => {
    expect((await updateCard(makeDeps({ subs: [makeSub()] }).deps, USER, { cardToken: 'x' })).status).toBe(400);
    expect((await updateCard(makeDeps().deps, USER, { cardToken: 'novo-token-1234' })).status).toBe(409);
    expect((await updateCard(makeDeps({ subs: [makeSub({ status: 'pending' })] }).deps, USER, { cardToken: 'novo-token-1234' })).status).toBe(409);
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    mp.updatePreapproval.mockRejectedValueOnce(new Error('mp'));
    expect((await updateCard(deps, USER, { cardToken: 'novo-token-1234' })).status).toBe(502);
  });
});

describe('cancelSubscription', () => {
  it('active: agenda para o fim do período, mantém acesso, não chama o MP', async () => {
    const sub = makeSub();
    const { deps, mp, repo, mailer } = makeDeps({ subs: [sub] });
    const res = await cancelSubscription(deps, USER);
    expect(res.body).toMatchObject({ ok: true, cancelAtPeriodEnd: true, accessUntil: sub.current_period_end });
    expect(mp.updatePreapproval).not.toHaveBeenCalled();
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', cancel_at_period_end: true });
    expect(mailer.sent[0].message.subject).toBe('Sua assinatura foi cancelada');
  });
  it('active já agendada: idempotente, sem novo e-mail', async () => {
    const { deps, mailer } = makeDeps({ subs: [makeSub({ cancel_at_period_end: true })] });
    expect((await cancelSubscription(deps, USER)).status).toBe(200);
    expect(mailer.sent).toHaveLength(0);
  });
  it('past_due: cancela de verdade no MP e encerra o acesso', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(3) })] });
    expect((await cancelSubscription(deps, USER)).body).toMatchObject({ status: 'canceled' });
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { status: 'cancelled' }, expect.any(String));
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled', grace_until: null });
  });
  it('409 sem assinatura cancelável', async () => {
    expect((await cancelSubscription(makeDeps().deps, USER)).status).toBe(409);
    expect((await cancelSubscription(makeDeps({ subs: [makeSub({ status: 'canceled' })] }).deps, USER)).status).toBe(409);
  });
});

describe('resumeSubscription', () => {
  it('desfaz o cancelamento agendado', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ cancel_at_period_end: true })] });
    expect((await resumeSubscription(deps, USER)).status).toBe(200);
    expect((await repo.getByUser('user-1'))?.cancel_at_period_end).toBe(false);
  });
  it('409 sem cancelamento agendado', async () => {
    expect((await resumeSubscription(makeDeps({ subs: [makeSub()] }).deps, USER)).status).toBe(409);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/service/manage.test.ts`
Expected: FAIL (`Cannot find module './manage'`).

- [ ] **Step 3: Implementar `api/_lib/billing/service/manage.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { autoRecurringFor, isPlanId, PLANS } from '../../plans';
import { emails } from '../mailer';
import {
  canceledState,
  cancelPreapproval,
  fail,
  guard,
  idemKey,
  MP_ERROR,
  ok,
  safeSend,
  type Deps,
  type Result,
  type User,
} from './context';

const TEN_MIN = 10 * 60_000;

function isToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 200;
}

// PUTs de valor são idempotentes por natureza e o mesmo par (plano, período) pode se repetir
// legitimamente (agendar, desfazer, agendar de novo): a chave é única por chamada.
const freshKey = (...parts: string[]) => idemKey(...parts, randomUUID());

export async function changePlan(deps: Deps, user: User, input: { plan?: unknown }): Promise<Result> {
  const { plan } = input;
  if (!isPlanId(plan)) return fail(400, 'Plano inválido.');

  const limited = await guard(deps, user.id, 'change-plan', 10, TEN_MIN);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  if (!sub || sub.status !== 'active' || !sub.mp_preapproval_id) {
    return fail(409, 'Você precisa de uma assinatura ativa para trocar de plano.');
  }
  if (sub.cancel_at_period_end) return fail(409, 'Retome a assinatura antes de trocar de plano.');
  if (plan === sub.plan) return fail(409, 'Você já está neste plano.');
  if (!sub.current_period_end) {
    return fail(409, 'Aguarde a confirmação da primeira cobrança para trocar de plano.');
  }

  try {
    await deps.mp.updatePreapproval(
      sub.mp_preapproval_id,
      { auto_recurring: autoRecurringFor(plan) },
      freshKey(user.id, 'change-plan', plan)
    );
  } catch {
    return fail(502, MP_ERROR);
  }

  const next = { ...sub, pending_plan: plan, pending_plan_effective_at: sub.current_period_end };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'change_plan.scheduled',
    before: sub,
    after: next,
    mp_id: sub.mp_preapproval_id,
  });
  await safeSend(
    deps,
    user.id,
    emails.planChangeScheduled({ planLabel: PLANS[plan].label, effectiveAt: new Date(sub.current_period_end) })
  );
  return ok({ pendingPlan: plan, effectiveAt: sub.current_period_end });
}

export async function undoPlanChange(deps: Deps, user: User): Promise<Result> {
  const limited = await guard(deps, user.id, 'change-plan', 10, TEN_MIN);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  if (!sub || sub.status !== 'active' || !sub.mp_preapproval_id || !sub.pending_plan) {
    return fail(409, 'Não há troca de plano agendada.');
  }

  try {
    await deps.mp.updatePreapproval(
      sub.mp_preapproval_id,
      { auto_recurring: autoRecurringFor(sub.plan) },
      freshKey(user.id, 'undo-plan-change', sub.plan)
    );
  } catch {
    return fail(502, MP_ERROR);
  }

  const next = { ...sub, pending_plan: null, pending_plan_effective_at: null };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'change_plan.undone',
    before: sub,
    after: next,
    mp_id: sub.mp_preapproval_id,
  });
  return ok();
}

export async function updateCard(deps: Deps, user: User, input: { cardToken?: unknown }): Promise<Result> {
  const { cardToken } = input;
  if (!isToken(cardToken)) return fail(400, 'Dados do cartão inválidos.');

  const limited = await guard(deps, user.id, 'update-card', 10, TEN_MIN);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  if (!sub || !sub.mp_preapproval_id || (sub.status !== 'active' && sub.status !== 'past_due')) {
    return fail(409, 'Você precisa de uma assinatura ativa para trocar o cartão.');
  }

  try {
    await deps.mp.updatePreapproval(
      sub.mp_preapproval_id,
      { card_token_id: cardToken },
      idemKey(user.id, 'update-card', cardToken)
    );
  } catch {
    return fail(502, MP_ERROR);
  }

  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'update_card',
    mp_id: sub.mp_preapproval_id,
  });
  return ok();
}

export async function cancelSubscription(deps: Deps, user: User): Promise<Result> {
  const limited = await guard(deps, user.id, 'cancel', 10, TEN_MIN);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  if (!sub || !sub.mp_preapproval_id || (sub.status !== 'active' && sub.status !== 'past_due')) {
    return fail(409, 'Não há assinatura para cancelar.');
  }

  // Em carência não há período pago a preservar: cancela de verdade agora.
  if (sub.status === 'past_due') {
    try {
      await cancelPreapproval(deps, sub, 'cancel-now');
    } catch {
      return fail(502, MP_ERROR);
    }
    const next = canceledState(sub);
    await deps.repo.save(next);
    await deps.repo.recordEvent({
      user_id: user.id,
      actor: 'user',
      action: 'cancel.immediate',
      before: sub,
      after: next,
      mp_id: sub.mp_preapproval_id,
    });
    await safeSend(deps, user.id, emails.subscriptionCanceled({ accessUntil: null }));
    return ok({ status: 'canceled' });
  }

  if (sub.cancel_at_period_end) {
    return ok({ cancelAtPeriodEnd: true, accessUntil: sub.current_period_end });
  }

  const next = { ...sub, cancel_at_period_end: true };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'cancel.scheduled',
    before: sub,
    after: next,
    mp_id: sub.mp_preapproval_id,
  });
  await safeSend(
    deps,
    user.id,
    emails.subscriptionCanceled({ accessUntil: sub.current_period_end ? new Date(sub.current_period_end) : null })
  );
  return ok({ cancelAtPeriodEnd: true, accessUntil: sub.current_period_end });
}

export async function resumeSubscription(deps: Deps, user: User): Promise<Result> {
  const limited = await guard(deps, user.id, 'cancel', 10, TEN_MIN);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  if (!sub || sub.status !== 'active' || !sub.cancel_at_period_end) {
    return fail(409, 'Não há cancelamento agendado.');
  }

  const next = { ...sub, cancel_at_period_end: false };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'resume',
    before: sub,
    after: next,
    mp_id: sub.mp_preapproval_id,
  });
  return ok();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/_lib/billing/service/manage.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/billing/service/manage.ts api/_lib/billing/service/manage.test.ts
git commit -m "feat: change plan, update card, cancel and resume services"
```

---

### Task 10: Arrependimento (reembolso), status e faturas

**Files:**
- Create: `api/_lib/billing/service/withdraw.ts`
- Create: `api/_lib/billing/service/status.ts`
- Test: `api/_lib/billing/service/withdraw.test.ts`
- Test: `api/_lib/billing/service/status.test.ts`

**Interfaces:**
- Consumes: `Deps`, `User`, `Result`, `ok`, `fail`, `guard`, `idemKey`, `safeSend`, `canceledState`, `cancelPreapproval`, `MP_ERROR` (Task 8); `checkWithdraw`, `hasAccess` (Task 3); `paymentOutcome` (Task 6); `emails` (Task 7); `PLANS` (Task 3).
- Produces: `withdraw(deps, user): Promise<Result>`; `getStatus(deps, user): Promise<Result>`; `getInvoices(deps, user): Promise<Result>`.
  - `getStatus` body: `{ ok, status: 'none'|SubStatus, plan?, currentPeriodEnd?, cancelAtPeriodEnd?, pendingPlan?, pendingPlanEffectiveAt?, graceUntil?, hasAccess: boolean, canWithdraw: boolean, withdrawDeadline?: string | null }`.
  - `getInvoices` body: `{ ok, invoices: { id: string; date: string | null; amount: number; status: 'paid' | 'failed' | 'scheduled' }[] }`.

- [ ] **Step 1: Escrever os testes que falham**

`api/_lib/billing/service/withdraw.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { withdraw } from './withdraw';
import { makeDeps, USER } from '../testing/fakes';
import { daysFromNow, makeSub, NOW } from '../testing/fixtures';

describe('withdraw', () => {
  it('dentro de 7 dias: reembolsa a primeira cobrança, cancela a preapproval e revoga o acesso', async () => {
    const { deps, mp, repo, mailer } = makeDeps({ subs: [makeSub({ first_charge_at: daysFromNow(-3), first_payment_id: '999' })] });
    const res = await withdraw(deps, USER);
    expect(res).toEqual({ status: 200, body: { ok: true, status: 'canceled' } });
    expect(mp.refundPayment).toHaveBeenCalledWith('999', expect.any(String));
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { status: 'cancelled' }, expect.any(String));
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled', refunded_at: NOW.toISOString() });
    expect(repo.events.map((e) => e.action)).toContain('withdraw');
    expect(mailer.sent[0].message.subject).toBe('Reembolso concluído');
  });

  it('fora da janela: 409 e nenhuma chamada ao MP', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub({ first_charge_at: daysFromNow(-8) })] });
    const res = await withdraw(deps, USER);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ reason: 'expired' });
    expect(mp.refundPayment).not.toHaveBeenCalled();
  });

  it('sem assinatura ativa ou sem cobrança confirmada: 409', async () => {
    expect((await withdraw(makeDeps().deps, USER)).body).toMatchObject({ reason: 'not_active' });
    expect((await withdraw(makeDeps({ subs: [makeSub({ first_payment_id: null })] }).deps, USER)).body).toMatchObject({ reason: 'no_charge' });
  });

  it('falha no reembolso: 502 e o estado não muda (nunca cancela sem reembolsar)', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub()] });
    mp.refundPayment.mockRejectedValueOnce(new Error('mp'));
    expect((await withdraw(deps, USER)).status).toBe(502);
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', refunded_at: null });
    expect(mp.updatePreapproval).not.toHaveBeenCalled();
  });

  it('reembolso feito mas cancelamento no MP falha: grava cancelado e registra para a reconciliação', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub()] });
    mp.updatePreapproval.mockRejectedValueOnce(new Error('mp'));
    expect((await withdraw(deps, USER)).status).toBe(200);
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled' });
    expect(repo.events.map((e) => e.action)).toContain('withdraw.cancel_failed');
  });

  it('segunda tentativa após reembolso: 409', async () => {
    const { deps } = makeDeps({ subs: [makeSub()] });
    await withdraw(deps, USER);
    expect((await withdraw(deps, USER)).status).toBe(409);
  });

  it('rate limit estrito: 3 tentativas por hora', async () => {
    const { deps } = makeDeps({ subs: [makeSub({ first_charge_at: daysFromNow(-8) })] });
    for (let i = 0; i < 3; i++) expect((await withdraw(deps, USER)).status).toBe(409);
    expect((await withdraw(deps, USER)).status).toBe(429);
  });
});
```

`api/_lib/billing/service/status.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getInvoices, getStatus } from './status';
import { makeAuthorizedPayment, makeDeps, USER } from '../testing/fakes';
import { daysFromNow, makeSub } from '../testing/fixtures';

describe('getStatus', () => {
  it('sem assinatura', async () => {
    const res = await getStatus(makeDeps().deps, USER);
    expect(res.body).toEqual({ ok: true, status: 'none', hasAccess: false, canWithdraw: false });
  });
  it('active dentro da janela de arrependimento', async () => {
    const sub = makeSub({ first_charge_at: daysFromNow(-3) });
    const res = await getStatus(makeDeps({ subs: [sub] }).deps, USER);
    expect(res.body).toMatchObject({
      status: 'active',
      plan: 'monthly',
      hasAccess: true,
      canWithdraw: true,
      withdrawDeadline: daysFromNow(4),
      cancelAtPeriodEnd: false,
      pendingPlan: null,
    });
  });
  it('past_due com carência mantém acesso; sem carência não', async () => {
    const withGrace = await getStatus(makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(2) })] }).deps, USER);
    expect(withGrace.body).toMatchObject({ status: 'past_due', hasAccess: true, graceUntil: daysFromNow(2), canWithdraw: false });
    const expired = await getStatus(makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(-1) })] }).deps, USER);
    expect(expired.body).toMatchObject({ hasAccess: false });
  });
});

describe('getInvoices', () => {
  it('lista vazia sem assinatura', async () => {
    expect((await getInvoices(makeDeps().deps, USER)).body).toEqual({ ok: true, invoices: [] });
  });
  it('mapeia cobranças do MP para paid/failed/scheduled', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    mp.searchAuthorizedPayments.mockResolvedValueOnce([
      makeAuthorizedPayment({ id: 1, status: 'processed', transaction_amount: 119, debit_date: '2026-09-15T12:00:00.000Z' }),
      makeAuthorizedPayment({ id: 2, status: 'recycling', payment: { id: 8, status: 'rejected' } }),
      makeAuthorizedPayment({ id: 3, status: 'scheduled', payment: undefined }),
    ]);
    const res = await getInvoices(deps, USER);
    expect(mp.searchAuthorizedPayments).toHaveBeenCalledWith('pre_1');
    expect(res.body.invoices).toEqual([
      { id: '1', date: '2026-09-15T12:00:00.000Z', amount: 119, status: 'paid' },
      { id: '2', date: expect.any(String), amount: 119, status: 'failed' },
      { id: '3', date: expect.any(String), amount: 119, status: 'scheduled' },
    ]);
  });
  it('502 se o MP falhar', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    mp.searchAuthorizedPayments.mockRejectedValueOnce(new Error('mp'));
    expect((await getInvoices(deps, USER)).status).toBe(502);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/service/withdraw.test.ts api/_lib/billing/service/status.test.ts`
Expected: FAIL (módulos não encontrados).

- [ ] **Step 3: Implementar `api/_lib/billing/service/withdraw.ts`**

```ts
import { PLANS } from '../../plans';
import { checkWithdraw } from '../access';
import { emails } from '../mailer';
import type { Subscription } from '../types';
import {
  canceledState,
  cancelPreapproval,
  fail,
  guard,
  idemKey,
  MP_ERROR,
  ok,
  safeSend,
  type Deps,
  type Result,
  type User,
} from './context';

const HOUR = 3_600_000;

const MESSAGES = {
  not_active: 'Você não tem uma assinatura ativa para exercer o arrependimento.',
  no_charge: 'Ainda não há uma cobrança confirmada para reembolsar.',
  already_refunded: 'O reembolso desta assinatura já foi realizado.',
  expired: 'O prazo de 7 dias para arrependimento já passou.',
} as const;

export async function withdraw(deps: Deps, user: User): Promise<Result> {
  const limited = await guard(deps, user.id, 'withdraw', 3, HOUR);
  if (limited) return limited;

  const sub = await deps.repo.getByUser(user.id);
  const check = checkWithdraw(sub, deps.now());
  if (!check.ok) return fail(409, MESSAGES[check.reason], { reason: check.reason });

  const current = sub as Subscription;
  const paymentId = current.first_payment_id as string;

  // Reembolsa primeiro: se falhar, nada muda (nunca cancelamos sem reembolsar).
  try {
    await deps.mp.refundPayment(paymentId, idemKey(user.id, 'withdraw', paymentId));
  } catch {
    return fail(502, MP_ERROR);
  }

  const next: Subscription = { ...canceledState(current), refunded_at: deps.now().toISOString() };
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: user.id,
    actor: 'user',
    action: 'withdraw',
    before: current,
    after: next,
    mp_id: paymentId,
  });

  // Se o cancelamento no MP falhar, o dinheiro já voltou e o acesso já foi revogado:
  // o cron de reconciliação cancela a preapproval remanescente.
  try {
    await cancelPreapproval(deps, current, 'withdraw-cancel');
  } catch {
    await deps.repo.recordEvent({
      user_id: user.id,
      actor: 'system',
      action: 'withdraw.cancel_failed',
      mp_id: current.mp_preapproval_id,
    });
  }

  await safeSend(deps, user.id, emails.refundDone({ amount: PLANS[current.plan].amount }));
  return ok({ status: 'canceled' });
}
```

- [ ] **Step 4: Implementar `api/_lib/billing/service/status.ts`**

```ts
import { checkWithdraw, hasAccess } from '../access';
import { paymentOutcome } from '../mercadopago';
import { fail, MP_ERROR, ok, type Deps, type Result, type User } from './context';

export async function getStatus(deps: Deps, user: User): Promise<Result> {
  const sub = await deps.repo.getByUser(user.id);
  if (!sub) return ok({ status: 'none', hasAccess: false, canWithdraw: false });

  const now = deps.now();
  const withdrawal = checkWithdraw(sub, now);
  return ok({
    status: sub.status,
    plan: sub.plan,
    currentPeriodEnd: sub.current_period_end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    pendingPlan: sub.pending_plan,
    pendingPlanEffectiveAt: sub.pending_plan_effective_at,
    graceUntil: sub.grace_until,
    hasAccess: hasAccess(sub, now),
    canWithdraw: withdrawal.ok,
    withdrawDeadline: withdrawal.ok ? withdrawal.deadline.toISOString() : null,
  });
}

export async function getInvoices(deps: Deps, user: User): Promise<Result> {
  const sub = await deps.repo.getByUser(user.id);
  if (!sub?.mp_preapproval_id) return ok({ invoices: [] });

  try {
    const payments = await deps.mp.searchAuthorizedPayments(sub.mp_preapproval_id);
    const invoices = payments.map((ap) => {
      const outcome = paymentOutcome(ap);
      return {
        id: String(ap.id),
        date: ap.debit_date ?? null,
        amount: ap.transaction_amount,
        status: outcome === 'paid' ? 'paid' : outcome === 'failed' ? 'failed' : 'scheduled',
      };
    });
    return ok({ invoices });
  } catch {
    return fail(502, MP_ERROR);
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run api/_lib/billing/service && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/billing/service/withdraw.ts api/_lib/billing/service/status.ts api/_lib/billing/service/withdraw.test.ts api/_lib/billing/service/status.test.ts
git commit -m "feat: withdrawal with refund, status and invoices services"
```

---

### Task 11: Processamento de webhooks

**Files:**
- Create: `api/_lib/billing/service/webhook.ts`
- Test: `api/_lib/billing/service/webhook.test.ts`

**Interfaces:**
- Consumes: `Deps`, `canceledState`, `safeSend` (Task 8); `PLANS`, `GRACE_DAYS` (Task 3); `addDays` (Task 3); `paymentOutcome` (Task 6); `emails` (Task 7).
- Produces:
  - `processPreapprovalEvent(deps, preapprovalId: string): Promise<void>`
  - `processAuthorizedPaymentEvent(deps, authorizedPaymentId: string): Promise<void>`
  - `handleWebhook(deps, evt: { type: string; dataId: string; requestId: string }): Promise<number>` (HTTP status: `200` ou `500`).
- Regras: handlers são idempotentes por estado (nada gravado nem e-mail enviado se o estado não mudou); reconciliação de valor antes de liberar acesso; `getPreapproval` que falha propaga o erro (o MP reenvia).

- [ ] **Step 1: Escrever o teste que falha**

`api/_lib/billing/service/webhook.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { handleWebhook, processAuthorizedPaymentEvent, processPreapprovalEvent } from './webhook';
import { makeAuthorizedPayment, makeDeps, makePreapproval } from '../testing/fakes';
import { daysFromNow, makeSub, NOW } from '../testing/fixtures';

describe('processPreapprovalEvent', () => {
  it('authorized: pending vira active e grava o fim do período nativo', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'pending', current_period_end: null })] });
    await processPreapprovalEvent(deps, 'pre_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', current_period_end: daysFromNow(27) });
    expect(repo.events.map((e) => e.action)).toContain('webhook.preapproval');
  });

  it('sem mudança de estado: não grava nem registra evento', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub()] });
    await processPreapprovalEvent(deps, 'pre_1');
    expect(repo.events).toHaveLength(0);
  });

  it('assinatura desconhecida ou de outro preapproval: registra órfão e segue', async () => {
    const a = makeDeps();
    await processPreapprovalEvent(a.deps, 'pre_1');
    expect(a.repo.events.map((e) => e.action)).toContain('webhook.orphan_preapproval');
    const b = makeDeps({ subs: [makeSub({ mp_preapproval_id: 'outro' })] });
    await processPreapprovalEvent(b.deps, 'pre_1');
    expect(b.repo.events.map((e) => e.action)).toContain('webhook.orphan_preapproval');
    expect((await b.repo.getByUser('user-1'))?.mp_preapproval_id).toBe('outro');
  });

  it('paused: active vira past_due com carência de 7 dias; pending não ganha acesso', async () => {
    const a = makeDeps({ subs: [makeSub()] });
    a.mp.getPreapproval.mockResolvedValueOnce(makePreapproval({ status: 'paused' }));
    await processPreapprovalEvent(a.deps, 'pre_1');
    expect(await a.repo.getByUser('user-1')).toMatchObject({ status: 'past_due', grace_until: daysFromNow(7) });

    const b = makeDeps({ subs: [makeSub({ status: 'pending' })] });
    b.mp.getPreapproval.mockResolvedValueOnce(makePreapproval({ status: 'paused' }));
    await processPreapprovalEvent(b.deps, 'pre_1');
    expect((await b.repo.getByUser('user-1'))?.status).toBe('pending');
  });

  it('authorized não reativa past_due (só um pagamento aprovado reativa)', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(3) })] });
    await processPreapprovalEvent(deps, 'pre_1');
    expect((await repo.getByUser('user-1'))?.status).toBe('past_due');
  });

  it('cancelled: cancela, limpa estados e envia e-mail uma única vez', async () => {
    const { deps, mp, repo, mailer } = makeDeps({ subs: [makeSub({ cancel_at_period_end: true })] });
    mp.getPreapproval.mockResolvedValue(makePreapproval({ status: 'cancelled' }));
    await processPreapprovalEvent(deps, 'pre_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled', cancel_at_period_end: false });
    await processPreapprovalEvent(deps, 'pre_1');
    expect(mailer.sent).toHaveLength(1);
  });

  it('localmente cancelada mas ainda authorized no MP: ignora e registra (o cron corrige)', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'canceled' })] });
    await processPreapprovalEvent(deps, 'pre_1');
    expect((await repo.getByUser('user-1'))?.status).toBe('canceled');
    expect(repo.events.map((e) => e.action)).toContain('webhook.ignored_after_cancel');
  });
});

describe('processAuthorizedPaymentEvent', () => {
  it('primeira cobrança aprovada: ativa, registra primeira cobrança e envia recibo', async () => {
    const { deps, repo, mailer } = makeDeps({ subs: [makeSub({ status: 'pending', current_period_end: null, first_charge_at: null, first_payment_id: null })] });
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(await repo.getByUser('user-1')).toMatchObject({
      status: 'active',
      first_charge_at: NOW.toISOString(),
      first_payment_id: '555',
      current_period_end: daysFromNow(27),
      grace_until: null,
    });
    expect(mailer.sent[0].message.subject).toBe('Recibo da sua assinatura');
  });

  it('cobrança aprovada em past_due limpa a carência e reativa', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(3) })] });
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', grace_until: null });
  });

  it('valor divergente do plano: não libera acesso e registra a divergência', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ status: 'pending', current_period_end: null })] });
    mp.getAuthorizedPayment.mockResolvedValueOnce(makeAuthorizedPayment({ transaction_amount: 1 }));
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect((await repo.getByUser('user-1'))?.status).toBe('pending');
    expect(repo.events.map((e) => e.action)).toContain('reconcile.amount_mismatch');
  });

  it('cobrança no valor do plano agendado promove pending_plan', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ pending_plan: 'annual', pending_plan_effective_at: daysFromNow(0) })] });
    mp.getAuthorizedPayment.mockResolvedValueOnce(makeAuthorizedPayment({ transaction_amount: 948 }));
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ plan: 'annual', pending_plan: null, pending_plan_effective_at: null });
  });

  it('cobrança recusada: past_due com carência de 7 dias e um único e-mail', async () => {
    const { deps, mp, repo, mailer } = makeDeps({ subs: [makeSub()] });
    mp.getAuthorizedPayment.mockResolvedValue(makeAuthorizedPayment({ status: 'recycling', payment: { id: 9, status: 'rejected' } }));
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'past_due', grace_until: daysFromNow(7) });
    expect(mailer.sent[0].message.subject).toBe('Não conseguimos processar a cobrança da sua assinatura');
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(mailer.sent).toHaveLength(1);
  });

  it('cobrança ainda agendada: ignora', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub()] });
    mp.getAuthorizedPayment.mockResolvedValueOnce(makeAuthorizedPayment({ status: 'scheduled', payment: undefined }));
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(repo.events).toHaveLength(0);
  });

  it('cobrança aprovada para assinatura cancelada: não reativa', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'canceled' })] });
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect((await repo.getByUser('user-1'))?.status).toBe('canceled');
    expect(repo.events.map((e) => e.action)).toContain('webhook.paid_after_cancel');
  });

  it('reassinatura após reembolso recebe acesso e mantém refunded_at', async () => {
    const refundedAt = daysFromNow(-30);
    const { deps, repo } = makeDeps({
      subs: [makeSub({ status: 'pending', current_period_end: null, first_charge_at: null, first_payment_id: null, refunded_at: refundedAt })],
    });
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', refunded_at: refundedAt, first_payment_id: '555' });
  });

  it('cobrança de preapproval desconhecida: registra órfão', async () => {
    const { deps, repo } = makeDeps();
    await processAuthorizedPaymentEvent(deps, 'ap_1');
    expect(repo.events.map((e) => e.action)).toContain('webhook.orphan_authorized_payment');
  });

  it('propaga erro do MP ao confirmar o período (o webhook será reenviado)', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub({ status: 'pending', current_period_end: null })] });
    mp.getPreapproval.mockRejectedValueOnce(new Error('mp'));
    await expect(processAuthorizedPaymentEvent(deps, 'ap_1')).rejects.toThrow();
  });
});

describe('handleWebhook', () => {
  const evt = { type: 'subscription_preapproval', dataId: 'pre_1', requestId: 'req-1' };

  it('ignora tópicos não suportados e id vazio', async () => {
    const { deps, mp } = makeDeps();
    expect(await handleWebhook(deps, { ...evt, type: 'payment' })).toBe(200);
    expect(await handleWebhook(deps, { ...evt, dataId: '' })).toBe(200);
    expect(mp.getPreapproval).not.toHaveBeenCalled();
  });

  it('a mesma entrega (mesmo request-id) não é reprocessada; outro request-id é', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    expect(await handleWebhook(deps, evt)).toBe(200);
    expect(await handleWebhook(deps, evt)).toBe(200);
    expect(mp.getPreapproval).toHaveBeenCalledTimes(1);
    expect(await handleWebhook(deps, { ...evt, requestId: 'req-2' })).toBe(200);
    expect(mp.getPreapproval).toHaveBeenCalledTimes(2);
  });

  it('roteia authorized_payment', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    await handleWebhook(deps, { type: 'subscription_authorized_payment', dataId: 'ap_1', requestId: 'r' });
    expect(mp.getAuthorizedPayment).toHaveBeenCalledWith('ap_1');
  });

  it('falha no processamento devolve 500 e libera a chave para o reenvio', async () => {
    const { deps, mp } = makeDeps({ subs: [makeSub()] });
    mp.getPreapproval.mockRejectedValueOnce(new Error('mp'));
    expect(await handleWebhook(deps, evt)).toBe(500);
    expect(await handleWebhook(deps, evt)).toBe(200);
    expect(mp.getPreapproval).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/service/webhook.test.ts`
Expected: FAIL (`Cannot find module './webhook'`).

- [ ] **Step 3: Implementar `api/_lib/billing/service/webhook.ts`**

```ts
import { GRACE_DAYS, PLANS } from '../../plans';
import { addDays } from '../access';
import { emails } from '../mailer';
import { paymentOutcome } from '../mercadopago';
import type { Subscription } from '../types';
import { canceledState, safeSend, type Deps } from './context';

const AMOUNT_EPSILON = 0.005;
const SUPPORTED = new Set(['subscription_preapproval', 'subscription_authorized_payment']);

const same = (a: Subscription, b: Subscription) => JSON.stringify(a) === JSON.stringify(b);
const amountEquals = (a: number, b: number) => Math.abs(a - b) <= AMOUNT_EPSILON;

export async function processPreapprovalEvent(deps: Deps, preapprovalId: string): Promise<void> {
  const pre = await deps.mp.getPreapproval(preapprovalId);
  const sub = await deps.repo.getByUser(pre.external_reference);

  if (!sub || sub.mp_preapproval_id !== pre.id) {
    await deps.repo.recordEvent({ user_id: null, actor: 'webhook', action: 'webhook.orphan_preapproval', mp_id: pre.id });
    return;
  }
  if (sub.status === 'canceled' && pre.status !== 'cancelled') {
    // Cancelada aqui (ex.: arrependimento) mas ainda ativa no MP: o cron de reconciliação cancela lá.
    await deps.repo.recordEvent({ user_id: sub.user_id, actor: 'webhook', action: 'webhook.ignored_after_cancel', mp_id: pre.id });
    return;
  }

  const now = deps.now();
  let next: Subscription = { ...sub, current_period_end: pre.next_payment_date ?? sub.current_period_end };

  if (pre.status === 'authorized') {
    // Só pending -> active. Sair de past_due exige um pagamento aprovado.
    if (sub.status === 'pending') next = { ...next, status: 'active' };
  } else if (pre.status === 'paused' && (sub.status === 'active' || sub.status === 'past_due')) {
    next = { ...next, status: 'past_due', grace_until: sub.grace_until ?? addDays(now, GRACE_DAYS).toISOString() };
  } else if (pre.status === 'cancelled') {
    next = { ...canceledState(sub), current_period_end: next.current_period_end };
  }

  if (same(sub, next)) return;

  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: sub.user_id,
    actor: 'webhook',
    action: 'webhook.preapproval',
    before: sub,
    after: next,
    mp_id: pre.id,
  });
  if (next.status === 'canceled' && sub.status !== 'canceled') {
    await safeSend(deps, sub.user_id, emails.subscriptionCanceled({ accessUntil: null }));
  }
}

export async function processAuthorizedPaymentEvent(deps: Deps, authorizedPaymentId: string): Promise<void> {
  const ap = await deps.mp.getAuthorizedPayment(authorizedPaymentId);
  const sub = await deps.repo.getByPreapprovalId(String(ap.preapproval_id));

  if (!sub) {
    await deps.repo.recordEvent({
      user_id: null,
      actor: 'webhook',
      action: 'webhook.orphan_authorized_payment',
      mp_id: String(ap.id),
    });
    return;
  }

  const outcome = paymentOutcome(ap);
  if (outcome === 'ignore') return;
  const now = deps.now();

  if (outcome === 'failed') {
    if (sub.status === 'canceled' || sub.status === 'pending') return;
    const next: Subscription = {
      ...sub,
      status: 'past_due',
      grace_until: sub.grace_until ?? addDays(now, GRACE_DAYS).toISOString(),
    };
    if (same(sub, next)) return;
    await deps.repo.save(next);
    await deps.repo.recordEvent({
      user_id: sub.user_id,
      actor: 'webhook',
      action: 'webhook.payment_failed',
      before: sub,
      after: next,
      mp_id: String(ap.id),
    });
    if (sub.status !== 'past_due') {
      await safeSend(
        deps,
        sub.user_id,
        emails.paymentFailed({ graceUntil: new Date(next.grace_until as string), updateCardUrl: deps.appUrl })
      );
    }
    return;
  }

  // outcome === 'paid'
  if (sub.status === 'canceled') {
    await deps.repo.recordEvent({
      user_id: sub.user_id,
      actor: 'webhook',
      action: 'webhook.paid_after_cancel',
      mp_id: String(ap.id),
    });
    return;
  }

  // Reconciliação de valor: o cobrado precisa bater com o plano (ou com a troca agendada).
  let plan = sub.plan;
  let promoted = false;
  if (!amountEquals(ap.transaction_amount, PLANS[sub.plan].amount)) {
    if (sub.pending_plan && amountEquals(ap.transaction_amount, PLANS[sub.pending_plan].amount)) {
      plan = sub.pending_plan;
      promoted = true;
    } else {
      await deps.repo.recordEvent({
        user_id: sub.user_id,
        actor: 'webhook',
        action: 'reconcile.amount_mismatch',
        after: { expected: PLANS[sub.plan].amount, received: ap.transaction_amount },
        mp_id: String(ap.id),
      });
      return;
    }
  }

  // Sem catch: se falhar, o erro propaga e o MP reenvia o webhook.
  const pre = await deps.mp.getPreapproval(sub.mp_preapproval_id as string);
  const periodEnd = pre.next_payment_date ?? sub.current_period_end;

  const next: Subscription = {
    ...sub,
    plan,
    status: 'active',
    grace_until: null,
    current_period_end: periodEnd,
    pending_plan: promoted ? null : sub.pending_plan,
    pending_plan_effective_at: promoted ? null : sub.pending_plan_effective_at,
    first_charge_at: sub.first_charge_at ?? now.toISOString(),
    first_payment_id: sub.first_payment_id ?? (ap.payment ? String(ap.payment.id) : null),
  };
  if (same(sub, next)) return;

  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: sub.user_id,
    actor: 'webhook',
    action: 'webhook.payment_paid',
    before: sub,
    after: next,
    mp_id: String(ap.id),
  });
  await safeSend(
    deps,
    sub.user_id,
    emails.receipt({
      planLabel: PLANS[plan].label,
      amount: ap.transaction_amount,
      nextChargeAt: periodEnd ? new Date(periodEnd) : null,
    })
  );
}

// Retorna o status HTTP para o handler. A chave inclui o x-request-id: o MP notifica o mesmo
// data.id várias vezes ao longo do ciclo de vida da cobrança e não podemos descartar as posteriores.
export async function handleWebhook(
  deps: Deps,
  evt: { type: string; dataId: string; requestId: string }
): Promise<number> {
  if (!SUPPORTED.has(evt.type) || !evt.dataId) return 200;

  const eventId = `${evt.dataId}:${evt.requestId}`;
  let claimed: boolean;
  try {
    claimed = await deps.repo.claimWebhookEvent(eventId, evt.type);
  } catch {
    return 500;
  }
  if (!claimed) return 200;

  try {
    if (evt.type === 'subscription_preapproval') await processPreapprovalEvent(deps, evt.dataId);
    else await processAuthorizedPaymentEvent(deps, evt.dataId);
    return 200;
  } catch {
    await deps.repo.releaseWebhookEvent(eventId, evt.type).catch(() => {});
    return 500;
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/_lib/billing/service && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/billing/service/webhook.ts api/_lib/billing/service/webhook.test.ts
git commit -m "feat: webhook processing with amount reconciliation and grace period"
```

---

### Task 12: Cron diário — cancelamentos, carência e reconciliação

**Files:**
- Create: `api/_lib/billing/service/cron.ts`
- Test: `api/_lib/billing/service/cron.test.ts`

**Interfaces:**
- Consumes: `Deps`, `canceledState`, `cancelPreapproval`, `safeSend` (Task 8); `addDays` (Task 3); `emails` (Task 7); repo `listCancellationsDue`, `listGraceExpired`, `listReconcilable` (Task 5).
- Produces: `runBillingCron(deps): Promise<CronSummary>` com `CronSummary { canceledAtPeriodEnd: number; graceExpired: number; reconciled: number; errors: number }`. Falha em um usuário é registrada (`cron.error`) e não interrompe o lote.

- [ ] **Step 1: Escrever o teste que falha**

`api/_lib/billing/service/cron.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runBillingCron } from './cron';
import { makeDeps, makePreapproval } from '../testing/fakes';
import { daysFromNow, makeSub } from '../testing/fixtures';

const cancelled = makePreapproval({ status: 'cancelled' });

describe('runBillingCron', () => {
  it('cancela no MP as assinaturas com cancelamento agendado e período vencido', async () => {
    const { deps, mp, repo, mailer } = makeDeps({ subs: [makeSub({ cancel_at_period_end: true, current_period_end: daysFromNow(-1) })] });
    mp.getPreapproval.mockResolvedValue(cancelled);
    const summary = await runBillingCron(deps);
    expect(summary).toEqual({ canceledAtPeriodEnd: 1, graceExpired: 0, reconciled: 0, errors: 0 });
    expect(mp.updatePreapproval).toHaveBeenCalledTimes(1);
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { status: 'cancelled' }, expect.any(String));
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled', cancel_at_period_end: false });
    expect(repo.events.map((e) => e.action)).toContain('cron.cancel_at_period_end');
    expect(mailer.sent).toHaveLength(1);
  });

  it('encerra carências vencidas', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ status: 'past_due', grace_until: daysFromNow(-1) })] });
    mp.getPreapproval.mockResolvedValue(cancelled);
    const summary = await runBillingCron(deps);
    expect(summary.graceExpired).toBe(1);
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'canceled', grace_until: null });
  });

  it('não mexe em assinaturas ativas que não venceram', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ cancel_at_period_end: true, current_period_end: daysFromNow(5) })] });
    const summary = await runBillingCron(deps);
    expect(summary).toEqual({ canceledAtPeriodEnd: 0, graceExpired: 0, reconciled: 0, errors: 0 });
    expect(mp.updatePreapproval).not.toHaveBeenCalled();
    expect((await repo.getByUser('user-1'))?.status).toBe('active');
  });

  it('reconcilia: cancelada localmente mas ativa no MP é cancelada no MP', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub({ status: 'canceled' })] });
    const summary = await runBillingCron(deps);
    expect(summary.reconciled).toBe(1);
    expect(mp.updatePreapproval).toHaveBeenCalledWith('pre_1', { status: 'cancelled' }, expect.any(String));
    expect(repo.events.map((e) => e.action)).toContain('reconcile.cancel_in_mp');
  });

  it('reconcilia: ativa localmente mas cancelada no MP vira cancelada', async () => {
    const { deps, mp, repo } = makeDeps({ subs: [makeSub()] });
    mp.getPreapproval.mockResolvedValue(cancelled);
    expect((await runBillingCron(deps)).reconciled).toBe(1);
    expect((await repo.getByUser('user-1'))?.status).toBe('canceled');
    expect(repo.events.map((e) => e.action)).toContain('reconcile.local_canceled');
  });

  it('reconcilia: pending autorizada no MP (webhook perdido) vira active', async () => {
    const { deps, repo } = makeDeps({ subs: [makeSub({ status: 'pending', current_period_end: null })] });
    expect((await runBillingCron(deps)).reconciled).toBe(1);
    expect(await repo.getByUser('user-1')).toMatchObject({ status: 'active', current_period_end: daysFromNow(27) });
  });

  it('erro em um usuário não interrompe o lote e é contabilizado', async () => {
    const due = { cancel_at_period_end: true, current_period_end: daysFromNow(-1) };
    const { deps, mp, repo } = makeDeps({
      subs: [
        makeSub({ user_id: 'user-1', mp_preapproval_id: 'pre_1', ...due }),
        makeSub({ user_id: 'user-2', mp_preapproval_id: 'pre_2', ...due }),
      ],
    });
    // getPreapproval fica no padrão (authorized): a reconciliação não altera user-1 (ativa) nem user-2 já cancelada localmente.
    mp.updatePreapproval.mockRejectedValueOnce(new Error('mp fora do ar'));
    const summary = await runBillingCron(deps);
    expect(summary).toMatchObject({ canceledAtPeriodEnd: 1, errors: 1 });
    expect((await repo.getByUser('user-1'))?.status).toBe('active'); // tenta de novo amanhã
    expect((await repo.getByUser('user-2'))?.status).toBe('canceled');
    expect(repo.events.map((e) => e.action)).toContain('cron.error');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/service/cron.test.ts`
Expected: FAIL (`Cannot find module './cron'`).

- [ ] **Step 3: Implementar `api/_lib/billing/service/cron.ts`**

```ts
import { addDays } from '../access';
import { emails } from '../mailer';
import type { Subscription } from '../types';
import { canceledState, cancelPreapproval, safeSend, type Deps } from './context';

export interface CronSummary {
  canceledAtPeriodEnd: number;
  graceExpired: number;
  reconciled: number;
  errors: number;
}

// Canceladas recentemente continuam na reconciliação para corrigir um cancelamento
// que falhou no MP (ex.: arrependimento com reembolso já concluído).
const RECENT_CANCEL_DAYS = 3;

async function cancelEverywhere(deps: Deps, sub: Subscription, tag: string, action: string): Promise<void> {
  await cancelPreapproval(deps, sub, tag);
  const next = canceledState(sub);
  await deps.repo.save(next);
  await deps.repo.recordEvent({
    user_id: sub.user_id,
    actor: 'cron',
    action,
    before: sub,
    after: next,
    mp_id: sub.mp_preapproval_id,
  });
  await safeSend(deps, sub.user_id, emails.subscriptionCanceled({ accessUntil: null }));
}

// Retorna true se corrigiu alguma divergência entre o banco e o MP.
async function reconcile(deps: Deps, sub: Subscription): Promise<boolean> {
  if (!sub.mp_preapproval_id) return false;
  const pre = await deps.mp.getPreapproval(sub.mp_preapproval_id);

  if (sub.status === 'canceled') {
    if (pre.status === 'cancelled') return false;
    await cancelPreapproval(deps, sub, 'reconcile-cancel');
    await deps.repo.recordEvent({
      user_id: sub.user_id,
      actor: 'cron',
      action: 'reconcile.cancel_in_mp',
      mp_id: sub.mp_preapproval_id,
    });
    return true;
  }

  if (pre.status === 'cancelled') {
    const next = canceledState(sub);
    await deps.repo.save(next);
    await deps.repo.recordEvent({
      user_id: sub.user_id,
      actor: 'cron',
      action: 'reconcile.local_canceled',
      before: sub,
      after: next,
      mp_id: sub.mp_preapproval_id,
    });
    await safeSend(deps, sub.user_id, emails.subscriptionCanceled({ accessUntil: null }));
    return true;
  }

  if (sub.status === 'pending' && pre.status === 'authorized') {
    const next: Subscription = { ...sub, status: 'active', current_period_end: pre.next_payment_date ?? sub.current_period_end };
    await deps.repo.save(next);
    await deps.repo.recordEvent({
      user_id: sub.user_id,
      actor: 'cron',
      action: 'reconcile.activated',
      before: sub,
      after: next,
      mp_id: sub.mp_preapproval_id,
    });
    return true;
  }

  return false;
}

export async function runBillingCron(deps: Deps): Promise<CronSummary> {
  const now = deps.now();
  const summary: CronSummary = { canceledAtPeriodEnd: 0, graceExpired: 0, reconciled: 0, errors: 0 };

  // Falha em um usuário é registrada e não interrompe o lote; tenta de novo no dia seguinte.
  const each = async (subs: Subscription[], work: (sub: Subscription) => Promise<void>) => {
    for (const sub of subs) {
      try {
        await work(sub);
      } catch {
        summary.errors++;
        await deps.repo
          .recordEvent({ user_id: sub.user_id, actor: 'cron', action: 'cron.error', mp_id: sub.mp_preapproval_id })
          .catch(() => {});
      }
    }
  };

  await each(await deps.repo.listCancellationsDue(now.toISOString()), async (sub) => {
    await cancelEverywhere(deps, sub, 'cron-cancel', 'cron.cancel_at_period_end');
    summary.canceledAtPeriodEnd++;
  });

  await each(await deps.repo.listGraceExpired(now.toISOString()), async (sub) => {
    await cancelEverywhere(deps, sub, 'cron-grace', 'cron.grace_expired');
    summary.graceExpired++;
  });

  await each(await deps.repo.listReconcilable(addDays(now, -RECENT_CANCEL_DAYS).toISOString()), async (sub) => {
    if (await reconcile(deps, sub)) summary.reconciled++;
  });

  return summary;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run api/_lib/billing/service/cron.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/billing/service/cron.ts api/_lib/billing/service/cron.test.ts
git commit -m "feat: daily billing cron with cancellations, grace expiry and reconciliation"
```

---

### Task 13: Camada HTTP — roteador, handlers, vercel.json e bloqueio das rotas de IA

**Files:**
- Create: `api/_lib/billing/accessGate.ts`
- Create: `api/_lib/billing/router.ts`
- Create: `api/_lib/billing/deps.ts`
- Create: `api/_lib/billing/requireSubscription.ts`
- Create: `api/billing/[action].ts`
- Create: `api/webhooks/mercadopago.ts`
- Create: `api/cron/billing.ts`
- Create: `vercel.json`
- Modify: `api/enhance.ts`, `api/autofill.ts`, `api/analyze-references.ts`, `api/parse-product-url.ts`
- Modify: `README.md`
- Test: `api/_lib/billing/accessGate.test.ts`, `api/_lib/billing/router.test.ts`

**Interfaces:**
- Consumes: todos os serviços (Tasks 8–12), `authenticate`/`AuthenticatedUser` (`api/_lib/auth.ts`), `verifyMpSignature` (Task 4), `safeEqual` (Task 4), `createSupabaseRepo` (Task 5), `createMpClient` (Task 6), `createResendMailer` (Task 7).
- Produces:
  - `decideAccess(repo, userId, now): Promise<'ok' | 'denied' | 'error'>` (falha fechada).
  - `routeBilling(deps, user, action: string, method: string, body: Record<string, unknown>): Promise<Result>`.
  - `buildDeps(): Deps`.
  - `requireActiveSubscription(user: AuthenticatedUser, res: VercelResponse): Promise<boolean>` — responde `403 { code: 'subscription_required' }` (sem acesso) ou `503` (falha ao verificar) e retorna `false`.
  - Rotas HTTP: `GET status|invoices|config`, `POST subscribe|change-plan|update-card|cancel|resume|withdraw`, `DELETE change-plan` sob `/api/billing/*`; `POST /api/webhooks/mercadopago`; `GET|POST /api/cron/billing`.

- [ ] **Step 1: Escrever os testes que falham**

`api/_lib/billing/accessGate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { decideAccess } from './accessGate';
import { createMemoryRepo } from './testing/memoryRepo';
import { daysFromNow, makeSub, NOW } from './testing/fixtures';

describe('decideAccess', () => {
  it('ok para active e past_due em carência', async () => {
    const repo = createMemoryRepo([makeSub({ user_id: 'a' }), makeSub({ user_id: 'b', status: 'past_due', grace_until: daysFromNow(2) })]);
    expect(await decideAccess(repo, 'a', NOW)).toBe('ok');
    expect(await decideAccess(repo, 'b', NOW)).toBe('ok');
  });
  it('denied sem assinatura, pending, canceled ou carência vencida', async () => {
    const repo = createMemoryRepo([
      makeSub({ user_id: 'p', status: 'pending' }),
      makeSub({ user_id: 'c', status: 'canceled' }),
      makeSub({ user_id: 'g', status: 'past_due', grace_until: daysFromNow(-1) }),
    ]);
    for (const id of ['nobody', 'p', 'c', 'g']) expect(await decideAccess(repo, id, NOW)).toBe('denied');
  });
  it('falha fechada: erro no banco vira "error", nunca "ok"', async () => {
    const repo = createMemoryRepo();
    repo.getByUser = async () => {
      throw new Error('db fora do ar');
    };
    expect(await decideAccess(repo, 'a', NOW)).toBe('error');
  });
});
```

`api/_lib/billing/router.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { routeBilling } from './router';
import { makeDeps, USER } from './testing/fakes';
import { makeSub } from './testing/fixtures';

describe('routeBilling', () => {
  it('404 para ação desconhecida (inclusive chaves de protótipo)', async () => {
    const { deps } = makeDeps();
    expect((await routeBilling(deps, USER, 'nada', 'GET', {})).status).toBe(404);
    expect((await routeBilling(deps, USER, '__proto__', 'GET', {})).status).toBe(404);
    expect((await routeBilling(deps, USER, 'constructor', 'GET', {})).status).toBe(404);
  });
  it('405 para método não suportado', async () => {
    const { deps } = makeDeps();
    expect((await routeBilling(deps, USER, 'status', 'POST', {})).status).toBe(405);
    expect((await routeBilling(deps, USER, 'subscribe', 'GET', {})).status).toBe(405);
  });
  it('config devolve só a chave pública', async () => {
    const { deps } = makeDeps();
    expect((await routeBilling(deps, USER, 'config', 'GET', {})).body).toEqual({ ok: true, publicKey: 'public-key-de-teste' });
  });
  it('subscribe repassa só plan e cardToken (preço do cliente é ignorado)', async () => {
    const { deps, mp } = makeDeps();
    const res = await routeBilling(deps, USER, 'subscribe', 'POST', { plan: 'monthly', cardToken: 'token-de-cartao-1', amount: 1, user_id: 'outro' });
    expect(res.status).toBe(200);
    const [input] = mp.createPreapproval.mock.calls[0];
    expect(input.auto_recurring.transaction_amount).toBe(119);
    expect(input.external_reference).toBe('user-1');
  });
  it('DELETE change-plan desfaz a troca agendada; status funciona', async () => {
    const { deps } = makeDeps({ subs: [makeSub({ pending_plan: 'annual' })] });
    expect((await routeBilling(deps, USER, 'change-plan', 'DELETE', {})).status).toBe(200);
    expect((await routeBilling(deps, USER, 'status', 'GET', {})).body).toMatchObject({ status: 'active', pendingPlan: null });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run api/_lib/billing/accessGate.test.ts api/_lib/billing/router.test.ts`
Expected: FAIL (módulos não encontrados).

- [ ] **Step 3: Implementar `api/_lib/billing/accessGate.ts`**

```ts
import { hasAccess } from './access';
import type { BillingRepo } from './types';

// Falha fechada: qualquer erro ao consultar o banco nunca libera acesso.
export async function decideAccess(repo: BillingRepo, userId: string, now: Date): Promise<'ok' | 'denied' | 'error'> {
  try {
    return hasAccess(await repo.getByUser(userId), now) ? 'ok' : 'denied';
  } catch {
    return 'error';
  }
}
```

- [ ] **Step 4: Implementar `api/_lib/billing/router.ts`**

```ts
import { cancelSubscription, changePlan, resumeSubscription, undoPlanChange, updateCard } from './service/manage';
import { fail, ok, type Deps, type Result, type User } from './service/context';
import { getInvoices, getStatus } from './service/status';
import { subscribe } from './service/subscribe';
import { withdraw } from './service/withdraw';

type Body = Record<string, unknown>;
type Handler = (deps: Deps, user: User, body: Body) => Promise<Result>;

// Só campos conhecidos do corpo chegam aos serviços; o resto é descartado.
const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  status: { GET: (d, u) => getStatus(d, u) },
  invoices: { GET: (d, u) => getInvoices(d, u) },
  config: { GET: async (d) => ok({ publicKey: d.publicKey }) },
  subscribe: { POST: (d, u, b) => subscribe(d, u, { plan: b.plan, cardToken: b.cardToken }) },
  'change-plan': {
    POST: (d, u, b) => changePlan(d, u, { plan: b.plan }),
    DELETE: (d, u) => undoPlanChange(d, u),
  },
  'update-card': { POST: (d, u, b) => updateCard(d, u, { cardToken: b.cardToken }) },
  cancel: { POST: (d, u) => cancelSubscription(d, u) },
  resume: { POST: (d, u) => resumeSubscription(d, u) },
  withdraw: { POST: (d, u) => withdraw(d, u) },
};

export async function routeBilling(
  deps: Deps,
  user: User,
  action: string,
  method: string,
  body: Body
): Promise<Result> {
  const route = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : undefined;
  if (!route) return fail(404, 'Rota não encontrada.');
  const handler = route[method];
  if (!handler) return fail(405, 'Método não permitido.');
  return handler(deps, user, body);
}
```

- [ ] **Step 5: Implementar `api/_lib/billing/deps.ts`**

```ts
import { createResendMailer } from './mailer';
import { createMpClient } from './mercadopago';
import { createSupabaseRepo } from './repo';
import type { Deps } from './service/context';

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
```

- [ ] **Step 6: Implementar `api/_lib/billing/requireSubscription.ts`**

```ts
import type { VercelResponse } from '@vercel/node';
import type { AuthenticatedUser } from '../auth';
import { decideAccess } from './accessGate';
import { createSupabaseRepo } from './repo';

// Chamar logo após `authenticate`: `if (!(await requireActiveSubscription(user, res))) return;`
export async function requireActiveSubscription(
  user: AuthenticatedUser,
  res: VercelResponse
): Promise<boolean> {
  const decision = await decideAccess(createSupabaseRepo(), user.id, new Date());
  if (decision === 'ok') return true;
  if (decision === 'denied') {
    res.status(403).json({ error: 'Assinatura necessária para usar este recurso.', code: 'subscription_required' });
  } else {
    res.status(503).json({ error: 'Não foi possível verificar sua assinatura. Tente novamente.' });
  }
  return false;
}
```

- [ ] **Step 7: Implementar `api/billing/[action].ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from '../_lib/auth';
import { buildDeps } from '../_lib/billing/deps';
import { routeBilling } from '../_lib/billing/router';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
```

- [ ] **Step 8: Implementar `api/webhooks/mercadopago.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildDeps } from '../_lib/billing/deps';
import { handleWebhook } from '../_lib/billing/service/webhook';
import { verifyMpSignature } from '../_lib/billing/webhookSignature';

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
```

- [ ] **Step 9: Implementar `api/cron/billing.ts`**

```ts
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
```

- [ ] **Step 10: Criar `vercel.json`**

```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
  "crons": [{ "path": "/api/cron/billing", "schedule": "0 9 * * *" }]
}
```

`rewrites` faz o SPA responder em `/subscription/confirm` (sem isso, a Vercel devolve 404 ao voltar do Mercado Pago). O cron roda diariamente às 09:00 UTC (06:00 em Brasília).

- [ ] **Step 11: Bloquear as 4 rotas de IA**

Em cada um de `api/enhance.ts`, `api/autofill.ts`, `api/analyze-references.ts` e `api/parse-product-url.ts`:

1. Logo abaixo de `import { authenticate } from './_lib/auth';` acrescentar:

```ts
import { requireActiveSubscription } from './_lib/billing/requireSubscription';
```

2. Logo abaixo de `  if (!user) return;` acrescentar:

```ts
  if (!(await requireActiveSubscription(user, res))) return;
```

Conferir: `grep -n "requireActiveSubscription" api/*.ts` deve listar 8 linhas (4 imports + 4 chamadas), e `api/health.ts` continua sem autenticação.

- [ ] **Step 12: Documentar no README**

```bash
cat >> README.md <<'EOF'

## Cobrança (Mercado Pago)

Assinaturas mensal e anual via API de Assinaturas (`preapproval`), com Card Payment Brick no frontend.
Variáveis de ambiente (server-only, nunca `VITE_`): `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `CRON_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`; pública via `/api/billing/config`: `MP_PUBLIC_KEY`.
Webhook: `POST /api/webhooks/mercadopago` (tópicos `subscription_preapproval` e `subscription_authorized_payment`).
Cron diário: `/api/cron/billing` (protegido por `CRON_SECRET`). O Mercado Pago não tem sandbox: testes ponta a ponta
são manuais e seguidos de cancelamento. Testes unitários: `npm test`.
EOF
```

- [ ] **Step 13: Rodar tudo**

Run: `npm test && npm run lint && npm run build`
Expected: todos os testes passam; sem erros de tipo; build do Vite concluído.

- [ ] **Step 14: Commit**

```bash
git add api vercel.json README.md
git commit -m "feat: billing HTTP layer, webhook, cron and subscription gate on AI routes"
```

---

### Task 14: Frontend — camada de dados (`billingApi`, `useSubscription`)

**Files:**
- Create: `src/lib/billingApi.ts`
- Create: `src/hooks/useSubscription.ts`
- Create: `src/data/plans.ts`
- Create: `src/utils/format.ts`
- Modify: `src/lib/apiFetch.ts`

**Interfaces:**
- Consumes: `apiFetch` (existente), rotas `/api/billing/*` (Task 13).
- Produces:
  - `billingApi.ts`: tipos `PlanId`, `BillingStatus`, `Invoice`; classe `BillingApiError(status, message)`; `billingApi.{ status, config, invoices, subscribe(plan, cardToken), changePlan(plan), undoPlanChange(), updateCard(cardToken), cancel(), resume(), withdraw() }`.
  - `useSubscription(enabled: boolean): { data: BillingStatus | null; isLoading: boolean; error: string | null; refresh: () => Promise<void> }`.
  - `apiFetch.ts`: `SUBSCRIPTION_REQUIRED_EVENT` (evento do `window` disparado quando uma rota de IA responde `403 subscription_required`).
  - `PLAN_INFO: Record<PlanId, { label; price; priceLabel; period; note }>`; `formatDate(iso?: string | null): string`; `formatBRL(value: number): string`.

- [ ] **Step 1: Criar `src/lib/billingApi.ts`**

```ts
import { apiFetch } from './apiFetch';

export type PlanId = 'monthly' | 'annual';

export interface BillingStatus {
  status: 'none' | 'pending' | 'active' | 'past_due' | 'canceled';
  plan?: PlanId;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  pendingPlan?: PlanId | null;
  pendingPlanEffectiveAt?: string | null;
  graceUntil?: string | null;
  hasAccess: boolean;
  canWithdraw: boolean;
  withdrawDeadline?: string | null;
}

export interface Invoice {
  id: string;
  date: string | null;
  amount: number;
  status: 'paid' | 'failed' | 'scheduled';
}

export class BillingApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'BillingApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`/api/billing/${path}`, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new BillingApiError(res.status, json.error ?? 'Algo deu errado. Tente novamente.');
  return json as T;
}

const post = (path: string, body?: unknown) =>
  request<{ ok: true }>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const billingApi = {
  status: () => request<BillingStatus>('status'),
  config: () => request<{ publicKey: string }>('config'),
  invoices: () => request<{ invoices: Invoice[] }>('invoices'),
  subscribe: (plan: PlanId, cardToken: string) => post('subscribe', { plan, cardToken }),
  changePlan: (plan: PlanId) => post('change-plan', { plan }),
  undoPlanChange: () => request<{ ok: true }>('change-plan', { method: 'DELETE' }),
  updateCard: (cardToken: string) => post('update-card', { cardToken }),
  cancel: () => post('cancel'),
  resume: () => post('resume'),
  withdraw: () => post('withdraw'),
};
```

- [ ] **Step 2: Modificar `src/lib/apiFetch.ts`**

Substituir o arquivo por:

```ts
import { supabase } from './supabaseClient';

// Disparado quando uma rota protegida responde 403 com code "subscription_required":
// o app reconsulta o estado da assinatura e mostra o paywall.
export const SUBSCRIPTION_REQUIRED_EVENT = 'billing:subscription-required';

// Wrapper de `fetch` que anexa o Bearer token da sessão Supabase atual (se houver)
// e assume Content-Type JSON quando um body é enviado sem headers explícitos.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, { ...init, headers });

  if (res.status === 403) {
    res
      .clone()
      .json()
      .then((body) => {
        if (body?.code === 'subscription_required') {
          window.dispatchEvent(new Event(SUBSCRIPTION_REQUIRED_EVENT));
        }
      })
      .catch(() => {});
  }

  return res;
}
```

- [ ] **Step 3: Criar `src/hooks/useSubscription.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { SUBSCRIPTION_REQUIRED_EVENT } from '../lib/apiFetch';
import { billingApi, type BillingStatus } from '../lib/billingApi';

// Estado da assinatura vindo do backend. `enabled` = usuário autenticado.
// O frontend só exibe este estado: o bloqueio real é feito no servidor.
export function useSubscription(enabled: boolean) {
  const [data, setData] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await billingApi.status());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar sua assinatura.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    const onRequired = () => void refresh();
    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, onRequired);
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
```

- [ ] **Step 4: Criar `src/data/plans.ts` e `src/utils/format.ts`**

`src/data/plans.ts`:

```ts
import type { PlanId } from '../lib/billingApi';

// Só exibição. O preço cobrado é definido no servidor (api/_lib/plans.ts).
export const PLAN_INFO: Record<
  PlanId,
  { label: string; price: number; priceLabel: string; period: string; note: string }
> = {
  monthly: {
    label: 'Mensal',
    price: 119,
    priceLabel: 'R$ 119,00',
    period: 'por mês',
    note: 'Renova todo mês no cartão. Cancele quando quiser.',
  },
  annual: {
    label: 'Anual',
    price: 948,
    priceLabel: 'R$ 948,00',
    period: 'por ano',
    note: 'Uma cobrança única por ano (equivale a R$ 79,00 por mês).',
  },
};
```

`src/utils/format.ts`:

```ts
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return dateFmt.format(new Date(iso));
}

export function formatBRL(value: number): string {
  return brlFmt.format(value);
}
```

- [ ] **Step 5: Verificar**

Run: `npm run lint && npm run build`
Expected: sem erros de tipo; build concluído.

- [ ] **Step 6: Commit**

```bash
git add src/lib/billingApi.ts src/lib/apiFetch.ts src/hooks/useSubscription.ts src/data/plans.ts src/utils/format.ts
git commit -m "feat: frontend billing API client and useSubscription hook"
```

---

### Task 15: Frontend — Card Payment Brick, paywall e confirmação

**Files:**
- Create: `src/components/billing/CardBrickForm.tsx`
- Create: `src/components/billing/BillingStateScreens.tsx`
- Create: `src/components/billing/SubscriptionGate.tsx`
- Create: `src/components/billing/SubscriptionConfirm.tsx`

**Interfaces:**
- Consumes: `billingApi`, `BillingApiError`, `PlanId`, `BillingStatus` (Task 14); `PLAN_INFO`, `formatDate`.
- Produces:
  - `CardBrickForm({ amount: number; publicKey: string; onToken: (token: string) => Promise<void> })`: monta o Card Payment Brick; chama `onToken` com o token de uso único; se `onToken` rejeitar, o Brick mostra o erro.
  - `BillingLoading()`, `BillingLoadError({ message: string | null; onRetry: () => void; onLogout: () => void })`.
  - `SubscriptionGate({ onSubscribed: () => void; onLogout: () => void; wasCanceled: boolean })`.
  - `SubscriptionConfirm({ hasAccess: boolean; refresh: () => Promise<void>; onDone: () => void })` (`onDone` deve ser estável, `useCallback`).
- **Atenção:** as opções do Brick (`customization`, `paymentMethods`) e o formato do `cardFormData` devem ser conferidos contra a documentação (Task 1, item 6). Só este arquivo muda se divergirem.

- [ ] **Step 1: Criar `src/components/billing/CardBrickForm.tsx`**

```tsx
import { useEffect, useId, useRef, useState } from 'react';

interface BrickController {
  unmount: () => void;
}

interface MercadoPagoConstructor {
  new (
    publicKey: string,
    options?: { locale: string }
  ): {
    bricks: () => {
      create: (name: 'cardPayment', containerId: string, settings: unknown) => Promise<BrickController>;
    };
  };
}

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
let sdkPromise: Promise<void> | null = null;

// O SDK é carregado do CDN oficial do Mercado Pago: os dados do cartão ficam num iframe
// dele e nunca passam pelo nosso servidor. Só o token de uso único chega ao backend.
function loadSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        sdkPromise = null;
        reject(new Error('Não foi possível carregar o formulário de pagamento.'));
      };
      document.head.appendChild(script);
    });
  }
  return sdkPromise;
}

interface CardBrickFormProps {
  amount: number;
  publicKey: string;
  onToken: (token: string) => Promise<void>;
}

export function CardBrickForm({ amount, publicKey, onToken }: CardBrickFormProps) {
  const containerId = `card-brick-${useId().replace(/:/g, '')}`;
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let controller: BrickController | null = null;

    loadSdk()
      .then(async () => {
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' });
        const created = await mp.bricks().create('cardPayment', containerId, {
          initialization: { amount },
          customization: {
            visual: { style: { theme: 'dark' } },
            paymentMethods: { maxInstallments: 1 },
          },
          callbacks: {
            onReady: () => {},
            onSubmit: async (cardFormData: { token: string }) => {
              await onTokenRef.current(cardFormData.token);
            },
            onError: () => setLoadError('Não foi possível processar os dados do cartão. Confira e tente novamente.'),
          },
        });
        if (cancelled) created.unmount();
        else controller = created;
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });

    return () => {
      cancelled = true;
      controller?.unmount();
    };
  }, [publicKey, amount, containerId]);

  return (
    <div>
      {loadError && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {loadError}
        </p>
      )}
      <div id={containerId} />
    </div>
  );
}
```

- [ ] **Step 2: Criar `src/components/billing/BillingStateScreens.tsx`**

```tsx
export function BillingLoading() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-sm text-neutral-400">
      Carregando sua assinatura...
    </div>
  );
}

interface BillingLoadErrorProps {
  message: string | null;
  onRetry: () => void;
  onLogout: () => void;
}

export function BillingLoadError({ message, onRetry, onLogout }: BillingLoadErrorProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4 px-4">
      <p role="alert" className="text-sm text-red-400 text-center max-w-md">
        {message ?? 'Não foi possível carregar sua assinatura.'}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-lg bg-amber-500 text-neutral-950 text-sm font-semibold hover:bg-amber-400 cursor-pointer"
        >
          Tentar novamente
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 cursor-pointer"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `src/components/billing/SubscriptionGate.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { PLAN_INFO } from '../../data/plans';
import { billingApi, type PlanId } from '../../lib/billingApi';
import { CardBrickForm } from './CardBrickForm';

interface SubscriptionGateProps {
  onSubscribed: () => void;
  onLogout: () => void;
  wasCanceled: boolean;
}

export function SubscriptionGate({ onSubscribed, onLogout, wasCanceled }: SubscriptionGateProps) {
  const [plan, setPlan] = useState<PlanId>('annual');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    billingApi
      .config()
      .then((c) => setPublicKey(c.publicKey))
      .catch(() => setError('Pagamentos indisponíveis no momento. Tente novamente em instantes.'));
  }, []);

  const handleToken = async (token: string) => {
    setError(null);
    try {
      await billingApi.subscribe(plan, token);
      onSubscribed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir a assinatura.');
      throw e; // o Brick também exibe o erro no formulário
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center px-4 py-10 font-sans">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
          Assine para liberar o Flow Prompt Forge
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          {wasCanceled
            ? 'Sua assinatura anterior foi encerrada. Escolha um plano para voltar a usar.'
            : 'Escolha seu plano e comece a gerar prompts profissionais agora mesmo.'}
        </p>

        <div role="radiogroup" aria-label="Plano" className="mt-6 grid gap-4 sm:grid-cols-2">
          {(Object.keys(PLAN_INFO) as PlanId[]).map((id) => {
            const info = PLAN_INFO[id];
            const selected = plan === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPlan(id)}
                className={`text-left rounded-2xl border p-5 transition-all cursor-pointer ${
                  selected
                    ? 'border-amber-400 bg-amber-500/10'
                    : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-600'
                }`}
              >
                <div className="text-sm font-semibold text-amber-400">{info.label}</div>
                <div className="mt-1 text-2xl font-bold">
                  {info.priceLabel} <span className="text-sm font-normal text-neutral-400">{info.period}</span>
                </div>
                <p className="mt-2 text-xs text-neutral-400">{info.note}</p>
              </button>
            );
          })}
        </div>

        <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold text-neutral-200">Dados do cartão</h2>
          {error && (
            <p role="alert" className="mb-3 text-sm text-red-400">
              {error}
            </p>
          )}
          {publicKey ? (
            <CardBrickForm key={plan} amount={PLAN_INFO[plan].price} publicKey={publicKey} onToken={handleToken} />
          ) : (
            !error && <p className="text-sm text-neutral-400">Carregando formulário de pagamento...</p>
          )}
        </section>

        <p className="mt-4 text-xs text-neutral-500">
          Garantia de 7 dias: cancele em até 7 dias da primeira cobrança e receba o reembolso total, direto pelo app.
          Pagamento processado pelo Mercado Pago; os dados do cartão não passam pelos nossos servidores.
        </p>

        <button
          type="button"
          onClick={onLogout}
          className="mt-6 text-xs text-neutral-400 underline hover:text-neutral-200 cursor-pointer"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Criar `src/components/billing/SubscriptionConfirm.tsx`**

```tsx
import { useEffect, useState } from 'react';

interface SubscriptionConfirmProps {
  hasAccess: boolean;
  refresh: () => Promise<void>;
  onDone: () => void;
}

const POLL_MS = 3000;
const MAX_ATTEMPTS = 10;

// O acesso só é liberado quando o webhook do Mercado Pago confirma o pagamento:
// aqui apenas aguardamos (polling do estado vindo do backend).
export function SubscriptionConfirm({ hasAccess, refresh, onDone }: SubscriptionConfirmProps) {
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (hasAccess) onDone();
  }, [hasAccess, onDone]);

  useEffect(() => {
    if (hasAccess || attempts >= MAX_ATTEMPTS) return;
    const timer = setTimeout(async () => {
      await refresh();
      setAttempts((a) => a + 1);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [hasAccess, attempts, refresh]);

  const timedOut = attempts >= MAX_ATTEMPTS && !hasAccess;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold">
        {timedOut ? 'Ainda estamos confirmando seu pagamento' : 'Confirmando seu pagamento...'}
      </h1>
      <p className="max-w-md text-sm text-neutral-400">
        {timedOut
          ? 'A confirmação pode levar alguns minutos. Você pode verificar novamente agora ou atualizar a página mais tarde.'
          : 'Isso costuma levar poucos segundos. Não feche esta página.'}
      </p>
      {timedOut && (
        <button
          type="button"
          onClick={() => setAttempts(0)}
          className="px-4 py-2 rounded-lg bg-amber-500 text-neutral-950 text-sm font-semibold hover:bg-amber-400 cursor-pointer"
        >
          Verificar novamente
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npm run lint && npm run build`
Expected: sem erros de tipo; build concluído.

- [ ] **Step 6: Commit**

```bash
git add src/components/billing
git commit -m "feat: card brick form, paywall and payment confirmation screens"
```

---

### Task 16: Frontend — portal da assinatura, banner de carência e integração no `App`

**Files:**
- Create: `src/components/billing/SubscriptionPortal.tsx`
- Create: `src/components/billing/GraceBanner.tsx`
- Modify: `src/hooks/useSubscription.ts`
- Modify: `src/components/Header.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `billingApi`, `BillingStatus`, `Invoice`, `PlanId` (Task 14); `PLAN_INFO`, `formatBRL`, `formatDate`; `CardBrickForm`, `SubscriptionGate`, `SubscriptionConfirm`, `BillingLoading`, `BillingLoadError` (Task 15); `useSubscription` (Task 14).
- Produces:
  - `SubscriptionPortal({ isOpen: boolean; status: BillingStatus; startWithCard: boolean; onClose: () => void; onChanged: () => Promise<void> })`.
  - `GraceBanner({ graceUntil?: string | null; onUpdateCard: () => void })`.
  - `Header` ganha a prop opcional `onOpenSubscription?: () => void`.

- [ ] **Step 1: Evitar o "flash" de erro em `useSubscription`**

Em `src/hooks/useSubscription.ts`, trocar a linha final `return { data, isLoading, error, refresh };` por:

```ts
  // Entre a autenticação e o primeiro fetch, `data` e `error` são nulos: conta como carregando.
  const loading = isLoading || (enabled && data === null && error === null);
  return { data, isLoading: loading, error, refresh };
```

- [ ] **Step 2: Criar `src/components/billing/GraceBanner.tsx`**

```tsx
import { formatDate } from '../../utils/format';

interface GraceBannerProps {
  graceUntil?: string | null;
  onUpdateCard: () => void;
}

export function GraceBanner({ graceUntil, onUpdateCard }: GraceBannerProps) {
  return (
    <div role="alert" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <span>
          Não conseguimos cobrar seu cartão. Atualize até <strong>{formatDate(graceUntil)}</strong> para não perder o
          acesso.
        </span>
        <button
          type="button"
          onClick={onUpdateCard}
          className="rounded-lg bg-amber-500 px-3 py-1 font-semibold text-neutral-950 hover:bg-amber-400 cursor-pointer"
        >
          Atualizar cartão
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `src/components/billing/SubscriptionPortal.tsx`**

```tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { PLAN_INFO } from '../../data/plans';
import { billingApi, type BillingStatus, type Invoice, type PlanId } from '../../lib/billingApi';
import { formatBRL, formatDate } from '../../utils/format';
import { CardBrickForm } from './CardBrickForm';

interface SubscriptionPortalProps {
  isOpen: boolean;
  status: BillingStatus;
  startWithCard: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

const STATUS_LABEL: Record<BillingStatus['status'], string> = {
  none: 'Sem assinatura',
  pending: 'Confirmando pagamento',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
  canceled: 'Cancelada',
};

const INVOICE_LABEL: Record<Invoice['status'], string> = {
  paid: 'Paga',
  failed: 'Não aprovada',
  scheduled: 'Agendada',
};

const buttonBase =
  'rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
const primary = `${buttonBase} bg-amber-500 text-neutral-950 hover:bg-amber-400`;
const secondary = `${buttonBase} border border-neutral-700 text-neutral-200 hover:bg-neutral-800`;
const danger = `${buttonBase} bg-red-600 text-white hover:bg-red-500`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-neutral-800 pt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">{title}</h3>
      {children}
    </section>
  );
}

export function SubscriptionPortal({ isOpen, status, startWithCard, onClose, onChanged }: SubscriptionPortalProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState<'cancel' | 'withdraw' | null>(null);
  const [showCard, setShowCard] = useState(startWithCard);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setShowCard(startWithCard);
    setConfirming(null);
    setMessage(null);
    billingApi
      .invoices()
      .then((r) => setInvoices(r.invoices))
      .catch(() => setInvoices([]));
  }, [isOpen, startWithCard]);

  useEffect(() => {
    if (!showCard || publicKey) return;
    billingApi
      .config()
      .then((c) => setPublicKey(c.publicKey))
      .catch(() => setMessage({ kind: 'error', text: 'Não foi possível carregar o formulário de cartão.' }));
  }, [showCard, publicKey]);

  const run = useCallback(
    async (successText: string, action: () => Promise<unknown>) => {
      setBusy(true);
      setMessage(null);
      try {
        await action();
        await onChanged();
        setMessage({ kind: 'ok', text: successText });
        setConfirming(null);
      } catch (e) {
        setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.' });
      } finally {
        setBusy(false);
      }
    },
    [onChanged]
  );

  const handleCardToken = async (token: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await billingApi.updateCard(token);
      await onChanged();
      setMessage({ kind: 'ok', text: 'Cartão atualizado. A próxima cobrança usará o novo cartão.' });
      setShowCard(false);
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Não foi possível atualizar o cartão.' });
      throw e; // o Brick também exibe o erro
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const plan: PlanId = status.plan ?? 'monthly';
  const otherPlan: PlanId = plan === 'monthly' ? 'annual' : 'monthly';
  const isActive = status.status === 'active';
  const canManage = isActive || status.status === 'past_due';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Minha assinatura"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Minha assinatura</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              message.kind === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {message.text}
          </p>
        )}

        <Section title="Resumo">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-400">Situação</dt>
              <dd>{STATUS_LABEL[status.status]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-400">Plano</dt>
              <dd>
                {PLAN_INFO[plan].label} · {PLAN_INFO[plan].priceLabel} {PLAN_INFO[plan].period}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-400">
                {status.cancelAtPeriodEnd ? 'Acesso até' : status.status === 'past_due' ? 'Carência até' : 'Próxima cobrança'}
              </dt>
              <dd>{formatDate(status.status === 'past_due' ? status.graceUntil : status.currentPeriodEnd)}</dd>
            </div>
          </dl>
        </Section>

        {isActive && !status.cancelAtPeriodEnd && (
          <Section title="Trocar de plano">
            {status.pendingPlan ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>
                  Seu plano mudará para <strong>{PLAN_INFO[status.pendingPlan].label}</strong> em{' '}
                  <strong>{formatDate(status.pendingPlanEffectiveAt)}</strong>.
                </span>
                <button type="button" disabled={busy} className={secondary} onClick={() => run('Troca desfeita.', billingApi.undoPlanChange)}>
                  Desfazer
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-neutral-300">
                  A mudança vale a partir da próxima renovação ({formatDate(status.currentPeriodEnd)}), sem cobrança extra agora.
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className={secondary}
                  onClick={() => run('Troca agendada para a próxima renovação.', () => billingApi.changePlan(otherPlan))}
                >
                  Mudar para {PLAN_INFO[otherPlan].label}
                </button>
              </div>
            )}
          </Section>
        )}

        {canManage && (
          <Section title="Cartão">
            {showCard ? (
              publicKey ? (
                <CardBrickForm amount={PLAN_INFO[plan].price} publicKey={publicKey} onToken={handleCardToken} />
              ) : (
                <p className="text-sm text-neutral-400">Carregando formulário...</p>
              )
            ) : (
              <button type="button" className={secondary} onClick={() => setShowCard(true)}>
                Trocar cartão
              </button>
            )}
          </Section>
        )}

        {canManage && (
          <Section title="Cancelamento">
            {status.cancelAtPeriodEnd ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Cancelamento agendado. Você tem acesso até {formatDate(status.currentPeriodEnd)}.</span>
                <button type="button" disabled={busy} className={primary} onClick={() => run('Assinatura retomada.', billingApi.resume)}>
                  Retomar
                </button>
              </div>
            ) : confirming === 'cancel' ? (
              <div className="space-y-2 text-sm">
                <p>
                  {isActive
                    ? `Você mantém o acesso até ${formatDate(status.currentPeriodEnd)}. Confirmar cancelamento?`
                    : 'O acesso será encerrado agora. Confirmar cancelamento?'}
                </p>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} className={danger} onClick={() => run('Cancelamento confirmado.', billingApi.cancel)}>
                    Confirmar cancelamento
                  </button>
                  <button type="button" disabled={busy} className={secondary} onClick={() => setConfirming(null)}>
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={secondary} onClick={() => setConfirming('cancel')}>
                Cancelar assinatura
              </button>
            )}
          </Section>
        )}

        {status.canWithdraw && (
          <Section title="Direito de arrependimento">
            <p className="text-sm text-neutral-300">
              Você pode desistir até <strong>{formatDate(status.withdrawDeadline)}</strong> e receber o reembolso total.
              O acesso é encerrado na hora.
            </p>
            {confirming === 'withdraw' ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className={danger}
                  onClick={() => run('Reembolso solicitado. O valor pode levar alguns dias para aparecer na fatura.', billingApi.withdraw)}
                >
                  Sim, cancelar e reembolsar
                </button>
                <button type="button" disabled={busy} className={secondary} onClick={() => setConfirming(null)}>
                  Voltar
                </button>
              </div>
            ) : (
              <button type="button" className={`${secondary} mt-2`} onClick={() => setConfirming('withdraw')}>
                Desistir e receber reembolso
              </button>
            )}
          </Section>
        )}

        <Section title="Faturas">
          {invoices === null ? (
            <p className="text-sm text-neutral-400">Carregando...</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhuma cobrança ainda.</p>
          ) : (
            <ul className="divide-y divide-neutral-800 text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex justify-between py-1.5">
                  <span>{formatDate(inv.date)}</span>
                  <span>{formatBRL(inv.amount)}</span>
                  <span className="text-neutral-400">{INVOICE_LABEL[inv.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Editar `src/components/Header.tsx`**

Três edições:

1. Import: trocar `import { Settings, History, Sparkles, Clapperboard } from 'lucide-react';` por `import { Settings, History, Sparkles, Clapperboard, CreditCard } from 'lucide-react';`.
2. Em `HeaderProps`, depois de `  onLogout?: () => void;` acrescentar `  onOpenSubscription?: () => void;`. Na desestruturação, depois de `  onLogout,` (antes de `}) => {`) acrescentar `  onOpenSubscription,`.
3. Imediatamente antes de `          {onOpenLanding && (` inserir:

```tsx
          {onOpenSubscription && (
            <button
              type="button"
              onClick={onOpenSubscription}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-200 bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700/60 hover:border-neutral-600 transition-all cursor-pointer"
              title="Gerenciar minha assinatura"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Minha assinatura</span>
            </button>
          )}
```

- [ ] **Step 5: Editar `src/App.tsx`** (6 edições)

1. `import React, { useState, useEffect, useRef } from 'react';` → `import React, { useState, useEffect, useRef, useCallback } from 'react';`
2. Depois de `import { useSupabaseSession } from './hooks/useSupabaseSession';` acrescentar:

```tsx
import { useSubscription } from './hooks/useSubscription';
import { SubscriptionGate } from './components/billing/SubscriptionGate';
import { SubscriptionConfirm } from './components/billing/SubscriptionConfirm';
import { SubscriptionPortal } from './components/billing/SubscriptionPortal';
import { GraceBanner } from './components/billing/GraceBanner';
import { BillingLoading, BillingLoadError } from './components/billing/BillingStateScreens';
```

3. Depois de `  const isAuthenticated = session !== null;` acrescentar:

```tsx

  // Cobrança: estado vindo do backend (o bloqueio real das rotas de IA é no servidor).
  const subscription = useSubscription(isAuthenticated);
  const [isConfirming, setIsConfirming] = useState<boolean>(
    () => window.location.pathname === '/subscription/confirm'
  );
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [portalStartsWithCard, setPortalStartsWithCard] = useState(false);
  const finishConfirming = useCallback(() => {
    window.history.replaceState(null, '', '/');
    setIsConfirming(false);
  }, []);
  const startConfirming = () => {
    window.history.replaceState(null, '', '/subscription/confirm');
    setIsConfirming(true);
  };
```

4. Imediatamente antes de `  // 2. Application Workbench View` inserir:

```tsx
  // Cobrança: usuário autenticado sem acesso vê o paywall no lugar da bancada.
  if (isAuthenticated) {
    if (isConfirming) {
      return (
        <SubscriptionConfirm
          hasAccess={subscription.data?.hasAccess ?? false}
          refresh={subscription.refresh}
          onDone={finishConfirming}
        />
      );
    }
    if (subscription.isLoading) return <BillingLoading />;
    if (!subscription.data) {
      return (
        <BillingLoadError message={subscription.error} onRetry={subscription.refresh} onLogout={handleLogout} />
      );
    }
    if (!subscription.data.hasAccess) {
      return (
        <SubscriptionGate
          onSubscribed={startConfirming}
          onLogout={handleLogout}
          wasCanceled={subscription.data.status === 'canceled'}
        />
      );
    }
  }

```

5. Substituir o trecho do `<Header ... />`:

```tsx
        userEmail={session?.user?.email}
        onLogout={handleLogout}
      />
```

por:

```tsx
        userEmail={session?.user?.email}
        onLogout={handleLogout}
        onOpenSubscription={
          subscription.data && subscription.data.status !== 'none'
            ? () => {
                setPortalStartsWithCard(false);
                setIsPortalOpen(true);
              }
            : undefined
        }
      />
      {subscription.data?.status === 'past_due' && subscription.data.hasAccess && (
        <GraceBanner
          graceUntil={subscription.data.graceUntil}
          onUpdateCard={() => {
            setPortalStartsWithCard(true);
            setIsPortalOpen(true);
          }}
        />
      )}
```

6. Imediatamente antes de `      {/* Checkout / Subscription Modal */}` inserir:

```tsx
      {subscription.data && (
        <SubscriptionPortal
          isOpen={isPortalOpen}
          status={subscription.data}
          startWithCard={portalStartsWithCard}
          onClose={() => setIsPortalOpen(false)}
          onChanged={subscription.refresh}
        />
      )}

```

- [ ] **Step 6: Verificar**

Run: `npm run lint && npm run build && npm test`
Expected: sem erros de tipo; build concluído; todos os testes passam.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: subscription portal, grace banner and paywall wiring"
```

---

### Task 17: Revisão de segurança dedicada

**Files:** nenhum novo (correções, se houver, entram em commits próprios).

- [ ] **Step 1: Varreduras locais**

```bash
grep -rnE "APP_USR-|TEST-[0-9]{6,}" api src supabase || echo "OK: nenhuma credencial literal"
grep -rn "sandbox_init_point" api src || echo "OK: sandbox_init_point não usado"
grep -rn "SERVICE_ROLE\|supabaseAdmin" src || echo "OK: service role fora do frontend"
grep -rn "console\.\(log\|error\|warn\)" api/_lib/billing api/billing api/webhooks api/cron
git check-ignore -v .env.local
```

Expected: as três primeiras imprimem "OK"; os `console.*` listados registram só nomes de erro/ids (nunca token, e-mail ou corpo); `.env.local` aparece como ignorado.

- [ ] **Step 2: Conferir invariantes no código**

```bash
grep -rn "X-Idempotency-Key" api/_lib/billing/mercadopago.ts
grep -rn "timingSafeEqual" api/_lib/billing/safeEqual.ts
grep -rn "requireActiveSubscription" api/*.ts
grep -rn "external_reference" api/_lib/billing/service/subscribe.ts
```

Expected: cada comando retorna ao menos uma linha (idempotência, comparação em tempo constante, 4 rotas de IA protegidas + 4 imports, `external_reference` definido).

- [ ] **Step 3: Verificar RLS no banco**

No SQL Editor do Supabase:

```sql
select tablename, policyname, cmd from pg_policies
where tablename in ('subscriptions', 'billing_events', 'webhook_events', 'profiles');
```

Expected: só `subscriptions_select_own` e `profiles_select_own`, ambas `SELECT`.

No navegador, logado como usuário de teste, no console:

```js
const { supabase } = await import('/src/lib/supabaseClient.ts');
const { data: { user } } = await supabase.auth.getUser();
await supabase.from('profiles').update({ subscription_status: 'active' }).eq('id', user.id);
(await supabase.from('profiles').select('subscription_status').eq('id', user.id).single()).data;
(await supabase.from('billing_events').select('id').limit(1)).data;
```

Expected: o `update` não altera nada (o `select` seguinte continua com o status original) e a leitura de `billing_events` volta vazia ou com erro de permissão.

- [ ] **Step 4: Revisão oficial do Mercado Pago**

Rodar `/mp-review` (escopo `full`). Isso chama o MCP `quality_checklist`. Corrigir todo item **CRITICAL** e todo `Missing` obrigatório; itens `Partial` viram tarefa ou justificativa registrada. Guardar o "Implementation Report" gerado.

- [ ] **Step 5: Auditoria de dependências e commit das correções**

```bash
npm audit --omit=dev
```

Corrigir vulnerabilidades altas/críticas em dependências de produção. Se houve qualquer correção nos Steps 1–4:

```bash
git add -A
git commit -m "fix: address security review findings"
```

---

### Task 18: Verificação manual de ponta a ponta (conta de teste, sem sandbox)

O Mercado Pago não tem sandbox: cada teste abaixo é real contra usuários de teste (`mp-test-setup`). Rodar uma vez, na ordem, e **cancelar todas as assinaturas de teste ao final**. Nunca em pipeline.

**Pré-requisitos**
- Migração `0002_billing.sql` aplicada (Task 5).
- Usuários de teste vendedor e comprador criados e com saldo/cartões de teste (`/mp-test-setup`, `/mp-test-cards`).
- Preview (ou produção) implantado na Vercel com todas as variáveis de ambiente (`vercel env add` para Production e Preview; para rodar local, `vercel env pull .env.local`).
- Webhook registrado no painel do Mercado Pago em `https://<APP_URL>/api/webhooks/mercadopago`, tópicos `subscription_preapproval` e `subscription_authorized_payment`; o "Signature secret" vai em `MP_WEBHOOK_SECRET` (`/mp-webhooks` ajuda).
- Domínio do Resend verificado (SPF/DKIM) e `MAIL_FROM` definido.

- [ ] **Step 1: Bloqueio sem assinatura.** Usuário novo, autenticado: vê o paywall (não a bancada). `curl` numa rota de IA com o token do usuário retorna `403` com `code: "subscription_required"`.
- [ ] **Step 2: Assinar plano Mensal** com cartão de teste aprovado (nome `APRO`). Ver "Confirmando seu pagamento..." e depois a bancada. Conferir no SQL: `subscriptions.status = 'active'`, `first_charge_at` e `first_payment_id` preenchidos, `billing_events` com `subscribe` e `webhook.payment_paid`. Chegou o e-mail de recibo.
- [ ] **Step 3: Anti-duplicidade.** Chamar `POST /api/billing/subscribe` de novo: `409`. Repetir um webhook com o mesmo `x-request-id`: `200` sem reprocessar (sem novo e-mail).
- [ ] **Step 4: Gate B — trocar plano (empírico).** No portal, "Mudar para Anual". Esperado: `pending_plan = 'annual'`, plano e acesso inalterados, e-mail de troca agendada. Em **seu** terminal (o token não passa por aqui), conferir o valor futuro no MP: `curl -s -H "Authorization: Bearer $MP_ACCESS_TOKEN" https://api.mercadopago.com/preapproval/<mp_preapproval_id>` e ver `auto_recurring.transaction_amount = 948` e `frequency_type = years`. Se o MP recusou ou ignorou a mudança, **PARE** e volte ao brainstorming (plano B). "Desfazer" deve voltar para 119 / `months`.
- [ ] **Step 5: Trocar cartão.** No portal, "Trocar cartão" com outro cartão de teste; `billing_events` registra `update_card`; a assinatura continua a mesma (`mp_preapproval_id` inalterado, sem segunda `preapproval`).
- [ ] **Step 6: Cancelar e retomar.** Cancelar: `cancel_at_period_end = true`, acesso continua, e-mail enviado. Retomar: volta a `false`. Cancelar de novo e forçar o vencimento:

```sql
update subscriptions set current_period_end = now() - interval '1 hour' where user_id = '<uuid>';
```

Rodar o cron no **seu** terminal: `curl -s -H "Authorization: Bearer $CRON_SECRET" https://<APP_URL>/api/cron/billing`. Esperado: `canceledAtPeriodEnd: 1`, assinatura cancelada no MP e `status = 'canceled'`, acesso bloqueado. Sem o header (ou com secret errado): `401`.
- [ ] **Step 7: Carência.** Numa conta com assinatura ativa, simular falha:

```sql
update subscriptions set status = 'past_due', grace_until = now() + interval '3 days' where user_id = '<uuid>';
```

Esperado: banner "Atualizar cartão" com a data; acesso continua. Depois `grace_until = now() - interval '1 hour'`: paywall e rota de IA `403`. Rodar o cron: `graceExpired: 1`. (A cobrança recusada real só ocorre na renovação; o comportamento do webhook para falha está coberto pelos testes unitários.)
- [ ] **Step 8: Arrependimento.** Reassinar e, dentro de 7 dias da primeira cobrança, "Desistir e receber reembolso". Esperado: reembolso total no MP, `refunded_at` preenchido, `status = 'canceled'`, acesso bloqueado, e-mail de reembolso. Reassinar de novo e tentar o arrependimento outra vez: botão ausente e API `409 already_refunded`. Forçar `first_charge_at = now() - interval '8 days'` em outra conta: API `409 expired`.
- [ ] **Step 9: Segurança do webhook.** `curl -X POST` para o webhook sem `x-signature`, com assinatura adulterada e com `ts` antigo: todos `401`. Nenhum dado é gravado.
- [ ] **Step 10: Reconciliação.** Cancelar uma assinatura de teste direto no painel do MP e rodar o cron: `reconciled: 1` e `status = 'canceled'` no banco.
- [ ] **Step 11: Faturas.** No portal, a lista mostra ao menos a cobrança inicial.
- [ ] **Step 12: Limpeza.** Cancelar no painel do MP todas as assinaturas de teste que ainda estejam `authorized`.
- [ ] **Step 13: Verificação final.**

```bash
npm test && npm run lint && npm run build
git status --short
```

Expected: tudo verde e árvore limpa (exceto o que for commitado a seguir).

---

## Self-Review (spec × plano)

| Seção do spec | Task |
|---|---|
| Decisões (planos, uma preapproval, Brick, troca no fim, arrependimento 7d, carência 7d, Resend) | 3, 8–13, 15–16 |
| Porta de verificação do `PUT` / plano B | 1 (Gate A), 9 (gate), 18 (Gate B) |
| Mapa de planos no servidor | 3 |
| Migração (`subscriptions`, `billing_events` imutável, `webhook_events`, RLS, drop de policy) | 5 |
| Regra de acesso e máquina de estados | 3, 8–12 |
| Endpoints `subscribe`, `change-plan` (POST/DELETE), `update-card`, `cancel`, `resume`, `withdraw`, `status`, `invoices`, `config` | 8, 9, 10, 13 |
| `X-Idempotency-Key` em toda mutação no MP | 6, 8–10 |
| Webhook (HMAC, anti-replay, idempotência, reconciliação de valor, promoção de plano, carência) | 4, 11, 13 |
| Cron (cancelamentos, reconciliação, carências, isolamento de falhas) | 12, 13 |
| E-mails transacionais | 7, 8–12 |
| Frontend (`useSubscription`, gate, confirm, portal, banner) | 14–16 |
| Bloqueio das 4 rotas de IA no backend, falha fechada | 13 |
| Segurança (RLS, logs sem PII, rate limit, segredos) | 5, 8, 13, 17 |
| Testes unitários, integração e manual | 2–12 (unit/integração com fakes), 18 (manual) |
| Riscos: janela do cron, jurídico, SPF/DKIM | 13 (horário do cron), 18 (pré-requisitos) |

**Emendas ao spec feitas na Task 1:** chave de idempotência do webhook com `x-request-id`; `refunded_at` preservado na reassinatura; `billing_events.user_id` sem FK; endpoints num único `[action].ts`.

**Consistência de tipos conferida:** `Deps` (`mp`, `repo`, `mailer`, `now`, `appUrl`, `publicKey`), `Result`, `User`, `Subscription` e `BillingRepo` têm a mesma forma em todas as tasks; `makeDeps` (Task 8) é o único construtor de `Deps` em testes; `routeBilling` recebe `Deps` e o body já saneado.
