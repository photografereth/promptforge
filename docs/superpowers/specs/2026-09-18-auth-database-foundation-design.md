# Pilar 1: Fundação de Dados e Autenticação — Design

Status: Approved
Date: 2026-09-18
Depends on: none (this is the foundation for all other pillars)
Unblocks: Pilar 2 (Mercado Pago billing), Pilar 3 (AI quotas/queue)

## Contexto

O projeto ("Flow Prompt Forge") foi originalmente gerado pelo Gemini Build e
hoje não tem nenhuma noção real de usuário:

- `src/App.tsx` guarda um flag `isLicensed` no `localStorage`
  (`flow_prompt_forge_licensed`), setado para `"true"` quando o
  `CheckoutModal` "simula" um pagamento (`setTimeout`, sem gateway real).
- Preferências (`STORAGE_KEY_PREFS`) e histórico de prompts
  (`STORAGE_KEY_HISTORY`) também vivem só no `localStorage` do navegador.
- O backend é um único `server.ts` (Express) com rotas `/api/health`,
  `/api/autofill`, `/api/enhance`, `/api/analyze-references`,
  `/api/parse-product-url` — todas públicas, sem autenticação, chamando o
  Gemini diretamente.
- Não existe banco de dados persistente.

Um relatório anterior (gerado por outra ferramenta) recomendou GCP completo
(Cloud SQL, Firebase Auth, Cloud Run, etc.) para chegar a um MVP comercial
com 10.000 assinantes. O usuário decidiu usar o stack que já opera hoje —
**Vercel** (hospedagem) + **Supabase** (Postgres + Auth) — em vez de GCP.
Este spec cobre apenas o primeiro pilar dessa jornada: dar ao produto uma
base real de dados e autenticação sobre a qual cobrança (Pilar 2) e quotas
de IA (Pilar 3) serão construídas depois.

## Objetivo

Substituir o gate de "licença" falso por contas de usuário reais (Supabase
Auth) e um registro persistente de assinatura por usuário (Supabase
Postgres), migrando o backend de um processo Express de longa duração para
Vercel Serverless Functions — sem, ainda, processar pagamentos reais nem
aplicar quotas (isso fica para os pilares seguintes).

## Não-objetivos (fora de escopo deste pilar)

- Cobrança real via Mercado Pago (Pilar 2).
- Quotas de uso / fila assíncrona (Pilar 3).
- Deploy de produção formal, CDN, domínio (Pilar 4).
- Rate limiting, logging centralizado, Termos/LGPD (Pilar 5).
- Migrar histórico de prompts e produtos favoritados do `localStorage`
  para o banco — permanece client-side por enquanto.

## Arquitetura

### Modelo de dados (Supabase Postgres)

`auth.users` é gerenciada pelo Supabase Auth (não criamos essa tabela).

Nova tabela `public.profiles`, 1:1 com `auth.users`:

```sql
create type subscription_status as enum ('trial', 'active', 'past_due', 'canceled');
create type subscription_plan as enum ('monthly', 'annual');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  subscription_status subscription_status not null default 'trial',
  plan subscription_plan,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
```

Um trigger em `auth.users` (`after insert`) cria a linha correspondente em
`public.profiles` automaticamente, copiando `email` e inicializando
`subscription_status = 'trial'`.

Não há política de `insert`/`delete` para o usuário comum — a criação do
perfil é feita pelo trigger (`security definer`), e escrita administrativa
(usada pelo webhook do Mercado Pago no Pilar 2) usa a **service role key**,
que ignora RLS.

### Autenticação

- Frontend usa `@supabase/supabase-js` diretamente para signup/login
  (Google OAuth + e-mail/senha) e para observar o estado de sessão
  (`supabase.auth.onAuthStateChange`). Não criamos endpoints de auth
  próprios — o Supabase já expõe isso.
- Toda rota de API que precisa de usuário autenticado recebe
  `Authorization: Bearer <access_token>` e valida chamando
  `supabase.auth.getUser(token)` no servidor (usando a `anon key`, que é
  suficiente para validar o token — não precisa da service role para
  isso).
- Rotas sem usuário autenticado (token ausente ou inválido) respondem
  `401 Unauthorized` com um corpo JSON `{ error: string }` consistente.

### Backend: de Express (`server.ts`) para Vercel Serverless Functions

`server.ts` é desmembrado em funções individuais sob `/api`:

- `api/health.ts`
- `api/autofill.ts`
- `api/enhance.ts`
- `api/analyze-references.ts`
- `api/parse-product-url.ts`

Código compartilhado vai para `api/_lib/`:

- `api/_lib/gemini.ts` — inicialização do client Gemini e a lógica de
  fallback/roteamento de modelo já existente em `server.ts` (circuit
  breaker de alta demanda, `getPreferredModels`, `generateWithFallback`),
  movida sem alterar o comportamento.
