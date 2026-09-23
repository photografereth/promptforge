# Pilar 5 (parte 2): Rate Limit por IP Pré-Autenticação — Design

Status: Approved
Date: 2026-09-23
Depends on: Pilar 1 (auth/dados), Pilar 3 (padrão de contador atômico via RPC, reaproveitado aqui)
Unblocks: nada diretamente — reduz custo de invocação/Auth sob flood

## Contexto

O Pilar 5 do roadmap original ("Rate limiting, logging centralizado,
Termos/LGPD") embala três subsistemas independentes; Termos/Privacidade
já foi entregue em spec separado. Este spec cobre o segundo: rate
limiting.

Levantamento feito antes de escrever este spec, pra não duplicar o que
já existe:
- **Billing (mutações)**: já protegido desde o Pilar 2. `guard()`
  (`api/_lib/billing/service/context.ts`) aplica rate limit por
  usuário+ação em todas as rotas que mutam estado — `subscribe` (5/10min),
  `change-plan` (10/10min), `update-card` (10/10min), `cancel`/`resume`
  (10/10min cada), `withdraw` (3/hora). Implementado via contagem de
  eventos na trilha de auditoria (`billing_events`), adequado pra
  frequência baixa de mutações billing.
- **IA**: já tem cota diária compartilhada (Pilar 3, 50/dia, reset à
  meia-noite em São Paulo).
- **Webhook do Mercado Pago**: rejeita na hora por assinatura HMAC
  inválida (`verifyMpSignature`), antes de qualquer trabalho real.
- **Cron**: exige `CRON_SECRET` via header `Authorization`.

O que **não tem nenhuma proteção**: qualquer requisição — autenticada ou
não — em qualquer rota ainda força uma chamada real ao Supabase Auth
(`authenticate()`, via `supabaseAnon.auth.getUser(token)`) antes de ser
rejeitada por token inválido/ausente. Não existe limite por IP em lugar
nenhum. Um script martelando `/api/enhance` (ou qualquer rota) com
tokens inválidos custa invocação de function na Vercel e chamada de API
no Supabase indefinidamente, sem trava nenhuma.

## Objetivo

Impor um limite de requisições por IP, aplicado **antes** de
`authenticate()` rodar, nas rotas mais expostas — barato o suficiente
pra rejeitar flood sem custar uma chamada de Auth por tentativa.

## Não-objetivos (fora de escopo desta parte do Pilar 5)

- Rate limit de billing e de IA — já existem, não mexidos aqui.
- Proteção a nível de edge/CDN/WAF (recurso pago da Vercel, fora do
  plano Hobby) — este spec cobre só a camada de aplicação.
- Rate limit em `/api/health` — alvo de baixo valor, sem dado sensível
  nem custo de Auth associado.
- Bloqueio permanente de IP (banlist) — só janela temporária.
- Diferenciação por rota — um limite único, compartilhado entre as 5
  rotas protegidas, mesmo espírito da cota de IA do Pilar 3 (cota única
  em vez de uma por rota).

## Design

### Modelo de dados (Supabase Postgres, migração `0004_ip_rate_limit.sql`)

Janela fixa (não sliding window via auditoria, ao contrário do
`guard()`) — sob flood de verdade, uma tabela que cresce uma linha por
tentativa vira ela mesma um vetor de custo. Janela fixa com upsert
atômico mantém no máximo 1 linha por IP por janela:

```sql
create table public.ip_rate_limit (
  ip text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (ip, window_start)
);

alter table public.ip_rate_limit enable row level security;
-- Sem policies: só o service role acessa.

create or replace function public.increment_ip_rate_limit(p_ip text, p_window_start timestamptz)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.ip_rate_limit (ip, window_start, count)
  values (p_ip, p_window_start, 1)
  on conflict (ip, window_start)
  do update set count = ip_rate_limit.count + 1
  returning count;
$$;

revoke all on function public.increment_ip_rate_limit(text, timestamptz) from public, anon, authenticated;
grant execute on function public.increment_ip_rate_limit(text, timestamptz) to service_role;
```

`window_start` é o início da janela de 5 minutos corrente
(`floor(epoch / 300) * 300`), calculado no servidor. Linhas antigas são
limpas pelo cron diário já existente (`api/cron/billing.ts`) — acrescenta
um `delete from ip_rate_limit where window_start < now() - interval '1 day'`,
não um cron novo.

### Limite

100 requisições / 5 minutos por IP, compartilhado entre as 5 rotas
protegidas. Constante `IP_RATE_LIMIT = 100`, janela `5 * 60 * 1000` ms.

### Identificação do IP

Vercel injeta `x-forwarded-for` (pode ter múltiplos IPs separados por
vírgula se houver proxies encadeados — usar o primeiro). Sem esse
header (impossível em produção na Vercel, mas defensivo em dev local),
cair em um valor fixo `'unknown'` — nesse caso todo tráfego sem o header
compartilha o mesmo balde, aceitável porque só acontece fora de
produção.

### Enforcement — `api/_lib/rateLimit/requireIpRateLimit.ts`

Mesmo padrão de `requireQuota`/`requireActiveSubscription`: recebe
`req`/`res`, escreve a resposta de erro ela mesma, devolve `boolean`.
Roda como a **primeira linha** de cada handler protegido — antes de
`authenticate(req, res)`:

```ts
if (!(await requireIpRateLimit(req, res))) return;
const user = await authenticate(req, res);
```

Aplicado em `api/enhance.ts`, `api/autofill.ts`,
`api/analyze-references.ts`, `api/parse-product-url.ts` e
`api/billing/[action].ts` (as 5 rotas expostas identificadas no
levantamento). Resposta ao estourar: `429` com corpo
`{ error: '...', code: 'rate_limited' }` — sem `resetAt` (ao contrário
da cota de IA, não há necessidade de o cliente saber exatamente quando
tentar de novo; isso é proteção contra script, não uma UX a comunicar).

### Frontend

Nenhuma mudança — assim como o 429 de cota (Pilar 3), o padrão
`!response.ok → throw new Error(body.error) → catch → mostra erro na
tela`, já presente nos componentes que chamam essas 5 rotas, cobre o
caso sem código novo. Na prática esse 429 quase nunca chega a um
usuário legítimo (100 requisições/5min é muito acima de uso humano
normal).

## Testes

Mesmo padrão TDD dos Pilares 2/3 (Vitest, fakes/memory repos):

- `decideIpRateLimit`: pure function, testada com repo em memória —
  permite até o limite, bloqueia acima, janelas diferentes não se
  misturam, IPs diferentes têm baldes independentes, incremento
  concorrente não perde contagem (mesma ressalva do Pilar 3: o fake em
  memória síncrono não prova atomicidade de verdade — a garantia real é
  a função SQL, verificada ao vivo depois de aplicar a migração).
- Cálculo de `window_start`: instantes em bordas de janela (ex.: 1s
  antes/depois de um múltiplo de 5 min) caem em janelas diferentes.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| IP compartilhado (NAT, rede corporativa) com vários usuários legítimos simultâneos esbarra no limite | 100/5min é generoso o suficiente pra uso humano normal mesmo com múltiplos usuários atrás do mesmo IP; ajustável depois com dado real de produção. |
| Tabela de rate limit cresce indefinidamente sob flood sustentado | Janela fixa (upsert, não insert por tentativa) limita a 1 linha por IP por janela de 5 min; cron diário já existente limpa linhas com mais de 1 dia. |
| `x-forwarded-for` ausente/falsificável | Na Vercel em produção o header é injetado pela plataforma, não vem do cliente diretamente — confiável nesse ambiente. Fallback pra `'unknown'` só é alcançável fora de produção. |
| Checagem de rate limit em si vira um novo alvo de custo (uma chamada Supabase por tentativa, mesmo maliciosa) | Não elimina custo sob ataque — nenhuma solução em camada de aplicação elimina —, mas é ordens de magnitude mais barata que a chamada de Auth que hoje roda sem nenhuma trava antes dela. Proteção de borda (WAF/edge) fica fora de escopo (ver Não-objetivos). |
