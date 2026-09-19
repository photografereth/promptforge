# Pilar 2: Assinaturas e Cobrança Recorrente via Mercado Pago — Design

Status: Revisão 2 (escopo ampliado para MVP profissional), aguardando revisão do usuário
Date: 2026-09-18
Depends on: Pilar 1 (auth + database foundation) — `docs/superpowers/specs/2026-09-18-auth-database-foundation-design.md`
Unblocks: Pilar 3 (quotas de IA/fila, que usa `plan` e o estado da assinatura)
Substitui: a Revisão 1 deste spec (fluxo hospedado via `init_point`, troca de cartão com duas `preapproval`s, cancelamento só por cron)

## Contexto

O Pilar 1 deu ao produto contas reais (Supabase Auth) e `public.profiles` com
`subscription_status`, mas nenhuma cobrança acontece e não há enforcement.

Este pilar entrega o **controle completo do ciclo de vida da assinatura**:
assinar, trocar de plano, trocar de cartão, cancelar e retomar, direito de
arrependimento com reembolso, tratamento de falha de cobrança com carência,
histórico de faturas e e-mails transacionais. Ao final, o acesso às
funcionalidades de IA passa a ser **bloqueado no backend** para quem não tem
assinatura vigente. Sem período de trial gratuito.

Planos: **Mensal R$ 119,00** e **Anual R$ 948,00** (já usados como copy no
`CheckoutModal`). Um único produto em dois ciclos.

### Terminologia

Não existe "Preapproval + Checkout Pro" como produto oficial: Checkout Pro é a
API de Preferences (pagamento avulso). Este pilar usa a **API de Assinaturas
(`preapproval`)** **sem plano** (`without-plan`), no modo **`authorized`**: o
cartão é tokenizado no navegador pelo **Card Payment Brick** e o backend cria
a `preapproval` com o `card_token_id`. Referência: `products.md` do plugin
Mercado Pago v4.3.2, seção *Subscriptions*, contrato "Without plan, authorized".

## Decisões de produto (aprovadas)

| Tema | Decisão |
|---|---|
| Estrutura de planos | Só Mensal e Anual. Sem tiers no MVP. |
| Modelo técnico | **Uma `preapproval` por usuário, sem `preapproval_plan`**, alterada com `PUT`. Estado de negócio no nosso banco. |
| Cartão | **Card Payment Brick** embutido para assinar e para trocar cartão. Dados de cartão nunca tocam o nosso servidor. |
| Troca de plano | **Sempre no fim do período.** Agendável e desfazível até a data. Sem proporcional, sem cobrança dupla. |
| Cancelamento | No fim do período. Acesso continua até `current_period_end`. Reversível até o cron cancelar no MP. |
| Arrependimento | Self-service em até **7 dias** da primeira cobrança (CDC art. 49, a confirmar com o jurídico): reembolso total + revogação imediata. |
| Falha de cobrança | **Carência de 7 dias** com acesso mantido, banner e e-mail. Depois bloqueia. |
| E-mail transacional | **Resend** (`RESEND_API_KEY`, domínio verificado com SPF/DKIM). |

## Não-objetivos (fora do MVP)

- Múltiplos tiers e quotas por plano (Pilar 3).
- Cupons, trial gratuito, notas fiscais e impostos.
- Portal administrativo. O suporte usa o painel do Mercado Pago e a tabela `billing_events`.
- Troca de plano imediata ou com crédito proporcional.
- Automatizar testes contra o Mercado Pago em pipeline (não há sandbox).

## Modelo técnico

Uma única `preapproval` (sem `preapproval_plan_id`) por usuário. Trocar plano e
trocar cartão são `PUT /preapproval/{id}` na mesma assinatura, o que elimina a
sobreposição de duas assinaturas e o risco de cobrança dupla da Revisão 1.

**Limitação documentada:** uma `preapproval` sem plano não migra para plano
depois. Aceito, pois o produto tem só dois planos fixos e o mapa de preços
vive no servidor.

**Porta de verificação (primeira tarefa do plano):** confirmar, via MCP
`search_documentation` e um teste manual único, que `PUT /preapproval/{id}`
aceita alterar `auto_recurring.frequency_type` e `transaction_amount` juntos e a
partir de que cobrança o novo valor vale. Se **não** aceitar, `change-plan`
adota o **plano B**: cancelar a `preapproval` no vencimento e criar uma nova
com novo `card_token_id` obtido pelo Brick. O resto do design não muda; só a
seção "Trocar plano" é substituída.

