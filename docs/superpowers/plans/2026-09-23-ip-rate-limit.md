# Pilar 5 (parte 2): Rate Limit por IP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquear, por IP, mais de 100 requisições em 5 minutos nas 5 rotas mais expostas, **antes** de `authenticate()` rodar — fechando o único gap real de rate limiting que restou depois do levantamento do spec (billing e IA já protegidos pelos Pilares 2 e 3).

**Architecture:** Módulo novo `api/_lib/rateLimit/` espelhando exatamente a estrutura de `api/_lib/quota/` do Pilar 3 — tipos, lógica pura testável (`windowStart`, `decideIpRateLimit`), repo em memória (testes) e repo Supabase via RPC atômica (produção). Um wrapper fino `requireIpRateLimit` roda como a primeira linha de cada um dos 5 handlers, antes até de `authenticate()`. Limpeza de janelas antigas reaproveita o cron diário de billing já existente, sem cron novo.

**Tech Stack:** TypeScript, Vitest, Supabase Postgres (RPC atômica, mesmo padrão do Pilar 3).

**Spec:** `docs/superpowers/specs/2026-09-23-ip-rate-limit-design.md`

## Global Constraints

- Limite: **100 requisições / 5 minutos por IP**, compartilhado entre as 5 rotas (spec, "Limite").
- Roda **antes** de `authenticate()` — a primeira linha de cada handler, sem exceção (spec, "Objetivo").
- IP vem de `x-forwarded-for` (primeiro valor antes da vírgula); sem o header, cai em `'unknown'` (spec, "Identificação do IP").
- Janela fixa com upsert atômico via função Postgres — nunca um insert por tentativa (mesma razão do Pilar 3: sob flood de verdade, logar cada tentativa faria a própria defesa virar o vetor de custo).
- A função RPC precisa ter `EXECUTE` revogado explicitamente de `public`, `anon` **e** `authenticated` — achado da revisão final do Pilar 3: `revoke ... from public` sozinho não desfaz os default privileges que o Supabase concede a esses dois roles em funções novas do schema `public`.
- Falha ao consultar/escrever o rate limit falha **fechada** (bloqueia), mesmo padrão de `decideAccess`/`decideQuota` — não introduz um modo de falha novo/inconsistente.
- Import relativo dentro de `api/` sempre com extensão `.js` (ESM + `type:module` na Vercel).
- `requireIpRateLimit` nasce **injetável** (repo e `now` como parâmetros com default), não hardcoded — lição da revisão final do Pilar 3, onde isso teve que ser corrigido depois porque o wrapper original não era testável.

## Review Focus

- **Ordem errada — `requireIpRateLimit` chamado depois de `authenticate()`.** Anularia o propósito inteiro (o gate existe pra evitar a chamada de Auth, não pra rodar depois dela). Verificado na Task 4 ao revisar cada um dos 5 arquivos modificados — a linha do rate limit precisa vir antes da linha de `authenticate`.
- **Race condition no incremento por IP.** Mesma classe de risco do Pilar 3, mesma mitigação: upsert atômico via `INSERT ... ON CONFLICT ... DO UPDATE SET count = count + 1` na função Postgres, nunca "ler depois escrever" em JS. Testado na Task 3 com duas chamadas "simultâneas" ao repo em memória (com a mesma ressalva de sempre: o fake síncrono não prova atomicidade de verdade — quem prova é a função SQL, verificada ao vivo na Task 6).
- **Função RPC executável por `anon`/`authenticated`.** Achado real da revisão final do Pilar 3 nesse mesmo projeto — não é hipotético. A migração desta task já nasce com o `revoke` completo (ver Global Constraints), e a Task 6 confere isso ao vivo com `has_function_privilege`, do mesmo jeito que foi verificado pro Pilar 3.
- **`requireIpRateLimit` não testável por ter o repo hardcoded dentro da função.** Também um achado real do Pilar 3. Esta task já nasce com `repo`/`now` injetáveis com default, evitando ter que corrigir depois de uma revisão.
- **Cálculo de `windowStart` incorreto perto da borda de uma janela de 5 minutos**, fazendo duas requisições da mesma rajada caírem em baldes diferentes e escaparem do limite. Testado na Task 2 com instantes dos dois lados de uma borda de janela.

