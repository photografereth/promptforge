# Pilar 2: Cobrança Recorrente via Mercado Pago — Design

Status: Approved
Date: 2026-09-18
Depends on: Pilar 1 (auth + database foundation) — `docs/superpowers/specs/2026-09-18-auth-database-foundation-design.md`
Unblocks: Pilar 3 (AI quotas/queue, que vai usar `subscription_status`/`plan` para definir limites)

## Contexto

O Pilar 1 deu ao produto contas de usuário reais (Supabase Auth) e uma tabela
`public.profiles` com um campo `subscription_status` (`trial` | `active` |
`past_due` | `canceled`), mas nenhuma cobrança real acontece — todo usuário
fica com `subscription_status = 'trial'` e acesso total ao app, sem
enforcement algum.

Este pilar implementa a cobrança recorrente de verdade via Mercado Pago
(planos mensal R$ 119,00 e anual R$ 948,00, já usados como copy no
`CheckoutModal` desde antes do Pilar 1) e passa a **bloquear** o acesso às
funcionalidades de IA para quem não tem assinatura ativa — sem período de
trial gratuito.

### Correção de terminologia

Não existe "Preapproval + Checkout Pro" como produto oficial do Mercado
Pago — Checkout Pro é a API de Preferences, usada para pagamentos avulsos,
sem modo de assinatura. O que este pilar usa é a **API de Assinaturas
(Preapproval)** no modo **`without-plan-pending`**: o backend cria uma
`preapproval` com `status: "pending"` e os termos de recorrência embutidos
(sem precisar pré-criar um recurso `preapproval_plan`), recebe de volta um
`init_point`, e redireciona o usuário para essa página hospedada pelo
próprio Mercado Pago para inserir o cartão. Do ponto de vista do produto,
o resultado é exatamente o que foi pedido (nenhum formulário de cartão
roda no nosso frontend) — só o nome técnico do fluxo está corrigido aqui
para não gerar confusão ao consultar a documentação oficial depois.

## Objetivo

1. Permitir que um usuário autenticado assine um dos dois planos via
   Mercado Pago, com cobrança recorrente real.
2. Manter `profiles.subscription_status`/`plan` sincronizados com o estado
   real da assinatura via webhook, validado criptograficamente.
3. Bloquear o acesso às 4 rotas de IA (e à interface principal do app)
   para qualquer usuário sem `subscription_status = 'active'` — sem
   período de trial.
4. Portal de gestão da assinatura: cancelar (mantendo acesso até o fim do
   período pago), trocar cartão, e ver histórico de faturas.

## Não-objetivos (fora de escopo deste pilar)

- Checkout embutido (Bricks) — a troca de cartão usa o mesmo fluxo de
  redirecionamento hospedado, cancelando a assinatura antiga e criando
  uma nova.
- Fila/retry robusto para cobranças falhadas, dunning avançado — fica
  para o Pilar 3, que já vai introduzir infraestrutura de fila/agendamento
  mais precisa.
- Cancelamento com precisão de minuto — este pilar usa um Vercel Cron Job
  diário, o que introduz uma pequena janela de risco (ver seção de Riscos).
- Quotas de uso por plano — o Pilar 3 decide *quanto* cada plano permite
  gerar; este pilar só garante que o `plan`/`subscription_status` corretos
  estão disponíveis para essa decisão.
- Armazenar histórico de pagamentos localmente — consultado ao vivo via
  API do Mercado Pago (ver seção E).

## Arquitetura

### A. Fluxo de assinatura (subscribe)

1. Frontend: usuário autenticado sem assinatura ativa escolhe um plano
   (mensal/anual) em uma nova tela de paywall (ver seção F).