- `api/_lib/auth.ts` — `requireAuth(req)` que extrai o Bearer token, chama
  `supabase.auth.getUser`, e retorna o usuário autenticado ou lança um
  erro 401 que o handler traduz em resposta HTTP.
- `api/_lib/supabaseAdmin.ts` — client Supabase com a service role key,
  para uso exclusivamente server-side (nunca importado por código que
  roda no browser).
- `api/_lib/supabaseAnon.ts` — client Supabase com a anon key, usado para
  validar tokens de usuário nas funções de API.

Todas as rotas de geração (`autofill`, `enhance`, `analyze-references`,
`parse-product-url`) passam a chamar `requireAuth` antes de processar a
requisição. `health` continua pública.

`server.ts` é removido depois da migração (não fica como código morto).
Dev local passa a usar `vercel dev`, que serve `/api/*` e o app Vite juntos
num único processo, substituindo `tsx server.ts`. Scripts do
`package.json` são atualizados de acordo (`dev`, `build`, `start` deixam
de depender do Express; `esbuild`/bundling de `server.ts` sai do script
`build`).

### Frontend

- Fluxo novo: landing page → modal de login/signup (Supabase) → app. O
  `isLicensed` baseado em `localStorage` é substituído pela sessão real do
  Supabase.
- `CheckoutModal` continua existindo visualmente (seleção de plano), mas
  seu "confirmar" passa a criar a conta de verdade via Supabase Auth em
  vez de simular pagamento com `setTimeout`. O usuário entra com
  `subscription_status = 'trial'` (default do banco) — sem cobrança real
  ainda. Isso prepara o terreno para o Pilar 2 plugar o Mercado Pago sem
  refazer a UI de checkout.
- Preferências e histórico continuam em `localStorage` (fora de escopo,
  ver acima).

### Configuração / segredos

Novas variáveis de ambiente:

| Variável | Onde é usada | Público? |
|---|---|---|
| `SUPABASE_URL` | frontend + backend | sim |
| `SUPABASE_ANON_KEY` | frontend + backend (validação de token) | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | apenas `api/_lib/supabaseAdmin.ts` | **não** — nunca no bundle do cliente |
| `GEMINI_API_KEY` | `api/_lib/gemini.ts` | não (já existente) |

Em produção, essas variáveis vivem nas Environment Variables do projeto na
Vercel. Em desenvolvimento, num `.env.local` (já coberto pelo
`.gitignore` existente, que ignora `.env*` exceto `.env.example`).
`.env.example` é atualizado para documentar as novas variáveis.

## Tratamento de erros

- Token ausente/expirado/inválido em rota protegida → `401` com
  `{ error: "Não autenticado." }`, sem vazar detalhes do erro do Supabase.
- Falha ao criar perfil (trigger) → não é responsabilidade do código de
  aplicação; é garantida pelo banco (trigger roda na mesma transação do
  insert em `auth.users`).
- Erros do Gemini continuam tratados como hoje (fallback de modelo,
  mensagens de erro existentes em `server.ts`), apenas realocados para
  `api/_lib/gemini.ts` sem mudança de comportamento.

## Testes / Validação

Não há framework de testes automatizados no projeto hoje e este spec não
introduz um (fora de escopo). Validação será manual via `vercel dev`:

1. Signup com e-mail/senha cria usuário em `auth.users` e linha
   correspondente em `public.profiles` com `subscription_status = 'trial'`.
2. Login com Google funciona e popula a sessão no frontend.
3. Chamar uma rota protegida (ex: `/api/enhance`) sem `Authorization`
   header retorna `401`.
4. Chamar a mesma rota com um token válido retorna o comportamento atual
   (sucesso ou erro do Gemini, conforme já existia).
5. `/api/health` continua respondendo sem autenticação.

## Riscos / decisões em aberto para os próximos pilares

- `subscription_status = 'trial'` por padrão dá acesso completo ao app
  sem cobrança real — isso é intencional para este pilar (paywall de
  verdade é responsabilidade do Pilar 2) mas significa que, até lá, não
  há enforcement de pagamento em produção. Não fazer deploy público antes
  do Pilar 2 estar pronto, ou aceitar que o "trial" é o comportamento
  esperado nesse meio-tempo.
- A migração de `server.ts` para `/api/*` functions é um refactor
  mecânico grande; o plano de implementação deve preservar o
  comportamento exato de `generateWithFallback` e do circuit breaker de
  alta demanda (`lastGeminiHighDemandTime`), já que hoje ele é módulo-nível
  e cada invocação serverless é um processo potencialmente novo — isso
  precisa ser levado em conta ao portar (o circuit breaker por memória de
  processo perde efeito entre invocações frias na Vercel; documentar essa
  limitação conhecida em vez de tentar resolvê-la aqui, já que resolver de
  verdade — ex. via Supabase ou Redis — é escopo do Pilar 3, que já vai
  mexer em quota/estado compartilhado).