---

### Task 1: Migração do banco

**Files:**
- Create: `supabase/migrations/0004_ip_rate_limit.sql`

**Interfaces:**
- Produces: tabela `public.ip_rate_limit`, função `public.increment_ip_rate_limit(text, timestamptz) returns integer` — consumidos por `api/_lib/rateLimit/repo.ts` (Task 4).

- [ ] **Step 1: Escrever a migração**

```sql
-- Pilar 5 (parte 2): rate limit por IP, pré-autenticação

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

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0004_ip_rate_limit.sql
git commit -m "$(cat <<'EOF'
feat: add IP rate limit migration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

Aplicar a migração fica para a Task 6, depois que todo o código que a usa já estiver pronto e revisado.

---

### Task 2: Helpers puros — janela de tempo e extração de IP

**Files:**
- Create: `api/_lib/rateLimit/window.ts`
- Create: `api/_lib/rateLimit/getClientIp.ts`
- Test: `api/_lib/rateLimit/window.test.ts`
- Test: `api/_lib/rateLimit/getClientIp.test.ts`

**Interfaces:**
- Produces: `windowStart(now: Date): Date`, `getClientIp(req: VercelRequest): string` — consumidos por `decideIpRateLimit` (Task 3) e `requireIpRateLimit` (Task 4).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// api/_lib/rateLimit/window.test.ts
import { describe, it, expect } from 'vitest';
import { windowStart } from './window.js';

describe('windowStart', () => {
  it('arredonda pra baixo pro múltiplo de 5 minutos mais próximo', () => {
    expect(windowStart(new Date('2026-09-23T17:03:00.000Z')).toISOString()).toBe('2026-09-23T17:00:00.000Z');
    expect(windowStart(new Date('2026-09-23T17:07:59.999Z')).toISOString()).toBe('2026-09-23T17:05:00.000Z');
  });
  it('instantes 1s antes e depois de uma borda caem em janelas diferentes', () => {
    const before = windowStart(new Date('2026-09-23T17:04:59.000Z'));
    const after = windowStart(new Date('2026-09-23T17:05:01.000Z'));
    expect(before.toISOString()).toBe('2026-09-23T17:00:00.000Z');
    expect(after.toISOString()).toBe('2026-09-23T17:05:00.000Z');
    expect(before.getTime()).not.toBe(after.getTime());
  });
  it('exatamente na borda já conta como a nova janela', () => {
    expect(windowStart(new Date('2026-09-23T17:05:00.000Z')).toISOString()).toBe('2026-09-23T17:05:00.000Z');
  });
});
```

```ts
// api/_lib/rateLimit/getClientIp.test.ts
import { describe, it, expect } from 'vitest';
import { getClientIp } from './getClientIp.js';
import type { VercelRequest } from '@vercel/node';

function fakeReq(headers: Record<string, string | string[] | undefined>): VercelRequest {
  return { headers } as unknown as VercelRequest;
}

describe('getClientIp', () => {
  it('usa o primeiro IP de x-forwarded-for', () => {
    expect(getClientIp(fakeReq({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5');
  });
  it('funciona com um único IP, sem vírgula', () => {
    expect(getClientIp(fakeReq({ 'x-forwarded-for': '203.0.113.5' }))).toBe('203.0.113.5');
  });
  it('tira espaço em volta do IP', () => {
    expect(getClientIp(fakeReq({ 'x-forwarded-for': ' 203.0.113.5 , 10.0.0.1' }))).toBe('203.0.113.5');
  });
  it('trata array (múltiplos headers) pegando o primeiro', () => {
    expect(getClientIp(fakeReq({ 'x-forwarded-for': ['203.0.113.5', '198.51.100.1'] }))).toBe('203.0.113.5');
  });
  it('cai em "unknown" sem o header', () => {
    expect(getClientIp(fakeReq({}))).toBe('unknown');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- api/_lib/rateLimit/window.test.ts api/_lib/rateLimit/getClientIp.test.ts`