2. `POST /api/mercadopago/create-subscription` (autenticado): cria uma
   `preapproval` via `POST /preapproval` com:
   ```json
   {
     "reason": "Flow Prompt Forge — Plano Mensal", // ou Anual
     "external_reference": "<user_id>",
     "payer_email": "<email do usuário>",
     "auto_recurring": {
       "frequency": 1,
       "frequency_type": "months", // ou "years" para o plano anual
       "transaction_amount": 119.00, // ou 948.00
       "currency_id": "BRL"
     },
     "back_url": "<APP_URL>/subscription/confirm",
     "status": "pending"
   }
   ```
   `external_reference` é o `id` do usuário no Supabase (`auth.uid()`) —
   único, já persistido, suficiente para reconciliação sem precisar de
   uma tabela extra de "registros de assinatura".
3. Resposta: `{ id, init_point }`. O backend grava
   `profiles.mercadopago_preapproval_id = id` (via service role) e
   retorna `init_point` para o frontend.
4. Frontend redireciona `window.location.href = init_point`. Usuário
   insere o cartão na página hospedada do Mercado Pago.
5. Mercado Pago redireciona de volta para `<APP_URL>/subscription/confirm`
   (uma nova view simples, não uma rota de servidor — o App detecta essa
   URL e mostra uma tela "Confirmando seu pagamento..."). Essa tela faz
   polling de `profiles.subscription_status` a cada 3s por até 30s
   (o webhook pode demorar um pouco a chegar); ao ficar `active`, navega
   para o app; se o tempo esgotar, mostra uma mensagem pedindo para
   atualizar a página em instantes.

### B. Webhook (`/api/webhooks/mercadopago`)

- Rota pública (sem `authenticate()` — o Mercado Pago não manda token de
  usuário), protegida por validação criptográfica de assinatura.
- **Validação de `x-signature`** (algoritmo exato, não deve ser
  reimplementado de forma diferente):
  - Headers obrigatórios: `x-signature` (formato `ts=<timestamp>,v1=<hex>`)
    e `x-request-id`.
  - String canônica a assinar: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
    (`data.id` vem do corpo JSON, não da URL).
  - `v1 = HMAC-SHA256(canônica, MP_WEBHOOK_SECRET)` em hex.
  - Comparação em tempo constante (`crypto.timingSafeEqual`); qualquer
    header ausente ou assinatura divergente → `401`, sem processar nada.
  - `MP_WEBHOOK_SECRET` é o "Signature secret" do painel do Mercado Pago
    (Webhooks), não o Access Token.
- Tópicos tratados:
  - `subscription_preapproval` — mudança de status da assinatura
    (`pending`→`authorized`→`paused`/`cancelled`). Busca
    `GET /preapproval/{id}` para pegar o estado atual e o
    `external_reference`, atualiza `profiles.subscription_status`
    (`authorized`→`active`, `paused`→`past_due`, `cancelled`→`canceled`)
    e `profiles.plan` (derivado do `auto_recurring.frequency_type`/
    `transaction_amount` retornado).
  - `subscription_authorized_payment` — cada cobrança recorrente. Busca
    `GET /authorized_payments/{id}`; em caso de sucesso, atualiza
    `profiles.current_period_end` para a próxima data de cobrança
    (`start_date` do ciclo + `frequency`/`frequency_type` do
    `auto_recurring`); em caso de falha, marca `subscription_status =
    'past_due'`.
- **Idempotência:** antes de processar, insere `(data.id, type)` numa
  tabela `public.webhook_events` (chave primária composta); se já
  existir, responde `200` sem reprocessar. O Mercado Pago reenvia
  notificações não confirmadas por até ~24h.
- Responde `200` assim que a assinatura é validada e o evento é
  processado (a lógica é rápida o suficiente — uma busca na API do MP +
  uma escrita no banco — para não precisar de fila assíncrona neste
  pilar).

### C. Cancelamento (mantendo acesso até o fim do período)

- `POST /api/mercadopago/cancel-subscription` (autenticado): **não**
  chama o Mercado Pago na hora. Marca
  `profiles.cancel_at_period_end = true` (via service role, para o
  próprio usuário autenticado). `subscription_status` continua `active`
  — acesso não é interrompido.