### Mapa de planos (servidor, fonte única)

```ts
// api/_lib/plans.ts
export const PLANS = {
  monthly: { amount: 119.0, frequency: 1, frequencyType: 'months', label: 'Plano Mensal' },
  annual:  { amount: 948.0, frequency: 1, frequencyType: 'years',  label: 'Plano Anual' },
} as const;
```

Preço, moeda, frequência e plano nunca são aceitos do navegador.

## Modelo de dados — `supabase/migrations/0002_billing.sql`

```sql
create table public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  mp_preapproval_id text unique,
  plan text not null check (plan in ('monthly','annual')),
  status text not null check (status in ('pending','active','past_due','canceled')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  pending_plan text check (pending_plan in ('monthly','annual')),
  pending_plan_effective_at timestamptz,
  grace_until timestamptz,
  first_charge_at timestamptz,
  first_payment_id text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- Nenhuma policy de insert/update/delete: só o service role escreve.

create table public.billing_events (
  id bigint generated always as identity primary key,
  user_id uuid, -- sem FK: a trilha de auditoria sobrevive à exclusão da conta (o trigger de imutabilidade bloquearia o `set null`)
  actor text not null check (actor in ('user','webhook','cron','system')),
  action text not null,
  before jsonb,
  after jsonb,
  mp_id text,
  created_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
-- Sem policies: só o service role acessa. Imutável:
create function public.billing_events_immutable() returns trigger
language plpgsql as $$ begin raise exception 'billing_events is append-only'; end $$;
create trigger billing_events_no_update before update or delete on public.billing_events
  for each row execute function public.billing_events_immutable();

create table public.webhook_events (
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  primary key (event_id, event_type)
);
alter table public.webhook_events enable row level security;

-- Fecha a brecha do Pilar 1 (usuário podia alterar o próprio subscription_status):
drop policy if exists "profiles_update_own" on public.profiles;
```

`profiles.subscription_status` passa a ser **espelho** de `subscriptions.status`,
escrito só pelo backend. O valor legado `trial` significa "sem assinatura"
(nenhum trial é concedido). **O acesso nunca é decidido por `profiles`**, e sim
pela regra abaixo, avaliada no backend.

### Regra de acesso

Acesso liberado se, e somente se:
`status = 'active'` **ou** (`status = 'past_due'` **e** `grace_until > now()`).
Implementada em `requireActiveSubscription()` e aplicada às 4 rotas de IA. O
frontend só exibe o estado; nunca decide acesso.

### Máquina de estados

```
(sem linha) ──subscribe──▶ pending ──webhook authorized──▶ active
active ──cobrança falhou──▶ past_due (grace_until = +7 dias)
past_due ──cobrança paga / cartão atualizado──▶ active
past_due ──carência vencida / MP pausa ou cancela──▶ canceled
active ──cancel_at_period_end + cron──▶ canceled
active ──withdraw (≤ 7 dias da 1ª cobrança)──▶ canceled (com reembolso)
canceled ──subscribe──▶ pending (nova preapproval; mesma linha)
```

Toda transição grava uma linha em `billing_events` (ator, antes, depois, `mp_id`).

## Endpoints (todos autenticados; `user_id` vem do JWT verificado)

Implementação: um único `api/billing/[action].ts` despacha todas as ações (limite de 12 funções do plano Hobby da Vercel).

Toda chamada mutante ao Mercado Pago envia `X-Idempotency-Key`. A chave é
derivada de `(user_id, ação, parâmetros)` para que clique duplo ou retry gere
uma só operação.