Expected: FAIL — `Cannot find module './window.js'` / `'./getClientIp.js'`

- [ ] **Step 3: Implementar `api/_lib/rateLimit/window.ts`**

```ts
const WINDOW_MS = 5 * 60 * 1000;

export function windowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
}
```

- [ ] **Step 4: Implementar `api/_lib/rateLimit/getClientIp.ts`**

```ts
import type { VercelRequest } from '@vercel/node';

export function getClientIp(req: VercelRequest): string {
  const header = req.headers['x-forwarded-for'];
  const raw = Array.isArray(header) ? header[0] : header;
  const first = raw?.split(',')[0]?.trim();
  return first || 'unknown';
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- api/_lib/rateLimit/window.test.ts api/_lib/rateLimit/getClientIp.test.ts`
Expected: PASS (3/3 + 5/5)

- [ ] **Step 6: Commit**

```bash
git add api/_lib/rateLimit/window.ts api/_lib/rateLimit/getClientIp.ts \
  api/_lib/rateLimit/window.test.ts api/_lib/rateLimit/getClientIp.test.ts
git commit -m "$(cat <<'EOF'
feat: add IP rate limit window and client-IP helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Domínio do rate limit — tipos, repo em memória, decisão

**Files:**
- Create: `api/_lib/rateLimit/types.ts`
- Create: `api/_lib/rateLimit/testing/memoryRepo.ts`
- Create: `api/_lib/rateLimit/decideIpRateLimit.ts`
- Test: `api/_lib/rateLimit/decideIpRateLimit.test.ts`

**Interfaces:**
- Consumes: `windowStart` (Task 2).
- Produces: `IpRateLimitRepo` (`incrementAndGetCount(ip: string, windowStartIso: string): Promise<number>`), `IP_RATE_LIMIT = 100`, `decideIpRateLimit(repo: IpRateLimitRepo, ip: string, now: Date): Promise<'ok' | 'limited' | 'error'>`, `createMemoryRepo(seed?: Record<string, number>): MemoryRepo` — consumidos por `requireIpRateLimit` e `repo.ts` (Task 4).

- [ ] **Step 1: Criar `api/_lib/rateLimit/types.ts`**

```ts
export const IP_RATE_LIMIT = 100;

// Persistência da contagem por IP. Implementações: repo.ts (Supabase) e
// testing/memoryRepo.ts.
export interface IpRateLimitRepo {
  // Incrementa atomicamente o contador do IP para `windowStartIso` (ISO,
  // já truncado pro início da janela de 5 min) e devolve o novo total.
  incrementAndGetCount(ip: string, windowStartIso: string): Promise<number>;
}
```

- [ ] **Step 2: Criar `api/_lib/rateLimit/testing/memoryRepo.ts`**

```ts
import type { IpRateLimitRepo } from '../types.js';

export interface MemoryRepo extends IpRateLimitRepo {
  counts: Map<string, number>;
}