- Frontend mostra "Sua assinatura foi cancelada. Você continua com acesso
  até `current_period_end`."
- Um **Vercel Cron Job diário** (`vercel.json` → `crons`, apontando para
  `/api/cron/process-cancellations.ts`, protegido por um secret de cron
  — Vercel injeta um header `Authorization: Bearer $CRON_SECRET` nas
  chamadas de cron que a própria função valida) busca perfis com
  `cancel_at_period_end = true AND current_period_end <= now()`, chama
  `PUT /preapproval/{id}` com `{ "status": "cancelled" }` de verdade, e
  atualiza `subscription_status = 'canceled'`.
- Se o usuário reativar antes do cron rodar (endpoint futuro, fora de
  escopo aqui — mas o campo `cancel_at_period_end` já suporta isso:
  bastaria voltar para `false`), a assinatura nunca é cancelada de fato.

### D. Trocar cartão

- Não existe endpoint de "atualizar cartão" via redirecionamento no
  Mercado Pago sem usar Bricks (tokenização embutida). Solução adotada:
  `POST /api/mercadopago/update-card` (autenticado) executa, na sequência,
  o mesmo fluxo do item A (cria uma nova `preapproval` com o mesmo
  `external_reference`), mas **sem cancelar a assinatura antiga
  imediatamente** — grava o novo `preapproval_id` como "pendente de
  confirmação" e só substitui o antigo (e cancela o anterior via
  `PUT /preapproval/{antigo}` status `cancelled`) quando o webhook
  confirma que o novo está `authorized`. Isso evita um buraco de acesso
  entre cancelar o cartão antigo e confirmar o novo.

### E. Histórico de faturas

- `GET /api/mercadopago/invoices` (autenticado): busca
  `GET /authorized_payments/search?preapproval_id=<do usuário>`, retorna
  uma lista simplificada (data, valor, status) para o frontend renderizar.
  Nenhum pagamento é persistido localmente — o Mercado Pago é a fonte da
  verdade, consultada ao vivo.

### F. Paywall no frontend

- Novo hook `useProfile()` (ou extensão de `useSupabaseSession`) lê a
  própria linha de `profiles` (permitido por RLS desde o Pilar 1) e expõe
  `subscription_status`/`plan`/`current_period_end`/
  `cancel_at_period_end`.
- `App.tsx`: quando `isAuthenticated && subscription_status !== 'active'`,
  a view de app passa a renderizar uma tela de paywall (novo componente
  `SubscriptionGate`) em vez da bancada de trabalho — com os dois planos,
  botão que chama o fluxo do item A. Isso substitui o comportamento atual
  (acesso livre para qualquer usuário autenticado) por bloqueio real.
- Uma nova rota/estado `subscription/confirm` (detectado via
  `window.location.pathname` ou um parâmetro de query, já que o app não
  usa React Router) mostra a tela de polling descrita no item A.5.
- Novo componente para o portal de assinatura (cancelar / trocar cartão /
  histórico), acessível a partir do Header quando `subscription_status ===
  'active'`.

### G. Modelo de dados

Nova migração `supabase/migrations/0002_billing.sql`:

```sql
alter table public.profiles
  add column mercadopago_preapproval_id text,
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

-- Fecha a brecha de segurança deixada pendente pelo Pilar 1 (revisão
-- final identificou que a policy de update permitia o usuário alterar
-- seu próprio subscription_status via anon key):
drop policy if exists "profiles_update_own" on public.profiles;
-- Nenhuma policy de update para usuários comuns é recriada — a partir
-- deste pilar, toda escrita em profiles relacionada a assinatura passa
-- pelos endpoints de backend (service role), nunca direto do cliente.
```

### H. Configuração / segredos

Novas variáveis de ambiente:

