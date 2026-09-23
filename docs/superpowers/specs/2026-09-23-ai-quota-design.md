# Pilar 3: Quotas de Uso de IA — Design

Status: Approved
Date: 2026-09-23
Depends on: Pilar 1 (fundação de dados/autenticação), Pilar 2 (billing — `requireActiveSubscription` já existe e decide quem pode chamar as rotas de IA)
Unblocks: nada diretamente — reduz risco de custo descontrolado com a API do Gemini

## Contexto

Hoje qualquer assinante com assinatura ativa pode chamar as 4 rotas que
usam o Gemini (`api/enhance.ts`, `api/autofill.ts`,
`api/analyze-references.ts`, `api/parse-product-url.ts`) sem nenhum
limite de uso. Os planos (`monthly`/`annual`, `api/_lib/plans.ts`) só
diferem no ciclo de cobrança — não há tiers nem cotas. Isso expõe o
produto a custo de API descontrolado (uso legítimo intenso ou abuso/script)
sem nenhuma trava.

Além disso, `api/_lib/gemini.ts` já documenta uma limitação conhecida: o
circuit breaker que troca de modelo preferido quando o Gemini responde
"alta demanda" (503/429) vive numa variável em memória do processo
(`lastGeminiHighDemandTime`). Em cold starts da Vercel essa memória não é
compartilhada entre invocações, então o circuit breaker perde efeito. O
próprio comentário no código já apontava que isso só seria resolvido de
verdade quando um pilar futuro introduzisse estado compartilhado — este é
esse pilar.

O spec original do Pilar 1 previa "quotas de IA / fila assíncrona" para
este pilar. Decisão tomada no brainstorming: o núcleo real do problema é
custo/abuso, não latência ou concorrência — as 4 rotas continuam
síncronas (request/response direto). Não há fila assíncrona neste MVP.

## Objetivo

Impor um limite diário de uso das rotas de IA por assinante ativo, e
migrar o circuit breaker de alta demanda do Gemini para o mesmo estado
compartilhado (Supabase Postgres), eliminando a perda de efeito em cold
starts.

## Não-objetivos (fora de escopo deste pilar)

- Fila assíncrona (job id + polling). As rotas continuam síncronas.
- Tiers diferentes por plano — `monthly` e `annual` têm a mesma cota.
  Diferenciar por plano fica para uma iteração futura, se o negócio
  decidir que faz sentido.
- Cota por rota individual — as 4 rotas de IA compartilham uma cota
  diária única.
- Degradar para um modelo mais barato ao estourar a cota — a rota
  simplesmente bloqueia com erro.
- Deploy de produção/CDN/domínio (Pilar 4, já concluído).
- Rate limiting genérico de infraestrutura, logging centralizado, LGPD
  (Pilar 5).

## Design

### Modelo de dados (Supabase Postgres, migração `0003_ai_quota.sql`)

```sql
create table public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  count integer not null default 0,
  primary key (user_id, usage_date)
);

alter table public.ai_usage_daily enable row level security;

create policy "ai_usage_select_own" on public.ai_usage_daily
  for select using (auth.uid() = user_id);

create table public.gemini_circuit_breaker (
  id boolean primary key default true,
  last_high_demand_at timestamptz,
  constraint gemini_circuit_breaker_single_row check (id)
);

insert into public.gemini_circuit_breaker (id, last_high_demand_at)
values (true, null);
```

`ai_usage_daily` não tem policy de insert/update para usuários — só o
service role (via `supabaseAdmin`, já usado pelo billing) escreve nela.
`usage_date` é calculado no servidor a partir de `America/Sao_Paulo`, não
UTC nem a data do cliente.

`gemini_circuit_breaker` é uma tabela "singleton": a constraint
`check (id)` (booleano que só aceita `true`) impede mais de uma linha.
Sem RLS de leitura para o cliente — só o backend acessa.

### Contador de uso — `api/_lib/quota/repo.ts`

Incremento atômico via upsert, evitando race condition entre chamadas
simultâneas do mesmo usuário:

```sql
insert into ai_usage_daily (user_id, usage_date, count)
values ($1, $2, 1)
on conflict (user_id, usage_date)
do update set count = ai_usage_daily.count + 1
returning count;
```

A contagem acontece **depois** de `requireActiveSubscription` confirmar
acesso e **antes** da chamada ao Gemini — toda tentativa que passa da
autenticação e da assinatura consome cota, mesmo que o Gemini falhe e a
rota caia no fallback local (`enhance.ts` já tem um fallback assim). Isso
evita a complexidade de decidir "isso conta como tentativa grátis" caso a
caso.

