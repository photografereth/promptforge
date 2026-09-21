# Revisão de segurança — Pilar 2 (Mercado Pago)

Data: 2026-09-21 · Branch: `pilar2-mercadopago-billing` · Escopo: Task 17 do plano.

## Resultado: nenhum achado CRÍTICO ou IMPORTANTE. 3 achados baixos e 3 verificações pendentes do usuário.

## Varreduras locais (Steps 1–2)
| Verificação | Resultado |
|---|---|
| `sandbox_init_point` em `api`/`src` | OK: não usado |
| `SERVICE_ROLE`/`supabaseAdmin` em `src` | OK: fora do frontend |
| `console.*` em billing/webhook/cron | OK: só nomes de erro (`error.name`) e mensagens estáticas; nenhum token, e-mail ou corpo |
| `X-Idempotency-Key` em chamadas mutantes | OK (`mercadopago.ts`: `createPreapproval`, `updatePreapproval`, `refundPayment`) |
| `timingSafeEqual` | OK (`safeEqual.ts`, com checagem de tamanho antes, que evita a exceção do Node) |
| `requireActiveSubscription` nas rotas de IA | OK: 4 imports + 4 chamadas; `health.ts` sem auth |
| `external_reference` | OK (`subscribe.ts`: `user.id`) |
| `npm audit --omit=dev` | OK: 0 vulnerabilidades |
| Credencial literal (`APP_USR-`/`TEST-`) em `api`/`src`/`supabase` | **PENDENTE**: comando bloqueado pelo hook do plugin MP; rodar no shell do usuário |
| `.env.local` ignorado pelo git | **PENDENTE**: idem |

## RLS (Step 3, revisão estática das migrações 0001 + 0002)
- `subscriptions`: só `subscriptions_select_own` (SELECT). Sem insert/update/delete para usuários.
- `billing_events`: RLS ligado, **sem policies**; trigger bloqueia UPDATE/DELETE (append-only).
- `webhook_events`: RLS ligado, **sem policies**.
- `profiles`: `profiles_update_own` é removida na 0002; sobra `profiles_select_own`. Sem policy de INSERT (o trigger `handle_new_user` é `security definer`).
- **Pendente:** confirmar no banco real (`pg_policies`) e pelo teste no navegador (usuário).

## Revisão oficial (`quality_checklist`, app PromptForge)
O checklist é genérico de Checkout (Preferências); vários itens não se aplicam a assinaturas.
| Item | Situação |
|---|---|
| `external_reference` | Atende |
| `email` (payer) | Atende (`payer_email`) |
| `web_front_end_sdk` (MercadoPago.js V2) | Atende (`sdk.mercadopago.com/js/v2`) |
| `secure_form` (PCI) | Atende (Card Payment Brick; cartão nunca passa pelo servidor) |
| `ssl` / `tls` | Atende após o deploy (Vercel; Pilar 4) |
| `payment_get_or_search_api` | Atende (webhook reconsulta `GET /preapproval` e `/authorized_payments`) |
| `refunds_api` | Atende (`withdraw`) |
| `response_messages` | Atende (erros mostrados ao usuário) |
| `webhooks_ipn` | **Parcial**: o webhook é cadastrado no painel do app, não por `notification_url`. Cadastrar a URL de produção no Pilar 4 |
| `back_end_sdk` | **Não atende, por decisão**: `fetch` puro (registrado no plano). Aceitável |
| `statement_descriptor` | **Não enviado**: verificar na Task 18 se o `preapproval` aceita o campo |
| `logos` | **Parcial**: há texto "Mercado Pago", sem o logotipo oficial |
| `chargebacks_api` | Não implementado (boa prática; pós-MVP) |
| `payer_first_name/last_name`, itens, `binary_mode`, `capture`, `payer.id`, endereço, telefone | N/A para assinaturas |

## Achados
1. **Baixo — assinatura do webhook não cobre `type`.** O HMAC assina `id`, `request-id` e `ts`, não o campo `type` do corpo. Um replay dentro dos 5 min pode trocar o `type`. Impacto mínimo: o estado é sempre reconsultado na API do MP pelo `data.id`, nunca confiado ao corpo, e um `type` errado resulta em 404 → 500 → chave liberada. Sem ação.
2. **Baixo — logotipo oficial do Mercado Pago ausente** no paywall (boa prática).
3. **Baixo — `statement_descriptor`** não enviado (reduz contestações); depende de o `preapproval` aceitar o campo.