| Variável | Onde é usada | Público? |
|---|---|---|
| `MP_ACCESS_TOKEN` | backend (`api/_lib/mercadopago.ts`) | não |
| `MP_WEBHOOK_SECRET` | `api/webhooks/mercadopago.ts` | não |
| `CRON_SECRET` | `api/cron/process-cancellations.ts` | não |
| `SUPABASE_SERVICE_ROLE_KEY` | passa a ser usada de verdade neste pilar (`api/_lib/supabaseAdmin.ts`, criado agora) | não |

`vercel.json` ganha uma seção `crons` apontando para
`/api/cron/process-cancellations` (frequência diária).

## Tratamento de erros

- Webhook com assinatura inválida ou headers ausentes → `401`, nada é
  processado ou logado com dados sensíveis.
- Evento já processado (idempotência) → `200` sem reprocessar.
- Falha ao criar `preapproval` (Mercado Pago fora do ar, dados inválidos)
  → `500` com mensagem genérica em pt-BR; frontend mostra erro e permite
  tentar de novo.
- Cron job: se a chamada a `PUT /preapproval/{id}` falhar para um usuário
  específico, o cron continua para os demais e loga o erro — não bloqueia
  o restante do lote. O perfil continua com `cancel_at_period_end = true`
  e será tentado novamente no próximo dia.

## Testes / Validação

Sem framework de testes automatizados (mesma decisão do Pilar 1). Validação
manual, usando um usuário de teste do Mercado Pago (`mp-test-setup`):

1. Assinar o plano mensal com um cartão de teste aprovado → webhook chega,
   `subscription_status` vira `active`, app libera acesso.
2. Chamar uma rota de IA sem assinatura ativa → `403`.
3. Cancelar → `cancel_at_period_end = true`, acesso continua,
   `subscription_status` ainda `active`.
4. Rodar o cron manualmente (chamando o endpoint com o `CRON_SECRET`) com
   `current_period_end` forçado no passado → assinatura cancelada de
   verdade no Mercado Pago, `subscription_status` vira `canceled`, acesso
   bloqueado.
5. Trocar cartão → nova `preapproval` criada, antiga só é cancelada após
   a nova ficar `authorized`.
6. Histórico de faturas mostra ao menos a cobrança inicial.

**Importante (confirmado na pesquisa técnica):** o Mercado Pago não tem
ambiente de sandbox — toda chamada usa a API de produção, e uma
assinatura de teste `authorized` agenda cobranças reais (contra o saldo
simulado do usuário de teste). Isso nunca deve ser automatizado em
pipeline — é sempre um teste manual, único, seguido de cancelamento
imediato.

## Riscos / decisões em aberto para os próximos pilares

- **Janela de risco do cron diário:** entre o vencimento do período pago
  e a próxima execução do cron (até 24h), existe uma chance pequena de o
  Mercado Pago tentar uma cobrança adicional antes do cancelamento
  processar. Mitigação parcial: rodar o cron algumas horas antes do
  horário típico de renovação. Eliminar esse risco por completo exige
  agendamento mais preciso — fica para quando o Pilar 3 introduzir
  infraestrutura de fila/agendamento.
- **`next_payment_date` do Mercado Pago:** o recurso `preapproval`
  possivelmente já expõe a próxima data de cobrança diretamente — se
  confirmado durante a implementação, simplifica o cálculo de
  `current_period_end` (em vez de derivá-lo de `frequency`/
  `frequency_type`). A implementação deve verificar isso e usar o campo
  nativo se existir.
- **Timing da revogação de acesso na troca de cartão:** existe uma janela
  onde o usuário tem duas `preapproval`s "quase" simultâneas (antiga
  ainda não cancelada, nova ainda não confirmada). O desenho aceita essa
  sobreposição por segurança (nunca cortar acesso sem confirmação do
  novo cartão), mas isso significa que, em teoria, ambas poderiam cobrar
  no mesmo ciclo se o timing for muito ruim — mitigado pelo cancelamento
  da antiga assim que a nova confirma, mas não é uma garantia atômica.