### Enforcement — `api/_lib/billing/requireQuota.ts`

Mesmo padrão de `requireActiveSubscription` (`api/_lib/billing/requireSubscription.ts`):
recebe `user` e `res`, escreve a resposta de erro ela mesma quando nega,
devolve `boolean`.

```ts
const DAILY_LIMIT = 50;

export async function requireQuota(
  user: AuthenticatedUser,
  res: VercelResponse
): Promise<boolean> {
  const count = await incrementAndGetUsage(user.id, todaySaoPaulo());
  if (count > DAILY_LIMIT) {
    res.status(429).json({
      error: 'Limite diário de gerações atingido. Volta à meia-noite.',
      code: 'quota_exceeded',
      resetAt: nextMidnightSaoPaulo().toISOString(),
    });
    return false;
  }
  return true;
}
```

Chamada nas 4 rotas de IA logo após `requireActiveSubscription`:

```ts
const user = await authenticate(req, res);
if (!user) return;
if (!(await requireActiveSubscription(user, res))) return;
if (!(await requireQuota(user, res))) return;
```

`todaySaoPaulo()` e `nextMidnightSaoPaulo()` vivem em
`api/_lib/quota/timezone.ts`, usando `Intl.DateTimeFormat` com
`timeZone: 'America/Sao_Paulo'` — sem dependência nova (`Intl` é nativo
do runtime Node da Vercel).

### Circuit breaker compartilhado

`api/_lib/gemini.ts` troca `let lastGeminiHighDemandTime` por leitura e
escrita em `gemini_circuit_breaker.last_high_demand_at` via
`supabaseAdmin`. `getPreferredModels()` passa a ser assíncrono (lê a
linha antes de decidir a ordem dos modelos); `generateWithFallback()`
grava a coluna quando detecta 503/429/"high demand", com `await` — sem
bloquear a resposta ao usuário por muito tempo (é um único `UPDATE`
por chave primária).

### Frontend

`src/lib/apiFetch.ts` já dispara `SUBSCRIPTION_REQUIRED_EVENT` em 403 com
`code: "subscription_required"`. Acrescenta o mesmo padrão para 429:

```ts
export const QUOTA_EXCEEDED_EVENT = 'billing:quota-exceeded';
// ...
if (res.status === 429) {
  res.clone().json().then((body) => {
    if (body?.code === 'quota_exceeded') {
      window.dispatchEvent(new CustomEvent(QUOTA_EXCEEDED_EVENT, { detail: body }));
    }
  }).catch(() => {});
}
```

Um listener novo (componente leve, não uma tela nova) mostra um toast
com `body.resetAt` formatado. Sem mudança nas telas existentes.

## Testes

Segue o padrão TDD já usado no Pilar 2 (Vitest, fakes/memory repos em
`api/_lib/*/testing/`):

- `requireQuota`: teste com repo em memória — permite até o limite,
  bloqueia acima, mensagem/código corretos, `resetAt` é a meia-noite
  seguinte em `America/Sao_Paulo` (não UTC).
- Cálculo de `todaySaoPaulo()`/`nextMidnightSaoPaulo()`: casos de borda
  perto da virada de dia (23h59 vs 00h01 em UTC-3), incluindo horário de
  verão inexistente no Brasil atualmente (mas testar que o cálculo não
  assume offset fixo, usa `Intl` com o nome da timezone).
- Incremento atômico: teste de concorrência (duas chamadas "simultâneas"
  no fake repo) não perde contagem.
- Circuit breaker: `getPreferredModels()` lê o estado do repo (fake),
  `generateWithFallback()` escreve quando recebe erro de alta demanda.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Race condition dá cota extra em chamadas simultâneas | Upsert atômico com `on conflict ... do update set count = count + 1`, não um "ler depois escrever" no código da aplicação. |
| Cálculo de dia local errado (usa UTC em vez de São Paulo) | `todaySaoPaulo()` centralizado num único helper testado, nunca `new Date().toISOString().slice(0,10)` espalhado pelas 4 rotas. |
| Nova tabela sem RLS de escrita vira alvo de escrita direta do cliente | Sem policy de insert/update para o client role — só o service role (`supabaseAdmin`) escreve, mesmo padrão já usado em `billing_events`. |
| `gemini_circuit_breaker` UPDATE adiciona latência perceptível na resposta ao usuário | É um único UPDATE por chave primária (tabela de 1 linha), desprezível comparado ao tempo de resposta do Gemini (segundos). |
