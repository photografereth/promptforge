# Task 18 — pré-requisitos para o teste ponta a ponta (Pilar 2)

Estado em 2026-09-21. O teste manual (Task 18 do plano) só roda com tudo abaixo de pé.
Nenhum valor secreto vai neste arquivo: só nomes de variáveis.

## Por que precisamos de vendedor de teste
O Mercado Pago recusa a mistura: `Both payer and collector must be real or test users`.
Hoje o token do app é de uma conta **real** (id `257404955`), então só pagadores reais funcionam.
Para testar sem dinheiro real, o app deve rodar com credenciais de um **vendedor de teste**, e o usuário
logado no app deve ter o e-mail de um **comprador de teste**.

Apps existentes na conta e o que NÃO usar: `Arcanum Pro` e `LF-App-Assinaturas-…` são de outros sistemas.
Só `PromptForge` (`5695753833085512`) é deste projeto.

## Ordem de execução

### 1. Código no GitHub (quem: você — sai da sua máquina)
```
cd /Users/macos/Development/promptforge-main/.worktrees/pilar2-mercadopago-billing
git push -u origin pilar2-mercadopago-billing
```
Remoto: `github.com/photografereth/promptforge`. Gera o Preview da Vercel no passo 3.

### 2. Banco (quem: você — SQL Editor do Supabase)
Colar e rodar `supabase/migrations/0002_billing.sql`. Depois conferir as policies:
```sql
select tablename, policyname, cmd from pg_policies
where tablename in ('subscriptions','billing_events','webhook_events','profiles');
```
Esperado: só `subscriptions_select_own` e `profiles_select_own` (SELECT).

### 3. Vercel (quem: você, ou eu via MCP com sua confirmação)
Importar `photografereth/promptforge`, framework Vite. São 8 funções serverless (limite Hobby: 12).
`vercel.json` já tem o rewrite do SPA (`/subscription/confirm`) e o cron diário.

### 4. Vendedor e comprador de teste (quem: eu, via MCP `create_test_user`)
- Criar 1 vendedor de teste e 1 comprador de teste (MLB).
- As credenciais do vendedor de teste (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`) devem ser copiadas por você do painel
  para a Vercel. Elas não passam pela conversa.
- O comprador de teste existente (`3600552620`) tem e-mail desconhecido. Pista: `test_user_6470892465839567014@testuser.com`
  foi tratado pelo MP como e-mail de teste no experimento do Gate A (erro diferente dos outros candidatos). Não confirmado.

### 5. Variáveis de ambiente na Vercel (Preview e Production)
`GEMINI_API_KEY`, `APP_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`.
- `APP_URL` = URL do Preview (sem barra final).
- `MP_WEBHOOK_SECRET` só existe depois do passo 6.
- `CRON_SECRET`: gerar com `openssl rand -hex 32`.
- Nunca usar prefixo `VITE_` em segredos.

### 6. Webhook (quem: eu registro via MCP `save_webhook`, você copia o segredo)
URL: `<APP_URL>/api/webhooks/mercadopago`; tópicos `subscription_preapproval` e `subscription_authorized_payment`.
O "Signature secret" aparece só no painel do app do vendedor de teste: copiar para `MP_WEBHOOK_SECRET` e redeployar.

### 7. E-mail (Resend)
Domínio com SPF/DKIM verificados e `MAIL_FROM` desse domínio. Para o teste, o recibo NÃO chega ao comprador de teste
(e-mail fictício): conferir o envio no painel do Resend (logs), não na caixa de entrada.

### 8. Usuário no app
Cadastrar no app com o **e-mail do comprador de teste**. Se o Supabase exigir confirmação de e-mail, desligar a confirmação
no projeto de teste (o e-mail fictício não recebe mensagens).

## 2026-09-22 update: domínio 3dco.com.br verificado no Resend e anexado à produção

Domínio `3dco.com.br` usado temporariamente para validar o passo 7 (e-mail/Resend) acima.
Registros DNS criados no painel do registro.br (modo avançado): `TXT resend._domainkey`
(DKIM), `CNAME send` (SPF/recebimento), `CNAME rsend` (envio) e `TXT _dmarc` (`p=none`).
Painel do Resend confirmou **Verified** em 2026-09-23 01:49 (região `sa-east-1`).

Como o domínio já estava disponível, também foi usado para resolver o bloqueio de
Deployment Protection do MP (ver seção "Vercel/GitHub infra confirmado" no
[[project_pilar2_billing_status]]): anexado ao projeto Vercel como domínio de
**Production** (`A @ → 76.76.21.21`, Vercel sinalizou depois que `216.198.79.1` é o
IP mais novo recomendado — o antigo continua funcionando, troca é opcional).

`MP_NOTIFICATION_URL_OVERRIDE` (Vercel, produção + preview) passou a apontar para
`https://3dco.com.br/api/webhooks/mercadopago`, sem mais o segredo de bypass da Vercel
embutido na URL (esse hack só existia porque o `APP_URL` continua sendo o alias
`.vercel.app`, que ainda tem Deployment Protection). `APP_URL` **não** foi alterado —
o domínio próprio por enquanto só cobre o webhook do MP e o envio de e-mail, não virou
a URL principal do app. Redeploy de produção feito para aplicar a env var
(`dpl_7g6eYjws12TRQRpZu3eU3cyBDqBy`), confirmado com `/api/health` respondendo via
`https://3dco.com.br` e o webhook retornando 401 (assinatura ausente) em vez de 500.

## Depois: rodar a Task 18 do plano (Steps 1–13)
Pontos que o teste precisa responder (registrados no spec, "Resultados da verificação"):
- Gate B: `PUT /preapproval` aceita `months → years` e `119 → 948`?
- `GET /preapproval` expõe `next_payment_date`? (senão, `current_period_end` não atualiza)
- Valores de `status` em `GET /authorized_payments/{id}` e forma de `authorized_payments/search`.
- `cancelled` vs `canceled` no cancelamento.
- Reembolso de pagamento de assinatura (`POST /v1/payments/{id}/refunds`).
- Se o `preapproval` aceita `statement_descriptor`.