| Endpoint | Comportamento |
|---|---|
| `POST /api/billing/subscribe` | Body `{ plan, card_token_id }`. Resolve preço pelo `PLANS`. Recusa se já existe assinatura em qualquer estado diferente de `canceled`. Preserva `refunded_at` na reassinatura (um reembolso por conta). Cria `preapproval` `authorized` com `external_reference = user_id`, `payer_email` do perfil e `back_url` HTTPS. Grava `subscriptions.status = 'pending'`. Acesso só libera pelo webhook. |
| `POST /api/billing/change-plan` | Body `{ plan }`. Exige `active`. Grava `pending_plan` + `pending_plan_effective_at = current_period_end` e aplica o `PUT` conforme a porta de verificação. Não muda acesso nem `plan` até a renovação. |
| `DELETE /api/billing/change-plan` | Desfaz a troca agendada (reverte o `PUT`). |
| `POST /api/billing/update-card` | Body `{ card_token_id }`. `PUT /preapproval/{id}` com o novo token. Em `past_due`, a próxima tentativa de cobrança usa o novo cartão. |
| `POST /api/billing/cancel` | Marca `cancel_at_period_end = true`. Não chama o MP agora. Envia e-mail. |
| `POST /api/billing/resume` | Reverte `cancel_at_period_end` enquanto o cron não cancelou no MP. |
| `POST /api/billing/withdraw` | Válido só se `now < first_charge_at + 7 dias` e `refunded_at is null`. Reembolso total de `first_payment_id`, cancela a `preapproval` (`PUT status: cancelled`), `status = 'canceled'`, acesso revogado. Rate limit estrito. |
| `GET /api/billing/status` | Estado consolidado para o frontend: plano, próxima cobrança, troca agendada, carência, elegibilidade a arrependimento (com data limite). |
| `GET /api/billing/invoices` | `GET /authorized_payments/search?preapproval_id=...`, lista simplificada (data, valor, status). Sem persistência local. |

## Webhook — `/api/webhooks/mercadopago`

Rota pública, protegida por validação criptográfica:

- Headers obrigatórios `x-signature` (`ts=<ts>,v1=<hex>`) e `x-request-id`.
- String canônica: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
- `v1 = HMAC-SHA256(canônica, MP_WEBHOOK_SECRET)` em hex, comparado com
  `crypto.timingSafeEqual`. Header ausente ou assinatura divergente → `401`.
- **Anti-replay:** `ts` com mais de 5 minutos de diferença → `401`.
- **Idempotência:** insere `(<data.id>:<x-request-id>, type)` em `webhook_events`; se já existir, responde `200` sem reprocessar. O `data.id` sozinho não serve como chave: o MP notifica o mesmo `authorized_payment` várias vezes ao mudar de estado, e descartar as posteriores perderia a cobrança confirmada. Os handlers também são idempotentes por estado (não gravam nem enviam e-mail se nada mudou).
- `200` só **depois** de gravar. Falha interna → `5xx` para o MP reenviar.

Tópicos:

- `subscription_preapproval`: `GET /preapproval/{id}`; localiza o usuário por
  `external_reference` **e** confere `mp_preapproval_id`. Mapeia
  `authorized → active`, `paused → past_due`, `cancelled → canceled`. Usa
  `next_payment_date` nativo para `current_period_end`, se existir (a confirmar).
- `subscription_authorized_payment`: `GET /authorized_payments/{id}`.
  - **Reconciliação de valor:** o valor cobrado deve bater com `PLANS[plan]`;
    divergência → registra em `billing_events`, **não** libera acesso, alerta.
  - Sucesso: `active`, atualiza `current_period_end`, limpa `grace_until`;
    se é a primeira cobrança, grava `first_charge_at` e `first_payment_id`;
    promove `pending_plan` para `plan` quando a renovação do novo ciclo chega.
  - Falha: `past_due` e `grace_until = now + 7 dias` (só define se ainda nulo).

## Cron diário — `/api/cron/billing` (`Authorization: Bearer $CRON_SECRET`, comparação em tempo constante)

1. Cancela no MP as assinaturas com `cancel_at_period_end = true` e
   `current_period_end <= now()`; `status = 'canceled'`.
2. **Reconciliação:** para cada assinatura `pending`/`active`/`past_due`, compara
   `GET /preapproval/{id}` com o banco e corrige divergência (cobre webhook
   perdido). Divergência é registrada em `billing_events`.
3. Expira carências vencidas (`past_due` com `grace_until <= now()` → `canceled`).
4. Falha em um usuário não interrompe o lote; é registrada e tentada no dia seguinte.

## E-mails transacionais (Resend, disparados só pelo backend)

Cobrança falhou (com link para atualizar cartão), assinatura cancelada (com a
data final de acesso), troca de plano agendada, reembolso concluído e recibo
de cobrança. O destinatário é sempre o e-mail do perfil no servidor.
Falha de envio não desfaz a operação: é registrada e reenviada pelo cron.

## Frontend