// `seed` usa a chave `"${ip}|${windowStartIso}"`.
export function createMemoryRepo(seed: Record<string, number> = {}): MemoryRepo {
  const counts = new Map<string, number>(Object.entries(seed));

  return {
    counts,
    async incrementAndGetCount(ip, windowStartIso) {
      const key = `${ip}|${windowStartIso}`;
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
  };
}
```

- [ ] **Step 3: Escrever o teste que falha**

```ts
// api/_lib/rateLimit/decideIpRateLimit.test.ts
import { describe, it, expect } from 'vitest';
import { decideIpRateLimit } from './decideIpRateLimit.js';
import { createMemoryRepo } from './testing/memoryRepo.js';
import { IP_RATE_LIMIT } from './types.js';

const NOW = new Date('2026-09-23T17:03:00.000Z'); // janela 17:00:00.000Z

describe('decideIpRateLimit', () => {
  it('ok abaixo do limite', async () => {
    const repo = createMemoryRepo();
    expect(await decideIpRateLimit(repo, '203.0.113.5', NOW)).toBe('ok');
  });

  it('ok exatamente no limite', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T17:00:00.000Z': IP_RATE_LIMIT - 1 });
    expect(await decideIpRateLimit(repo, '203.0.113.5', NOW)).toBe('ok');
  });

  it('limited acima do limite', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T17:00:00.000Z': IP_RATE_LIMIT });
    expect(await decideIpRateLimit(repo, '203.0.113.5', NOW)).toBe('limited');
  });

  it('IPs diferentes têm baldes independentes', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T17:00:00.000Z': IP_RATE_LIMIT });
    expect(await decideIpRateLimit(repo, '198.51.100.1', NOW)).toBe('ok');
  });

  it('janelas diferentes não se misturam', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T16:55:00.000Z': IP_RATE_LIMIT });
    expect(await decideIpRateLimit(repo, '203.0.113.5', NOW)).toBe('ok');
  });

  it('duas chamadas "simultâneas" não perdem contagem', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T17:00:00.000Z': IP_RATE_LIMIT - 2 });
    const [a, b] = await Promise.all([
      decideIpRateLimit(repo, '203.0.113.5', NOW),
      decideIpRateLimit(repo, '203.0.113.5', NOW),
    ]);
    expect([a, b].sort()).toEqual(['ok', 'ok']);
    expect(repo.counts.get('203.0.113.5|2026-09-23T17:00:00.000Z')).toBe(IP_RATE_LIMIT);
  });

  it('falha fechada: erro no repo vira "error", nunca "ok"', async () => {
    const repo = createMemoryRepo();
    repo.incrementAndGetCount = async () => {
      throw new Error('db fora do ar');
    };
    expect(await decideIpRateLimit(repo, '203.0.113.5', NOW)).toBe('error');
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -- api/_lib/rateLimit/decideIpRateLimit.test.ts`
Expected: FAIL — `Cannot find module './decideIpRateLimit.js'`

- [ ] **Step 5: Implementar `api/_lib/rateLimit/decideIpRateLimit.ts`**

```ts
import { windowStart } from './window.js';
import { IP_RATE_LIMIT, type IpRateLimitRepo } from './types.js';

// Falha fechada: qualquer erro ao incrementar o contador nunca libera a requisição.
export async function decideIpRateLimit(
  repo: IpRateLimitRepo,
  ip: string,
  now: Date
): Promise<'ok' | 'limited' | 'error'> {
  try {
    const bucket = windowStart(now).toISOString();
    const count = await repo.incrementAndGetCount(ip, bucket);
    return count <= IP_RATE_LIMIT ? 'ok' : 'limited';
  } catch {
    return 'error';
  }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -- api/_lib/rateLimit/decideIpRateLimit.test.ts`
Expected: PASS (7/7)

- [ ] **Step 7: Commit**

```bash
git add api/_lib/rateLimit/types.ts api/_lib/rateLimit/testing/memoryRepo.ts \
  api/_lib/rateLimit/decideIpRateLimit.ts api/_lib/rateLimit/decideIpRateLimit.test.ts
git commit -m "$(cat <<'EOF'
feat: add IP rate limit domain logic (decideIpRateLimit)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Repo Supabase, enforcement HTTP (injetável e testado), wiring nas 5 rotas

**Files:**
- Create: `api/_lib/rateLimit/repo.ts`
- Create: `api/_lib/rateLimit/requireIpRateLimit.ts`
- Test: `api/_lib/rateLimit/requireIpRateLimit.test.ts`
- Modify: `api/enhance.ts` (import + primeira linha do handler, antes de `authenticate`)
- Modify: `api/autofill.ts` (idem)
- Modify: `api/analyze-references.ts` (idem)
- Modify: `api/parse-product-url.ts` (idem)
- Modify: `api/billing/[action].ts` (idem)

**Interfaces:**
- Consumes: `IpRateLimitRepo`, `decideIpRateLimit` (Task 3); `getClientIp` (Task 2); `supabaseAdmin` (`api/_lib/supabaseAdmin.ts`, já existe).
- Produces: `createSupabaseRepo(client?: SupabaseClient): IpRateLimitRepo`, `requireIpRateLimit(req: VercelRequest, res: VercelResponse, repo?: IpRateLimitRepo, now?: Date): Promise<boolean>`.

`repo.ts` (Supabase) não tem teste direto — mesmo padrão não-testado de `usageRepo.ts`/`circuitBreakerRepo.ts` do Pilar 3, é só uma chamada RPC, verificada ao vivo na Task 6. `requireIpRateLimit` **tem** teste, já nascendo injetável (lição do Pilar 3).

- [ ] **Step 1: Implementar `api/_lib/rateLimit/repo.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import type { IpRateLimitRepo } from './types.js';

export function createSupabaseRepo(client: SupabaseClient = supabaseAdmin): IpRateLimitRepo {
  return {
    async incrementAndGetCount(ip, windowStartIso) {
      const { data, error } = await client.rpc('increment_ip_rate_limit', {
        p_ip: ip,
        p_window_start: windowStartIso,
      });
      if (error) throw error;
      return data as number;
    },
  };
}
```

- [ ] **Step 2: Escrever o teste que falha**

```ts
// api/_lib/rateLimit/requireIpRateLimit.test.ts
import { describe, it, expect, vi } from 'vitest';
import { requireIpRateLimit } from './requireIpRateLimit.js';
import { createMemoryRepo } from './testing/memoryRepo.js';
import { IP_RATE_LIMIT } from './types.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const NOW = new Date('2026-09-23T17:03:00.000Z');

function fakeReq(ip: string): VercelRequest {
  return { headers: { 'x-forwarded-for': ip } } as unknown as VercelRequest;
}

function fakeRes(): VercelResponse {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireIpRateLimit', () => {
  it('permite e não escreve resposta quando abaixo do limite', async () => {
    const repo = createMemoryRepo();
    const res = fakeRes();

    const allowed = await requireIpRateLimit(fakeReq('203.0.113.5'), res, repo, NOW);

    expect(allowed).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('bloqueia com 429 e code quando acima do limite', async () => {
    const repo = createMemoryRepo({ '203.0.113.5|2026-09-23T17:00:00.000Z': IP_RATE_LIMIT });
    const res = fakeRes();

    const allowed = await requireIpRateLimit(fakeReq('203.0.113.5'), res, repo, NOW);

    expect(allowed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
    const body = (res.json as any).mock.calls[0][0];
    expect(body.code).toBe('rate_limited');
  });

  it('responde 429 também quando o repo falha (falha fechada)', async () => {
    const repo = createMemoryRepo();
    repo.incrementAndGetCount = async () => {
      throw new Error('db fora do ar');
    };
    const res = fakeRes();

    const allowed = await requireIpRateLimit(fakeReq('203.0.113.5'), res, repo, NOW);

    expect(allowed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- api/_lib/rateLimit/requireIpRateLimit.test.ts`
Expected: FAIL — `Cannot find module './requireIpRateLimit.js'`

- [ ] **Step 4: Implementar `api/_lib/rateLimit/requireIpRateLimit.ts`**

Nota de design: ao contrário de `requireQuota`/`requireActiveSubscription` (que distinguem "estourou" de "erro no banco" com 429 vs 503), aqui os dois casos respondem **429** — do ponto de vista de quem chama, "limite atingido" e "não deu pra verificar o limite, então bloqueei por segurança" são indistinguíveis e não precisam ser: isso roda antes da autenticação, não há uma UI dedicada esperando um 503 aqui.

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { decideIpRateLimit } from './decideIpRateLimit.js';
import { createSupabaseRepo } from './repo.js';
import { getClientIp } from './getClientIp.js';
import type { IpRateLimitRepo } from './types.js';

// Chamar como a PRIMEIRA linha do handler, antes de `authenticate`:
// `if (!(await requireIpRateLimit(req, res))) return;`
export async function requireIpRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  repo: IpRateLimitRepo = createSupabaseRepo(),
  now: Date = new Date()
): Promise<boolean> {
  const ip = getClientIp(req);
  const decision = await decideIpRateLimit(repo, ip, now);
  if (decision === 'ok') return true;
  res.status(429).json({
    error: 'Muitas requisições. Tente novamente em alguns minutos.',
    code: 'rate_limited',
  });
  return false;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- api/_lib/rateLimit/requireIpRateLimit.test.ts`
Expected: PASS (3/3)

- [ ] **Step 6: Ligar `requireIpRateLimit` em `api/enhance.ts`**

Import junto aos outros:
```ts
import { requireIpRateLimit } from './_lib/rateLimit/requireIpRateLimit.js';
```

Estado atual (primeira linha do corpo do handler):
```ts
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
```

Novo — o rate limit vem **antes** de tudo, inclusive antes da checagem de método (uma requisição malformada/flood ainda deve ser barrada o mais cedo possível):
```ts
  if (!(await requireIpRateLimit(req, res))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
```

- [ ] **Step 7: Ligar `requireIpRateLimit` em `api/autofill.ts`, `api/analyze-references.ts`, `api/parse-product-url.ts` e `api/billing/[action].ts`**

Mesma mudança do Step 6 em cada um dos 4 arquivos restantes — import mais a chamada como primeiríssima linha do handler, antes de qualquer outra checagem (incluindo o `res.setHeader` de `billing/[action].ts`, que pode continuar depois, sem problema — só a ordem em relação a `authenticate` importa de verdade, mas colocar o rate limit primeiro em todos os 5 mantém o padrão idêntico e fácil de auditar).

- [ ] **Step 8: Rodar a suíte inteira e o typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS — todos os testes existentes + os novos desta e das Tasks 2-3, typecheck limpo.

- [ ] **Step 9: Commit**

```bash
git add api/_lib/rateLimit/repo.ts api/_lib/rateLimit/requireIpRateLimit.ts \
  api/_lib/rateLimit/requireIpRateLimit.test.ts \
  api/enhance.ts api/autofill.ts api/analyze-references.ts api/parse-product-url.ts \
  api/billing/\[action\].ts
git commit -m "$(cat <<'EOF'
feat: enforce IP rate limit before authentication on the 5 exposed routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Limpeza de janelas antigas no cron diário

**Files:**
- Create: `api/_lib/rateLimit/cleanup.ts`
- Modify: `api/cron/billing.ts`

**Interfaces:**
- Consumes: `supabaseAdmin`.
- Produces: `cleanupOldWindows(client?: SupabaseClient): Promise<void>`.

Sem teste automatizado — mesmo padrão não-testado dos outros repos Supabase deste plano; é um `DELETE` de manutenção, verificado ao vivo na Task 6.

- [ ] **Step 1: Implementar `api/_lib/rateLimit/cleanup.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';

// Chamado pelo cron diário de billing. Falha aqui nunca deve derrubar o cron inteiro —
// é limpeza, não a responsabilidade principal do job.
export async function cleanupOldWindows(client: SupabaseClient = supabaseAdmin): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error } = await client.from('ip_rate_limit').delete().lt('window_start', cutoff);
  if (error) throw error;
}
```

- [ ] **Step 2: Chamar a limpeza em `api/cron/billing.ts`**

Import junto aos outros:
```ts
import { cleanupOldWindows } from '../_lib/rateLimit/cleanup.js';
```

Estado atual:
```ts
  try {
    const summary = await runBillingCron(buildDeps());
    return res.status(200).json({ ok: true, ...summary });
  } catch (error) {
```

Novo — a limpeza roda depois do cron de billing, envolta no próprio try/catch pra nunca fazer o job inteiro falhar por causa dela:
```ts
  try {
    const summary = await runBillingCron(buildDeps());
    await cleanupOldWindows().catch((err) => {
      console.warn('Aviso: falha ao limpar ip_rate_limit:', err);
    });
    return res.status(200).json({ ok: true, ...summary });
  } catch (error) {
```

- [ ] **Step 3: Rodar a suíte inteira e o typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/_lib/rateLimit/cleanup.ts api/cron/billing.ts
git commit -m "$(cat <<'EOF'
feat: clean up old IP rate limit windows in the daily cron

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Aplicar a migração e verificar manualmente

**Files:** nenhum arquivo do repositório — aplicação da migração e verificação ao vivo.

**Interfaces:** nenhuma — task de implantação/verificação, não produz interface para outras tasks.

- [ ] **Step 1: Aplicar a migração no Supabase**

Via MCP do Supabase (`apply_migration`) no projeto `promptforge` (ref `rgmavolhyrhmbhqnuvcf`) — nunca no `mushubic`.

- [ ] **Step 2: Conferir policies e privilégio crítico da função**

```sql
select tablename, policyname, cmd from pg_policies where tablename = 'ip_rate_limit';
```
Esperado: nenhuma linha.

```sql
select has_function_privilege('anon', 'public.increment_ip_rate_limit(text,timestamptz)', 'execute') as anon_pode,
       has_function_privilege('authenticated', 'public.increment_ip_rate_limit(text,timestamptz)', 'execute') as authenticated_pode,
       has_function_privilege('service_role', 'public.increment_ip_rate_limit(text,timestamptz)', 'execute') as service_role_pode;
```
Esperado: `anon_pode = false`, `authenticated_pode = false`, `service_role_pode = true`. Se qualquer um dos dois primeiros vier `true`, **não seguir**.

- [ ] **Step 3: Testar o incremento atômico direto no SQL Editor**

```sql
select increment_ip_rate_limit('203.0.113.99', date_trunc('hour', now()));
select increment_ip_rate_limit('203.0.113.99', date_trunc('hour', now()));
select count from ip_rate_limit where ip = '203.0.113.99';
```
Esperado: a segunda chamada devolve `2`. Limpar depois:
```sql
delete from ip_rate_limit where ip = '203.0.113.99';
```

- [ ] **Step 4: Deploy via o fluxo protegido**

Seguir `docs/superpowers/runbooks/2026-09-22-deploy-workflow.md`: branch → push → PR → check da Vercel verde → merge.

- [ ] **Step 5: Verificação ao vivo do bloqueio (sem precisar de sessão nenhuma)**

Ao contrário da cota de IA do Pilar 3, este gate roda **antes** da autenticação — dá pra testar com requisições totalmente anônimas, sem precisar de usuário ativo nenhum:

```bash
for i in $(seq 1 101); do
  curl -s -o /dev/null -w "%{http_code} " -X POST https://<domínio de produção>/api/analyze-references
done
echo
```
Esperado: as primeiras ~100 respostas não são `429` (provavelmente `401`, já que não há token — o que importa é não ser `429`); a partir da 101ª, `429`.

- [ ] **Step 6: Limpar os dados de teste**

```sql
delete from ip_rate_limit where ip = '<IP de onde o Step 5 rodou — conferir via select ip, count from ip_rate_limit order by count desc limit 5>';
```