- `useSubscription()` lê `GET /api/billing/status`. Fonte do estado da UI.
- `SubscriptionGate`: paywall com Mensal/Anual e Card Payment Brick, exibido
  quando não há acesso. O Brick vem do CDN oficial e usa só `MP_PUBLIC_KEY`,
  exposta por rota de configuração (`Cache-Control: no-store`); nunca o token.
- `/subscription/confirm`: polling de `status` a cada 3s por até 30s; depois
  orienta a atualizar a página.
- Portal de assinatura (a partir do Header): plano e próxima cobrança, trocar
  plano com data agendada e "desfazer", trocar cartão (Brick), cancelar e
  retomar, faturas e botão de arrependimento (visível só na janela de 7 dias).
- Banner de carência com contagem de dias e botão "Atualizar cartão".

## Segurança

- Nenhum dado de cartão passa pelo servidor; só o `card_token_id` de uso único.
- `user_id` sempre do JWT; nunca do corpo. Um usuário não altera a assinatura de outro.
- Preço, plano e frequência só do mapa no servidor.
- Rate limit por usuário nos endpoints mutantes (estrito em `withdraw`).
- Logs sem token, e-mail completo ou corpo bruto de webhook: só ids e status.
- Segredos só em variáveis de ambiente; `.env.local` ignorado pelo git.
- RLS: usuário lê só a própria `subscriptions`; escrita só via service role.
  `billing_events` imutável.
- Revisão obrigatória ao final: `/mp-review` completo, `quality_checklist` do
  MCP e formulário de homologação antes de produção.

## Configuração / segredos

| Variável | Uso | Público? |
|---|---|---|
| `MP_ACCESS_TOKEN` | backend, `api/_lib/mercadopago.ts` | não |
| `MP_PUBLIC_KEY` | Card Payment Brick, via rota de config | sim |
| `MP_WEBHOOK_SECRET` | validação do webhook | não |
| `CRON_SECRET` | cron | não |
| `SUPABASE_SERVICE_ROLE_KEY` | `api/_lib/supabaseAdmin.ts` | não |
| `RESEND_API_KEY`, `MAIL_FROM` | e-mails transacionais | não |
| `APP_URL` | `back_url` HTTPS | não |

`vercel.json` ganha `crons` diário apontando para `/api/cron/billing`.

## Tratamento de erros

- Webhook inválido → `401`; evento repetido → `200` sem reprocessar; falha
  interna → `5xx` (MP reenvia por ~24h).
- Falha ao criar/alterar `preapproval` → `502` com mensagem genérica em pt-BR;
  a idempotency key permite retry seguro.
- `withdraw` fora da janela ou já reembolsado → `409` com motivo claro.
- Divergência de valor ou de estado → não libera acesso; registra e alerta.
- Se o reembolso ao MP falhar no `withdraw`, o estado **não** muda e o usuário
  vê erro para tentar de novo; nunca cancela sem reembolsar.

## Testes / validação

**Unitários (Vitest, sem rede):** validação de `x-signature` (válida, adulterada,
ausente, replay), máquina de estados (todas as transições, carência,
arrependimento dentro e fora da janela), reconciliação de valor, mapa de planos
e regra de acesso.

**Integração (cliente do MP simulado):** idempotência (mesma chave, mesma
resposta), autorização (isolamento entre usuários), `change-plan` e
`withdraw` de ponta a ponta no banco.

**Manual em conta de teste do MP** (`mp-test-setup`; sem sandbox, cada teste é
único e seguido de cancelamento): assinar, trocar plano, trocar cartão,
cancelar e retomar, arrependimento com reembolso, cobrança recusada para a
carência. Nunca automatizado em pipeline.

## Riscos e pontos em aberto

1. **`PUT` de plano** (porta de verificação acima). Mitigação: plano B definido.
2. **`payment.id` da primeira cobrança:** obtido de `authorized_payments`; a
   confirmar que o campo permite o reembolso pela API de pagamentos.
3. **Janela do cron diário:** entre o vencimento e a próxima execução pode haver
   uma cobrança extra antes do cancelamento. Mitigação: rodar o cron algumas
   horas antes da renovação típica; eliminar exige agendamento mais preciso.
4. **Jurídico:** confirmar o prazo e o texto do direito de arrependimento.
5. **E-mail:** SPF/DKIM do domínio no Resend precisam estar verificados antes
   de produção.
