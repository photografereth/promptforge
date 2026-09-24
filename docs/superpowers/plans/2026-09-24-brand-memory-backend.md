# Memória da Marca (Backend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o backend da memória da marca: tabelas, bucket privado, regras de negócio testadas e a rota `/api/memory/[action]`, no ar sem mudança visível para o usuário.

**Architecture:** Módulo novo `api/_lib/memory/` no mesmo padrão de `api/_lib/billing/`: regras puras em `service/*.ts` recebendo `(deps, user, input)` e devolvendo `Result` (`ok`/`fail` de `api/_lib/billing/service/context.ts`), com banco e Storage atrás de interfaces injetáveis (`MemoryRepo`, `StoragePort`) e versões em memória para o Vitest. Uma rota só, com roteador em tabela igual a `api/_lib/billing/router.ts`. Tabelas com RLS ligado e sem policies; toda consulta do repositório Supabase filtra por `user_id`.

**Tech Stack:** TypeScript, Vitest, Supabase Postgres + Storage (`@supabase/supabase-js` 2.116), Vercel Serverless Functions.

**Spec:** `docs/superpowers/specs/2026-09-24-brand-memory-design.md`

## Global Constraints

- Todo import relativo dentro de `api/` termina em `.js` (ESM + `type: module`; sem isso a função quebra em produção).
- Todo método de `MemoryRepo` recebe `userId` como primeiro argumento, e toda consulta Supabase filtra por `user_id`. A chave de serviço ignora o RLS: o isolamento entre usuários depende só disso.
- Recurso de outro usuário, ou id que não é UUID, responde **404** — nunca 403 e nunca 500.
- Limites só em `api/_lib/memory/limits.ts`: `brands: 3`, `pinnedAssetsPerBrand: 30`, `recentAssetsPerBrand: 20`, `photosPerAsset: 4`; nome até 80 caracteres; `data` até 20 KB; `state` até 50 KB; texto de prompt até 20 KB; foto até 2 MB, `image/jpeg`/`image/png`/`image/webp`.
- Limite estourado: **409** com `{ code: 'limit_reached', limit: 'brands' | 'pinnedAssets' | 'photos' }`.
- Mensagens de erro ao usuário em português. Logs só com `errorName(err)` e ids — nunca nome de produto, ficha, texto de prompt ou dado da marca.
- Toda função SQL nova tem `revoke all ... from public, anon, authenticated` explícito (lição do Pilar 3: revogar só de `public` não basta no Supabase).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Acesso a recurso de outro usuário pelo id.** Um usuário B que conhece o id de marca, ativo ou prompt do usuário A não pode ler, alterar, apagar, subir foto ou confirmar foto. Esperado: 404 em toda ação, dados de A intactos. Coberto pela matriz de isolamento da Task 7.
- **Caminho de foto vindo do cliente** em `photo-confirm`/`photo-remove`: `../`, segmento extra, prefixo de outro usuário ou de outro ativo, extensão diferente. Esperado: 400 (confirm) ou 404 (remove), nada registrado. Coberto na Task 2 (`isAssetPhotoPath`) e Task 5.
- **Busca e cursor montando filtro do PostgREST** (`.or(...)`): vírgula, parênteses, aspas, `*`, `%` na busca; cursor adulterado. Esperado: busca higienizada para letras, números e espaços; cursor inválido → 400. Coberto na Task 2 (`cleanSearch`) e Task 6 (cursor).
- **Poda de recentes apagando trabalho do usuário sem querer**: ao desafixar com a lista de recentes cheia, ou duas requisições simultâneas com o mesmo nome. Esperado: o item desafixado vira o recente mais novo e não é apagado; a corrida atualiza o item existente em vez de dar 500. Coberto na Task 4.
- **Limpeza de fotos órfãs apagando foto em uso**, e a função SQL `list_orphan_brand_photos` acessível pela API pública. Esperado: só arquivos com mais de 24h que nenhum ativo referencia; `anon`/`authenticated` sem `EXECUTE`. Coberto na Task 9 (verificação ao vivo).

---

### Task 1: Migração do banco e do Storage

**Files:**
- Create: `supabase/migrations/0007_brand_memory.sql`

**Interfaces:**
- Produces: tabelas `public.brands`, `public.brand_assets`, `public.prompt_library`; bucket privado `brand-assets`; função `public.list_orphan_brand_photos(p_older_than timestamptz) returns table (path text)` — consumidos pelos adaptadores Supabase da Task 8.

- [ ] **Step 1: Escrever a migração**

```sql
-- Memória da marca: marcas, ativos (produtos/elenco), biblioteca de prompts e fotos.

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kit jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brands_one_default_per_user on public.brands (user_id) where is_default;
create index brands_user_idx on public.brands (user_id, created_at);

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('product', 'character')),
  name text not null,
  data jsonb not null,
  analysis jsonb,
  photos jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brand_assets_name_unique on public.brand_assets (brand_id, kind, lower(name));
create index brand_assets_list_idx on public.brand_assets (brand_id, pinned, last_used_at desc);
create index brand_assets_user_idx on public.brand_assets (user_id);

create table public.prompt_library (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('video', 'image')),
  agent text,
  title text not null,
  product_name text,
  deterministic_prompt text not null,
  enhanced_prompt text,
  state jsonb,
  asset_ids uuid[] not null default '{}',
  favorite boolean not null default false,
  legacy_id text,
  created_at timestamptz not null default now()
);
create unique index prompt_library_legacy_unique on public.prompt_library (user_id, legacy_id) where legacy_id is not null;
create index prompt_library_list_idx on public.prompt_library (brand_id, created_at desc, id desc);

alter table public.brands enable row level security;
alter table public.brand_assets enable row level security;
alter table public.prompt_library enable row level security;
-- Sem policies: só o service role acessa.

-- Bucket privado. O limite de tamanho e de tipo vale também para uploads por link assinado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Arquivos do bucket com mais de p_older_than que nenhum ativo referencia (upload nunca confirmado,
-- ou remoção do Storage que falhou). Usada só pelo cron diário.
create or replace function public.list_orphan_brand_photos(p_older_than timestamptz)
returns table (path text)
language sql
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'brand-assets'
    and o.created_at < p_older_than
    and not exists (
      select 1
      from public.brand_assets a
      cross join lateral jsonb_array_elements(a.photos) p
      where p ->> 'path' = o.name
    )
  limit 1000;
$$;

revoke all on function public.list_orphan_brand_photos(timestamptz) from public, anon, authenticated;
grant execute on function public.list_orphan_brand_photos(timestamptz) to service_role;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0007_brand_memory.sql
git commit -m "$(cat <<'EOF'
feat: add brand memory migration (tables, private bucket, orphan query)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Aplicar a migração fica para a Task 9.

---

### Task 2: Tipos, limites, validação e caminhos de foto

**Files:**
- Create: `api/_lib/memory/types.ts`
- Create: `api/_lib/memory/limits.ts`
- Create: `api/_lib/memory/validate.ts`
- Create: `api/_lib/memory/paths.ts`
- Test: `api/_lib/memory/validate.test.ts`
- Test: `api/_lib/memory/paths.test.ts`

**Interfaces:**
- Produces (usados por todas as tasks seguintes):
  - `types.ts`: `AssetKind`, `PhotoMime`, `BrandKit`, `Brand`, `Photo`, `Asset`, `NewAsset`, `AssetPatch`, `PromptEntry`, `NewPrompt`, `PromptQuery`, `MemoryRepo`, `UploadTicket`, `StoredFileInfo`, `StoragePort`, `MemoryLimits`, `MemoryDeps`.
  - `limits.ts`: `MEMORY_LIMITS`, `MAX_NAME_LENGTH`, `MAX_TITLE_LENGTH`, `MAX_DATA_BYTES`, `MAX_STATE_BYTES`, `MAX_PROMPT_BYTES`, `MAX_PHOTO_BYTES`, `ALLOWED_PHOTO_MIMES`, `PROMPTS_PAGE_SIZE`, `READ_URL_TTL_SECONDS`, `MAX_IMPORT_ITEMS`, `MAX_KIT_TEXT`, `MAX_QUERY_LENGTH`, `MAX_PROMPT_ASSETS`.
  - `validate.ts`: `AGENTS`, `cleanName(v): string | null`, `isPlainObject(v)`, `jsonBytes(v): number`, `cleanObject(v, maxBytes): Record<string, unknown> | null`, `cleanText(v, maxBytes): string | null`, `cleanKit(v): BrandKit | null`, `cleanSearch(v: string): string | undefined`, `isAllowedMime(v): v is PhotoMime`, `isUuid(v): v is string`.
  - `paths.ts`: `photoPath(userId, brandId, assetId, fileId, mime): string`, `isAssetPhotoPath(path, userId, brandId, assetId): path is string`, `mimeFromPath(path): PhotoMime`.

- [ ] **Step 1: Criar `api/_lib/memory/types.ts`**

```ts
import type { ALLOWED_PHOTO_MIMES } from './limits.js';

export type AssetKind = 'product' | 'character';
export type PhotoMime = (typeof ALLOWED_PHOTO_MIMES)[number];

// Mesmo formato de UserPreferences do frontend (src/types.ts).
export interface BrandKit {
  autoApply?: boolean;
  preferredAgent?: 'pov' | 'ugc' | 'motion';
  preferredStyle?: string;
  preferredPalette?: string;
  preferredCamera?: string;
}

export interface Brand {
  id: string;
  userId: string;
  name: string;
  kit: BrandKit;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  path: string;
  mime: string;
  size: number;
}

export interface Asset {
  id: string;
  brandId: string;
  userId: string;
  kind: AssetKind;
  name: string;
  data: Record<string, unknown>;
  analysis: Record<string, unknown> | null;
  photos: Photo[];
  pinned: boolean;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type NewAsset = Pick<Asset, 'brandId' | 'kind' | 'name' | 'data' | 'analysis' | 'photos' | 'pinned' | 'lastUsedAt'>;
export type AssetPatch = Partial<Pick<Asset, 'name' | 'data' | 'analysis' | 'photos' | 'pinned' | 'lastUsedAt'>>;

export interface PromptEntry {
  id: string;
  brandId: string;
  userId: string;
  mode: 'video' | 'image';
  agent: string | null;
  title: string;
  productName: string | null;
  deterministicPrompt: string;
  enhancedPrompt: string | null;
  state: Record<string, unknown> | null;
  assetIds: string[];
  favorite: boolean;
  legacyId: string | null;
  createdAt: string;
}

export type NewPrompt = Omit<PromptEntry, 'id' | 'userId' | 'favorite' | 'createdAt'> & { createdAt?: string };

export interface PromptQuery {
  q?: string;
  favorite?: boolean;
  before?: { createdAt: string; id: string };
  limit: number;
}

// Toda operação recebe userId e só enxerga dados desse usuário.
export interface MemoryRepo {
  listBrands(userId: string): Promise<Brand[]>; // mais antiga primeiro
  getBrand(userId: string, brandId: string): Promise<Brand | null>;
  insertBrand(userId: string, input: { name: string; kit: BrandKit; isDefault: boolean }): Promise<Brand>;
  updateBrand(userId: string, brandId: string, patch: Partial<Pick<Brand, 'name' | 'kit' | 'isDefault'>>): Promise<Brand | null>;
  deleteBrand(userId: string, brandId: string): Promise<void>; // cascata: ativos e prompts
  listAssets(userId: string, brandId: string): Promise<Asset[]>; // usado mais recentemente primeiro
  listAllAssets(userId: string): Promise<Asset[]>;
  getAsset(userId: string, assetId: string): Promise<Asset | null>;
  findAssetByName(userId: string, brandId: string, kind: AssetKind, name: string): Promise<Asset | null>; // sem diferenciar maiúsculas
  insertAsset(userId: string, input: NewAsset): Promise<Asset>; // lança se o nome já existe na marca e tipo
  updateAsset(userId: string, assetId: string, patch: AssetPatch): Promise<Asset | null>;
  deleteAsset(userId: string, assetId: string): Promise<void>;
  listPrompts(userId: string, brandId: string, query: PromptQuery): Promise<PromptEntry[]>; // mais novo primeiro
  getPrompt(userId: string, promptId: string): Promise<PromptEntry | null>;
  insertPrompt(userId: string, input: NewPrompt): Promise<PromptEntry>;
  setPromptFavorite(userId: string, promptId: string, favorite: boolean): Promise<PromptEntry | null>;
  deletePrompt(userId: string, promptId: string): Promise<void>;
  existingLegacyIds(userId: string, legacyIds: string[]): Promise<string[]>;
  deleteAllBrands(userId: string): Promise<void>;
}

export interface UploadTicket {
  path: string;
  signedUrl: string;
  token: string;
}

export interface StoredFileInfo {
  size: number;
  mime: string | null;
}

export interface StoragePort {
  createUploadUrls(paths: string[]): Promise<UploadTicket[]>;
  createReadUrls(paths: string[], expiresInSeconds: number): Promise<Record<string, string>>;
  stat(path: string): Promise<StoredFileInfo | null>; // null = não existe
  remove(paths: string[]): Promise<void>;
}

export interface MemoryLimits {
  brands: number;
  pinnedAssetsPerBrand: number;
  recentAssetsPerBrand: number;
  photosPerAsset: number;
}

export interface MemoryDeps {
  repo: MemoryRepo;
  storage: StoragePort;
  limits: MemoryLimits;
  now: () => Date;
  newId: () => string;
}
```

- [ ] **Step 2: Criar `api/_lib/memory/limits.ts`**

```ts
import type { MemoryLimits } from './types.js';

// Limites por plano. Um futuro plano Agência é só uma nova entrada aqui.
export const MEMORY_LIMITS: Record<'default', MemoryLimits> = {
  default: { brands: 3, pinnedAssetsPerBrand: 30, recentAssetsPerBrand: 20, photosPerAsset: 4 },
};

export const MAX_NAME_LENGTH = 80;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DATA_BYTES = 20 * 1024;
export const MAX_STATE_BYTES = 50 * 1024;
export const MAX_PROMPT_BYTES = 20 * 1024;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PROMPTS_PAGE_SIZE = 20;
export const READ_URL_TTL_SECONDS = 3600;
export const MAX_IMPORT_ITEMS = 50;
export const MAX_KIT_TEXT = 200;
export const MAX_QUERY_LENGTH = 100;
export const MAX_PROMPT_ASSETS = 10;
```

- [ ] **Step 3: Escrever os testes que falham**

```ts
// api/_lib/memory/validate.test.ts
import { describe, it, expect } from 'vitest';
import { cleanKit, cleanName, cleanObject, cleanSearch, cleanText, isAllowedMime, isUuid } from './validate.js';

describe('cleanName', () => {
  it('apara espaços e aceita até 80 caracteres', () => {
    expect(cleanName('  Sérum X  ')).toBe('Sérum X');
    expect(cleanName('a'.repeat(80))).toBe('a'.repeat(80));
  });
  it('recusa vazio, longo demais e não-string', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('a'.repeat(81))).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});

describe('cleanObject', () => {
  it('aceita objeto simples dentro do limite', () => {
    expect(cleanObject({ nome: 'Sérum' }, 100)).toEqual({ nome: 'Sérum' });
  });
  it('recusa array, null, string e objeto acima do limite', () => {
    expect(cleanObject([1], 100)).toBeNull();
    expect(cleanObject(null, 100)).toBeNull();
    expect(cleanObject('x', 100)).toBeNull();
    expect(cleanObject({ texto: 'a'.repeat(200) }, 100)).toBeNull();
  });
});

describe('cleanText', () => {
  it('aceita texto dentro do limite e recusa vazio ou grande demais', () => {
    expect(cleanText('prompt', 10)).toBe('prompt');
    expect(cleanText('', 10)).toBeNull();
    expect(cleanText('a'.repeat(11), 10)).toBeNull();
  });
});

describe('cleanKit', () => {
  it('mantém só as chaves conhecidas', () => {
    expect(
      cleanKit({ autoApply: true, preferredAgent: 'ugc', preferredStyle: 'minimalista', extra: 'x' })
    ).toEqual({ autoApply: true, preferredAgent: 'ugc', preferredStyle: 'minimalista' });
  });
  it('recusa agente desconhecido, tipo errado e texto longo demais', () => {
    expect(cleanKit({ preferredAgent: 'hacker' })).toBeNull();
    expect(cleanKit({ autoApply: 'sim' })).toBeNull();
    expect(cleanKit({ preferredPalette: 'a'.repeat(201) })).toBeNull();
    expect(cleanKit('kit')).toBeNull();
  });
});

describe('cleanSearch', () => {
  it('remove caracteres que quebrariam o filtro do PostgREST', () => {
    expect(cleanSearch('sérum, (x)*"%')).toBe('sérum x');
  });
  it('devolve undefined quando nada sobra', () => {
    expect(cleanSearch(' ,() ')).toBeUndefined();
  });
});

describe('isAllowedMime / isUuid', () => {
  it('aceita só os tipos de imagem permitidos', () => {
    expect(isAllowedMime('image/webp')).toBe(true);
    expect(isAllowedMime('image/gif')).toBe(false);
  });
  it('reconhece UUID e recusa o resto', () => {
    expect(isUuid('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(true);
    expect(isUuid('1; drop table')).toBe(false);
    expect(isUuid(7)).toBe(false);
  });
});
```

```ts
// api/_lib/memory/paths.test.ts
import { describe, it, expect } from 'vitest';
import { isAssetPhotoPath, mimeFromPath, photoPath } from './paths.js';

const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = '00000000-0000-4000-8000-000000000001';
const A = '00000000-0000-4000-8000-000000000002';
const F = 'f0000000-0000-4000-8000-000000000001';

describe('photoPath', () => {
  it('monta usuário/marca/ativo/arquivo.ext', () => {
    expect(photoPath(U, B, A, F, 'image/png')).toBe(`${U}/${B}/${A}/${F}.png`);
  });
});

describe('isAssetPhotoPath', () => {
  it('aceita um caminho gerado para aquele ativo', () => {
    expect(isAssetPhotoPath(photoPath(U, B, A, F, 'image/jpeg'), U, B, A)).toBe(true);
  });
  it('recusa outro usuário, outro ativo, travessia, segmento extra e extensão estranha', () => {
    const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    expect(isAssetPhotoPath(`${other}/${B}/${A}/${F}.jpg`, U, B, A)).toBe(false);
    expect(isAssetPhotoPath(`${U}/${B}/${other}/${F}.jpg`, U, B, A)).toBe(false);
    expect(isAssetPhotoPath(`${U}/${B}/${A}/../${F}.jpg`, U, B, A)).toBe(false);
    expect(isAssetPhotoPath(`${U}/${B}/${A}/x/${F}.jpg`, U, B, A)).toBe(false);
    expect(isAssetPhotoPath(`${U}/${B}/${A}/${F}.svg`, U, B, A)).toBe(false);
    expect(isAssetPhotoPath(42, U, B, A)).toBe(false);
  });
});

describe('mimeFromPath', () => {
  it('deduz o tipo pela extensão', () => {
    expect(mimeFromPath(`${U}/${B}/${A}/${F}.webp`)).toBe('image/webp');
    expect(mimeFromPath(`${U}/${B}/${A}/${F}.jpg`)).toBe('image/jpeg');
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -- api/_lib/memory/validate.test.ts api/_lib/memory/paths.test.ts`
Expected: FAIL — `Cannot find module './validate.js'` e `'./paths.js'`

- [ ] **Step 5: Implementar `api/_lib/memory/validate.ts`**

```ts
import { ALLOWED_PHOTO_MIMES, MAX_KIT_TEXT, MAX_NAME_LENGTH } from './limits.js';
import type { BrandKit, PhotoMime } from './types.js';

export const AGENTS: ReadonlySet<string> = new Set(['pov', 'ugc', 'motion']);

export function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= MAX_NAME_LENGTH ? name : null;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export function cleanObject(value: unknown, maxBytes: number): Record<string, unknown> | null {
  if (!isPlainObject(value)) return null;
  return jsonBytes(value) <= maxBytes ? value : null;
}

export function cleanText(value: unknown, maxBytes: number): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return Buffer.byteLength(value, 'utf8') <= maxBytes ? value : null;
}

// Só as chaves conhecidas sobrevivem; um valor inválido anula o kit inteiro.
export function cleanKit(value: unknown): BrandKit | null {
  if (!isPlainObject(value)) return null;
  const kit: BrandKit = {};
  if (value.autoApply !== undefined) {
    if (typeof value.autoApply !== 'boolean') return null;
    kit.autoApply = value.autoApply;
  }
  if (value.preferredAgent !== undefined) {
    if (typeof value.preferredAgent !== 'string' || !AGENTS.has(value.preferredAgent)) return null;
    kit.preferredAgent = value.preferredAgent as BrandKit['preferredAgent'];
  }
  for (const key of ['preferredStyle', 'preferredPalette', 'preferredCamera'] as const) {
    const text = value[key];
    if (text === undefined) continue;
    if (typeof text !== 'string' || text.length > MAX_KIT_TEXT) return null;
    kit[key] = text;
  }
  return kit;
}

// A busca vira filtro `.or(...)` do PostgREST: só letras, números e espaços passam.
export function cleanSearch(value: string): string | undefined {
  const cleaned = value.replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function isAllowedMime(value: unknown): value is PhotoMime {
  return typeof value === 'string' && (ALLOWED_PHOTO_MIMES as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
```

- [ ] **Step 6: Implementar `api/_lib/memory/paths.ts`**

```ts
import type { PhotoMime } from './types.js';

const EXT: Record<PhotoMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME: Record<string, PhotoMime> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function photoPath(userId: string, brandId: string, assetId: string, fileId: string, mime: PhotoMime): string {
  return `${userId}/${brandId}/${assetId}/${fileId}.${EXT[mime]}`;
}

// O caminho vem do cliente em photo-confirm/photo-remove: só vale o formato exato gerado pelo servidor.
export function isAssetPhotoPath(path: unknown, userId: string, brandId: string, assetId: string): path is string {
  if (typeof path !== 'string') return false;
  const prefix = `${userId}/${brandId}/${assetId}/`;
  return path.startsWith(prefix) && FILE.test(path.slice(prefix.length));
}

export function mimeFromPath(path: string): PhotoMime {
  return MIME[path.slice(path.lastIndexOf('.') + 1)] ?? 'image/jpeg';
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -- api/_lib/memory/validate.test.ts api/_lib/memory/paths.test.ts`
Expected: PASS (11/11 + 4/4)

- [ ] **Step 8: Typecheck e commit**

Run: `npx tsc --noEmit`
Expected: sem erros.

```bash
git add api/_lib/memory/types.ts api/_lib/memory/limits.ts api/_lib/memory/validate.ts \
  api/_lib/memory/paths.ts api/_lib/memory/validate.test.ts api/_lib/memory/paths.test.ts
git commit -m "$(cat <<'EOF'
feat: add brand memory types, limits, validation and photo paths

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Dublês de teste e serviço de marcas

**Files:**
- Create: `api/_lib/memory/testing/memoryRepo.ts`
- Create: `api/_lib/memory/testing/memoryStorage.ts`
- Create: `api/_lib/memory/testing/fixtures.ts`
- Create: `api/_lib/memory/service/shared.ts`
- Create: `api/_lib/memory/service/brands.ts`
- Test: `api/_lib/memory/service/brands.test.ts`

**Interfaces:**
- Consumes: tipos, limites e validação da Task 2; `ok`, `fail`, `Result`, `User` de `api/_lib/billing/service/context.ts`; `logWarn` e `errorName` de `api/_lib/logging/`.
- Produces:
  - `createMemoryRepo(): InMemoryRepo` (expõe `brands`, `assets`, `prompts`), `createMemoryStorage(): InMemoryStorage` (expõe `files: Map<string, StoredFileInfo>`, `failRemove: boolean`).
  - `fixtures.ts`: `USER_A`, `USER_B`, `makeDeps(limits?) → { deps, repo, storage }`, `seedBrand(deps, user, name?, isDefault?)`, `seedAsset(deps, user, brandId, overrides?)`, `simulateUpload(storage, path, size?, mime?)`.
  - `shared.ts`: `removePhotosQuietly(deps, paths): Promise<void>`.
  - `brands.ts`: `DEFAULT_BRAND_NAME`, `BRAND_NOT_FOUND`, `ensureBrands(deps, userId)`, `findBrand(deps, userId, brandId: unknown)`, `listBrands(deps, user)`, `createBrand(deps, user, { name })`, `updateBrand(deps, user, { brandId, name, kit })`, `deleteBrand(deps, user, { brandId })`.

- [ ] **Step 1: Criar `api/_lib/memory/testing/memoryRepo.ts`**

```ts
import type { Asset, AssetKind, Brand, MemoryRepo, PromptEntry } from '../types.js';

export interface InMemoryRepo extends MemoryRepo {
  brands: Brand[];
  assets: Asset[];
  prompts: PromptEntry[];
}

const clone = <T>(value: T): T => structuredClone(value);

function removeWhere<T>(list: T[], predicate: (item: T) => boolean): void {
  for (let i = list.length - 1; i >= 0; i -= 1) if (predicate(list[i])) list.splice(i, 1);
}

// Imita as restrições do banco de que o serviço depende: uma marca padrão por usuário
// e nome único (sem diferenciar maiúsculas) por marca e tipo.
export function createMemoryRepo(): InMemoryRepo {
  const brands: Brand[] = [];
  const assets: Asset[] = [];
  const prompts: PromptEntry[] = [];
  let seq = 0;
  const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++seq * 1000).toISOString();

  const ownBrand = (userId: string, brandId: string) => brands.find((b) => b.userId === userId && b.id === brandId);
  const ownAsset = (userId: string, assetId: string) => assets.find((a) => a.userId === userId && a.id === assetId);
  const ownPrompt = (userId: string, promptId: string) => prompts.find((p) => p.userId === userId && p.id === promptId);
  const nameTaken = (userId: string, brandId: string, kind: AssetKind, name: string, exceptId?: string) =>
    assets.some(
      (a) =>
        a.userId === userId &&
        a.brandId === brandId &&
        a.kind === kind &&
        a.name.toLowerCase() === name.toLowerCase() &&
        a.id !== exceptId
    );

  return {
    brands,
    assets,
    prompts,

    async listBrands(userId) {
      return brands
        .filter((b) => b.userId === userId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map(clone);
    },
    async getBrand(userId, brandId) {
      const brand = ownBrand(userId, brandId);
      return brand ? clone(brand) : null;
    },
    async insertBrand(userId, input) {
      if (input.isDefault && brands.some((b) => b.userId === userId && b.isDefault)) {
        throw new Error('duplicate default brand');
      }
      const at = stamp();
      const brand: Brand = { id: nextId(), userId, ...clone(input), createdAt: at, updatedAt: at };
      brands.push(brand);
      return clone(brand);
    },
    async updateBrand(userId, brandId, patch) {
      const brand = ownBrand(userId, brandId);
      if (!brand) return null;
      Object.assign(brand, clone(patch), { updatedAt: stamp() });
      return clone(brand);
    },
    async deleteBrand(userId, brandId) {
      if (!ownBrand(userId, brandId)) return;
      removeWhere(brands, (b) => b.id === brandId);
      removeWhere(assets, (a) => a.brandId === brandId);
      removeWhere(prompts, (p) => p.brandId === brandId);
    },

    async listAssets(userId, brandId) {
      return assets
        .filter((a) => a.userId === userId && a.brandId === brandId)
        .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
        .map(clone);
    },
    async listAllAssets(userId) {
      return assets.filter((a) => a.userId === userId).map(clone);
    },
    async getAsset(userId, assetId) {
      const asset = ownAsset(userId, assetId);
      return asset ? clone(asset) : null;
    },
    async findAssetByName(userId, brandId, kind, name) {
      const asset = assets.find(
        (a) =>
          a.userId === userId && a.brandId === brandId && a.kind === kind && a.name.toLowerCase() === name.toLowerCase()
      );
      return asset ? clone(asset) : null;
    },
    async insertAsset(userId, input) {
      if (nameTaken(userId, input.brandId, input.kind, input.name)) throw new Error('duplicate asset name');
      const at = stamp();
      const asset: Asset = { id: nextId(), userId, ...clone(input), createdAt: at, updatedAt: at };
      assets.push(asset);
      return clone(asset);
    },
    async updateAsset(userId, assetId, patch) {
      const asset = ownAsset(userId, assetId);
      if (!asset) return null;
      if (patch.name !== undefined && nameTaken(userId, asset.brandId, asset.kind, patch.name, asset.id)) {
        throw new Error('duplicate asset name');
      }
      Object.assign(asset, clone(patch), { updatedAt: stamp() });
      return clone(asset);
    },
    async deleteAsset(userId, assetId) {
      removeWhere(assets, (a) => a.userId === userId && a.id === assetId);
    },

    async listPrompts(userId, brandId, query) {
      const q = query.q?.toLowerCase();
      const before = query.before;
      return prompts
        .filter((p) => p.userId === userId && p.brandId === brandId)
        .filter((p) => !query.favorite || p.favorite)
        .filter((p) => !q || p.title.toLowerCase().includes(q) || (p.productName ?? '').toLowerCase().includes(q))
        .filter(
          (p) => !before || p.createdAt < before.createdAt || (p.createdAt === before.createdAt && p.id < before.id)
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, query.limit)
        .map(clone);
    },
    async getPrompt(userId, promptId) {
      const prompt = ownPrompt(userId, promptId);
      return prompt ? clone(prompt) : null;
    },
    async insertPrompt(userId, input) {
      const { createdAt, ...rest } = clone(input);
      const prompt: PromptEntry = { id: nextId(), userId, favorite: false, createdAt: createdAt ?? stamp(), ...rest };
      prompts.push(prompt);
      return clone(prompt);
    },
    async setPromptFavorite(userId, promptId, favorite) {
      const prompt = ownPrompt(userId, promptId);
      if (!prompt) return null;
      prompt.favorite = favorite;
      return clone(prompt);
    },
    async deletePrompt(userId, promptId) {
      removeWhere(prompts, (p) => p.userId === userId && p.id === promptId);
    },
    async existingLegacyIds(userId, legacyIds) {
      return prompts
        .filter((p) => p.userId === userId && p.legacyId !== null && legacyIds.includes(p.legacyId))
        .map((p) => p.legacyId as string);
    },
    async deleteAllBrands(userId) {
      removeWhere(brands, (b) => b.userId === userId);
      removeWhere(assets, (a) => a.userId === userId);
      removeWhere(prompts, (p) => p.userId === userId);
    },
  };
}
```

- [ ] **Step 2: Criar `api/_lib/memory/testing/memoryStorage.ts`**

```ts
import type { StoragePort, StoredFileInfo } from '../types.js';

export interface InMemoryStorage extends StoragePort {
  files: Map<string, StoredFileInfo>;
  failRemove: boolean;
}

export function createMemoryStorage(): InMemoryStorage {
  const files = new Map<string, StoredFileInfo>();
  const storage: InMemoryStorage = {
    files,
    failRemove: false,
    async createUploadUrls(paths) {
      return paths.map((path) => ({ path, signedUrl: `https://storage.test/upload/${path}`, token: `token-${path}` }));
    },
    async createReadUrls(paths) {
      return Object.fromEntries(paths.map((path) => [path, `https://storage.test/read/${path}`]));
    },
    async stat(path) {
      return files.get(path) ?? null;
    },
    async remove(paths) {
      if (storage.failRemove) throw new Error('storage fora do ar');
      for (const path of paths) files.delete(path);
    },
  };
  return storage;
}
```

- [ ] **Step 3: Criar `api/_lib/memory/testing/fixtures.ts`**

```ts
import type { User } from '../../billing/service/context.js';
import { MEMORY_LIMITS } from '../limits.js';
import type { Asset, Brand, MemoryDeps, MemoryLimits, NewAsset } from '../types.js';
import { createMemoryRepo } from './memoryRepo.js';
import { createMemoryStorage, type InMemoryStorage } from './memoryStorage.js';

export const USER_A: User = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.com' };
export const USER_B: User = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@example.com' };

// `now` avança 1s a cada chamada, para a ordem de "usado por último" ser determinística.
export function makeDeps(limits: Partial<MemoryLimits> = {}) {
  const repo = createMemoryRepo();
  const storage = createMemoryStorage();
  let tick = 0;
  let fileSeq = 0;
  const deps: MemoryDeps = {
    repo,
    storage,
    limits: { ...MEMORY_LIMITS.default, ...limits },
    now: () => new Date(Date.UTC(2026, 5, 1) + ++tick * 1000),
    newId: () => `f0000000-0000-4000-8000-${String(++fileSeq).padStart(12, '0')}`,
  };
  return { deps, repo, storage };
}

export function seedBrand(deps: MemoryDeps, user: User, name = 'Marca Teste', isDefault = false): Promise<Brand> {
  return deps.repo.insertBrand(user.id, { name, kit: {}, isDefault });
}

export function seedAsset(
  deps: MemoryDeps,
  user: User,
  brandId: string,
  overrides: Partial<NewAsset> = {}
): Promise<Asset> {
  return deps.repo.insertAsset(user.id, {
    brandId,
    kind: 'product',
    name: 'Sérum X',
    data: { nome: 'Sérum X' },
    analysis: null,
    photos: [],
    pinned: false,
    lastUsedAt: deps.now().toISOString(),
    ...overrides,
  });
}

// Simula o navegador enviando a foto pelo link assinado.
export function simulateUpload(storage: InMemoryStorage, path: string, size = 300_000, mime = 'image/jpeg'): void {
  storage.files.set(path, { size, mime });
}
```

- [ ] **Step 4: Escrever o teste que falha**

```ts
// api/_lib/memory/service/brands.test.ts
import { describe, it, expect } from 'vitest';
import { createBrand, deleteBrand, ensureBrands, listBrands, updateBrand } from './brands.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from '../testing/fixtures.js';

describe('listBrands', () => {
  it('cria a "Minha marca" padrão no primeiro acesso, uma única vez', async () => {
    const { deps, repo } = makeDeps();
    const first = await listBrands(deps, USER_A);
    await listBrands(deps, USER_A);
    expect(first.status).toBe(200);
    expect(first.body.brands).toMatchObject([{ name: 'Minha marca', isDefault: true }]);
    expect(repo.brands.filter((b) => b.userId === USER_A.id)).toHaveLength(1);
  });

  it('tolera outra requisição ter criado a marca padrão ao mesmo tempo', async () => {
    const { deps, repo } = makeDeps();
    const original = repo.insertBrand;
    repo.insertBrand = async (userId, input) => {
      await original(userId, input);
      throw new Error('duplicate default brand');
    };
    const brands = await ensureBrands(deps, USER_A.id);
    expect(brands).toHaveLength(1);
  });
});

describe('createBrand', () => {
  it('cria marca não-padrão com nome aparado', async () => {
    const { deps } = makeDeps();
    const res = await createBrand(deps, USER_A, { name: '  Loja da Ana ' });
    expect(res.status).toBe(200);
    expect(res.body.brand).toMatchObject({ name: 'Loja da Ana', isDefault: false });
  });

  it('bloqueia a 4ª marca com 409 limit_reached', async () => {
    const { deps } = makeDeps();
    await createBrand(deps, USER_A, { name: 'B' });
    await createBrand(deps, USER_A, { name: 'C' });
    const res = await createBrand(deps, USER_A, { name: 'D' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'limit_reached', limit: 'brands' });
  });

  it('recusa nome inválido', async () => {
    const { deps } = makeDeps();
    expect((await createBrand(deps, USER_A, { name: '' })).status).toBe(400);
  });
});

describe('updateBrand', () => {
  it('renomeia e salva só as chaves conhecidas do kit', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const res = await updateBrand(deps, USER_A, {
      brandId: brand.id,
      name: 'Nova',
      kit: { preferredAgent: 'pov', lixo: 1 },
    });
    expect(res.status).toBe(200);
    expect(res.body.brand).toMatchObject({ name: 'Nova', kit: { preferredAgent: 'pov' } });
  });

  it('400 para kit inválido ou nada para atualizar', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await updateBrand(deps, USER_A, { brandId: brand.id, name: undefined, kit: { autoApply: 'x' } })).status).toBe(400);
    expect((await updateBrand(deps, USER_A, { brandId: brand.id, name: undefined, kit: undefined })).status).toBe(400);
  });

  it('404 para marca de outro usuário ou id inválido', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await updateBrand(deps, USER_B, { brandId: brand.id, name: 'X', kit: undefined })).status).toBe(404);
    expect((await updateBrand(deps, USER_A, { brandId: 'nao-e-uuid', name: 'X', kit: undefined })).status).toBe(404);
  });
});

describe('deleteBrand', () => {
  it('recusa apagar a única marca', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A, 'Única', true);
    const res = await deleteBrand(deps, USER_A, { brandId: brand.id });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'last_brand' });
  });

  it('apaga ativos, prompts e fotos da marca e promove a mais antiga restante a padrão', async () => {
    const { deps, repo, storage } = makeDeps();
    const main = await seedBrand(deps, USER_A, 'Principal', true);
    const second = await seedBrand(deps, USER_A, 'Segunda');
    await seedBrand(deps, USER_A, 'Terceira');
    const path = `${USER_A.id}/${main.id}/x/foto.jpg`;
    simulateUpload(storage, path);
    await seedAsset(deps, USER_A, main.id, { photos: [{ path, mime: 'image/jpeg', size: 1 }] });
    await repo.insertPrompt(USER_A.id, {
      brandId: main.id, mode: 'video', agent: null, title: 't', productName: null,
      deterministicPrompt: 'p', enhancedPrompt: null, state: null, assetIds: [], legacyId: null,
    });

    const res = await deleteBrand(deps, USER_A, { brandId: main.id });

    expect(res.status).toBe(200);
    expect(repo.assets).toHaveLength(0);
    expect(repo.prompts).toHaveLength(0);
    expect(storage.files.has(path)).toBe(false);
    expect(repo.brands.find((b) => b.id === second.id)?.isDefault).toBe(true);
  });

  it('falha ao apagar do Storage não impede apagar a marca', async () => {
    const { deps, repo, storage } = makeDeps();
    await seedBrand(deps, USER_A, 'A', true);
    const other = await seedBrand(deps, USER_A, 'B');
    await seedAsset(deps, USER_A, other.id, { photos: [{ path: 'p.jpg', mime: 'image/jpeg', size: 1 }] });
    storage.failRemove = true;
    expect((await deleteBrand(deps, USER_A, { brandId: other.id })).status).toBe(200);
    expect(repo.brands.some((b) => b.id === other.id)).toBe(false);
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npm test -- api/_lib/memory/service/brands.test.ts`
Expected: FAIL — `Cannot find module './brands.js'`

- [ ] **Step 6: Criar `api/_lib/memory/service/shared.ts`**

```ts
import { errorName } from '../../logging/errorName.js';
import { logWarn } from '../../logging/logger.js';
import type { MemoryDeps } from '../types.js';

// Falha ao apagar do Storage nunca desfaz a operação: o arquivo fica órfão e a limpeza diária remove.
export async function removePhotosQuietly(deps: MemoryDeps, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await deps.storage.remove(paths);
  } catch (err) {
    logWarn('memory_photo_remove_failed', { errorName: errorName(err), count: paths.length });
  }
}
```

- [ ] **Step 7: Implementar `api/_lib/memory/service/brands.ts`**

```ts
import { fail, ok, type Result, type User } from '../../billing/service/context.js';
import { cleanKit, cleanName, isUuid } from '../validate.js';
import type { Brand, BrandKit, MemoryDeps } from '../types.js';
import { removePhotosQuietly } from './shared.js';

export const DEFAULT_BRAND_NAME = 'Minha marca';
export const BRAND_NOT_FOUND = 'Marca não encontrada.';

export async function ensureBrands(deps: MemoryDeps, userId: string): Promise<Brand[]> {
  const brands = await deps.repo.listBrands(userId);
  if (brands.length > 0) return brands;
  try {
    await deps.repo.insertBrand(userId, { name: DEFAULT_BRAND_NAME, kit: {}, isDefault: true });
  } catch {
    // Uma requisição simultânea já criou a marca padrão (índice único de is_default).
  }
  return deps.repo.listBrands(userId);
}

export async function findBrand(deps: MemoryDeps, userId: string, brandId: unknown): Promise<Brand | null> {
  return isUuid(brandId) ? deps.repo.getBrand(userId, brandId) : null;
}

export async function listBrands(deps: MemoryDeps, user: User): Promise<Result> {
  return ok({ brands: await ensureBrands(deps, user.id) });
}

export async function createBrand(deps: MemoryDeps, user: User, input: { name: unknown }): Promise<Result> {
  const name = cleanName(input.name);
  if (!name) return fail(400, 'Nome da marca inválido.');
  const brands = await ensureBrands(deps, user.id);
  if (brands.length >= deps.limits.brands) {
    return fail(409, `Seu plano permite até ${deps.limits.brands} marcas.`, {
      code: 'limit_reached',
      limit: 'brands',
    });
  }
  const brand = await deps.repo.insertBrand(user.id, { name, kit: {}, isDefault: false });
  return ok({ brand });
}

export async function updateBrand(
  deps: MemoryDeps,
  user: User,
  input: { brandId: unknown; name: unknown; kit: unknown }
): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  const patch: { name?: string; kit?: BrandKit } = {};
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    if (!name) return fail(400, 'Nome da marca inválido.');
    patch.name = name;
  }
  if (input.kit !== undefined) {
    const kit = cleanKit(input.kit);
    if (!kit) return fail(400, 'Kit da marca inválido.');
    patch.kit = kit;
  }
  if (Object.keys(patch).length === 0) return fail(400, 'Nada para atualizar.');
  const updated = await deps.repo.updateBrand(user.id, brand.id, patch);
  return updated ? ok({ brand: updated }) : fail(404, BRAND_NOT_FOUND);
}

export async function deleteBrand(deps: MemoryDeps, user: User, input: { brandId: unknown }): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  const brands = await deps.repo.listBrands(user.id);
  if (brands.length <= 1) {
    return fail(409, 'Não é possível apagar a única marca da conta.', { code: 'last_brand' });
  }
  const assets = await deps.repo.listAssets(user.id, brand.id);
  await removePhotosQuietly(deps, assets.flatMap((a) => a.photos.map((p) => p.path)));
  await deps.repo.deleteBrand(user.id, brand.id);
  if (brand.isDefault) {
    const oldest = brands.find((b) => b.id !== brand.id);
    if (oldest) await deps.repo.updateBrand(user.id, oldest.id, { isDefault: true });
  }
  return ok();
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm test -- api/_lib/memory/service/brands.test.ts`
Expected: PASS (11/11)

- [ ] **Step 9: Typecheck e commit**

Run: `npx tsc --noEmit`
Expected: sem erros.

```bash
git add api/_lib/memory/testing api/_lib/memory/service/shared.ts \
  api/_lib/memory/service/brands.ts api/_lib/memory/service/brands.test.ts
git commit -m "$(cat <<'EOF'
feat: add brand memory test doubles and brands service

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Serviço de ativos (listar, salvar ao usar, fixar, apagar)

**Files:**
- Create: `api/_lib/memory/service/assets.ts`
- Test: `api/_lib/memory/service/assets.test.ts`

**Interfaces:**
- Consumes: `findBrand`, `BRAND_NOT_FOUND` (Task 3), `removePhotosQuietly` (Task 3), dublês e fixtures (Task 3).
- Produces: `ASSET_NOT_FOUND`, `findAsset(deps, userId, assetId: unknown): Promise<Asset | null>`, `listAssets(deps, user, { brandId })`, `useAsset(deps, user, { brandId, kind, name, data, analysis })`, `updateAsset(deps, user, { assetId, pinned, name, data, analysis })`, `deleteAsset(deps, user, { assetId })`. `listAssets` devolve cada foto com `url` (link assinado ou `null`).

- [ ] **Step 1: Escrever o teste que falha**

```ts
// api/_lib/memory/service/assets.test.ts
import { describe, it, expect } from 'vitest';
import { deleteAsset, listAssets, updateAsset, useAsset } from './assets.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from '../testing/fixtures.js';

const product = (name: string, extra: Record<string, unknown> = {}) => ({
  kind: 'product',
  name,
  data: { nome: name },
  analysis: undefined,
  ...extra,
});

describe('listAssets', () => {
  it('devolve os ativos da marca com link assinado em cada foto', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    await seedAsset(deps, USER_A, brand.id, { photos: [{ path: 'a.jpg', mime: 'image/jpeg', size: 1 }] });
    const res = await listAssets(deps, USER_A, { brandId: brand.id });
    expect(res.status).toBe(200);
    const [asset] = res.body.assets as { photos: { url: string }[] }[];
    expect(asset.photos[0].url).toBe('https://storage.test/read/a.jpg');
  });

  it('404 para marca de outro usuário', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await listAssets(deps, USER_B, { brandId: brand.id })).status).toBe(404);
  });
});

describe('useAsset', () => {
  it('cria um recente na primeira vez', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const res = await useAsset(deps, USER_A, { brandId: brand.id, ...product('Sérum X') });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: true, asset: { name: 'Sérum X', pinned: false } });
  });

  it('atualiza (sem duplicar) quando o nome já existe, ignorando maiúsculas, e mantém a análise se não vier', async () => {
    const { deps, repo } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    await useAsset(deps, USER_A, { brandId: brand.id, ...product('Sérum X', { analysis: { resumo: 'ok' } }) });
    const res = await useAsset(deps, USER_A, { brandId: brand.id, ...product('sérum x', { data: { nome: 'v2' } }) });
    expect(res.body).toMatchObject({ created: false, asset: { data: { nome: 'v2' }, analysis: { resumo: 'ok' } } });
    expect(repo.assets).toHaveLength(1);
  });

  it('o 21º recente apaga o mais antigo e as fotos dele; fixados não são podados', async () => {
    const { deps, repo, storage } = makeDeps({ recentAssetsPerBrand: 2 });
    const brand = await seedBrand(deps, USER_A);
    await seedAsset(deps, USER_A, brand.id, { name: 'Fixado', pinned: true });
    simulateUpload(storage, 'velho.jpg');
    await seedAsset(deps, USER_A, brand.id, { name: 'Velho', photos: [{ path: 'velho.jpg', mime: 'image/jpeg', size: 1 }] });
    await seedAsset(deps, USER_A, brand.id, { name: 'Meio' });

    await useAsset(deps, USER_A, { brandId: brand.id, ...product('Novo') });

    expect(repo.assets.map((a) => a.name).sort()).toEqual(['Fixado', 'Meio', 'Novo']);
    expect(storage.files.has('velho.jpg')).toBe(false);
  });

  it('se outra requisição criou o mesmo nome no meio, atualiza em vez de falhar', async () => {
    const { deps, repo } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    await seedAsset(deps, USER_A, brand.id, { name: 'Sérum X' });
    const original = repo.findAssetByName;
    let calls = 0;
    repo.findAssetByName = async (...args) => (++calls === 1 ? null : original(...args));
    const res = await useAsset(deps, USER_A, { brandId: brand.id, ...product('Sérum X', { data: { nome: 'v2' } }) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: false, asset: { data: { nome: 'v2' } } });
    expect(repo.assets).toHaveLength(1);
  });

  it('400 para tipo, nome ou dados inválidos', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await useAsset(deps, USER_A, { brandId: brand.id, ...product('X', { kind: 'cenario' }) })).status).toBe(400);
    expect((await useAsset(deps, USER_A, { brandId: brand.id, ...product('') })).status).toBe(400);
    expect(
      (await useAsset(deps, USER_A, { brandId: brand.id, ...product('X', { data: { t: 'a'.repeat(21_000) } }) })).status
    ).toBe(400);
  });
});

describe('updateAsset', () => {
  it('fixar respeita o limite de fixados por marca', async () => {
    const { deps } = makeDeps({ pinnedAssetsPerBrand: 1 });
    const brand = await seedBrand(deps, USER_A);
    await seedAsset(deps, USER_A, brand.id, { name: 'Um', pinned: true });
    const dois = await seedAsset(deps, USER_A, brand.id, { name: 'Dois' });
    const res = await updateAsset(deps, USER_A, { assetId: dois.id, pinned: true, name: undefined, data: undefined, analysis: undefined });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'limit_reached', limit: 'pinnedAssets' });
  });

  it('desafixar com recentes cheios mantém o item desafixado e poda o recente mais antigo', async () => {
    const { deps, repo } = makeDeps({ recentAssetsPerBrand: 2 });
    const brand = await seedBrand(deps, USER_A);
    const fixado = await seedAsset(deps, USER_A, brand.id, { name: 'Fixado', pinned: true });
    await seedAsset(deps, USER_A, brand.id, { name: 'R1' });
    await seedAsset(deps, USER_A, brand.id, { name: 'R2' });
    const res = await updateAsset(deps, USER_A, { assetId: fixado.id, pinned: false, name: undefined, data: undefined, analysis: undefined });
    expect(res.status).toBe(200);
    expect(repo.assets.map((a) => a.name).sort()).toEqual(['Fixado', 'R2']);
  });

  it('409 ao renomear para um nome que já existe; analysis null zera a análise', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    await seedAsset(deps, USER_A, brand.id, { name: 'A' });
    const b = await seedAsset(deps, USER_A, brand.id, { name: 'B', analysis: { x: 1 } });
    expect((await updateAsset(deps, USER_A, { assetId: b.id, pinned: undefined, name: 'a', data: undefined, analysis: undefined })).body).toMatchObject({ code: 'name_taken' });
    const cleared = await updateAsset(deps, USER_A, { assetId: b.id, pinned: undefined, name: undefined, data: undefined, analysis: null });
    expect(cleared.body).toMatchObject({ asset: { analysis: null } });
  });
});

describe('deleteAsset', () => {
  it('apaga o ativo e as fotos; 404 para ativo de outro usuário', async () => {
    const { deps, repo, storage } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    simulateUpload(storage, 'f.jpg');
    const asset = await seedAsset(deps, USER_A, brand.id, { photos: [{ path: 'f.jpg', mime: 'image/jpeg', size: 1 }] });
    expect((await deleteAsset(deps, USER_B, { assetId: asset.id })).status).toBe(404);
    expect((await deleteAsset(deps, USER_A, { assetId: asset.id })).status).toBe(200);
    expect(repo.assets).toHaveLength(0);
    expect(storage.files.has('f.jpg')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- api/_lib/memory/service/assets.test.ts`
Expected: FAIL — `Cannot find module './assets.js'`

- [ ] **Step 3: Implementar `api/_lib/memory/service/assets.ts`**

```ts
import { fail, ok, type Result, type User } from '../../billing/service/context.js';
import { MAX_DATA_BYTES, READ_URL_TTL_SECONDS } from '../limits.js';
import { cleanName, cleanObject, isUuid } from '../validate.js';
import type { Asset, AssetKind, AssetPatch, MemoryDeps } from '../types.js';
import { BRAND_NOT_FOUND, findBrand } from './brands.js';
import { removePhotosQuietly } from './shared.js';

export const ASSET_NOT_FOUND = 'Item não encontrado.';
const KINDS: ReadonlySet<string> = new Set(['product', 'character']);

export async function findAsset(deps: MemoryDeps, userId: string, assetId: unknown): Promise<Asset | null> {
  return isUuid(assetId) ? deps.repo.getAsset(userId, assetId) : null;
}

async function withReadUrls(deps: MemoryDeps, assets: Asset[]) {
  const paths = assets.flatMap((a) => a.photos.map((p) => p.path));
  const urls = paths.length > 0 ? await deps.storage.createReadUrls(paths, READ_URL_TTL_SECONDS) : {};
  return assets.map((a) => ({ ...a, photos: a.photos.map((p) => ({ ...p, url: urls[p.path] ?? null })) }));
}

async function pruneRecents(deps: MemoryDeps, userId: string, brandId: string): Promise<void> {
  const recents = (await deps.repo.listAssets(userId, brandId))
    .filter((a) => !a.pinned)
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  for (const stale of recents.slice(deps.limits.recentAssetsPerBrand)) {
    await removePhotosQuietly(deps, stale.photos.map((p) => p.path));
    await deps.repo.deleteAsset(userId, stale.id);
  }
}

export async function listAssets(deps: MemoryDeps, user: User, input: { brandId: unknown }): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  const assets = await deps.repo.listAssets(user.id, brand.id);
  return ok({ assets: await withReadUrls(deps, assets) });
}

export async function useAsset(
  deps: MemoryDeps,
  user: User,
  input: { brandId: unknown; kind: unknown; name: unknown; data: unknown; analysis: unknown }
): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  if (typeof input.kind !== 'string' || !KINDS.has(input.kind)) return fail(400, 'Tipo de item inválido.');
  const kind = input.kind as AssetKind;
  const name = cleanName(input.name);
  if (!name) return fail(400, 'Nome do item inválido.');
  const data = cleanObject(input.data, MAX_DATA_BYTES);
  if (!data) return fail(400, 'Dados do item inválidos.');
  // Ausente ou null = manter a análise que já existe.
  let analysis: Record<string, unknown> | undefined;
  if (input.analysis !== undefined && input.analysis !== null) {
    const parsed = cleanObject(input.analysis, MAX_DATA_BYTES);
    if (!parsed) return fail(400, 'Análise inválida.');
    analysis = parsed;
  }

  const lastUsedAt = deps.now().toISOString();
  const patch: AssetPatch = { data, lastUsedAt, ...(analysis ? { analysis } : {}) };
  const existing = await deps.repo.findAssetByName(user.id, brand.id, kind, name);
  if (existing) {
    return ok({ asset: await deps.repo.updateAsset(user.id, existing.id, patch), created: false });
  }

  let asset: Asset;
  try {
    asset = await deps.repo.insertAsset(user.id, {
      brandId: brand.id,
      kind,
      name,
      data,
      analysis: analysis ?? null,
      photos: [],
      pinned: false,
      lastUsedAt,
    });
  } catch (err) {
    // Requisição simultânea com o mesmo nome venceu a corrida (índice único): atualiza o dela.
    const winner = await deps.repo.findAssetByName(user.id, brand.id, kind, name);
    if (!winner) throw err;
    return ok({ asset: await deps.repo.updateAsset(user.id, winner.id, patch), created: false });
  }
  await pruneRecents(deps, user.id, brand.id);
  return ok({ asset, created: true });
}

export async function updateAsset(
  deps: MemoryDeps,
  user: User,
  input: { assetId: unknown; pinned: unknown; name: unknown; data: unknown; analysis: unknown }
): Promise<Result> {
  const asset = await findAsset(deps, user.id, input.assetId);
  if (!asset) return fail(404, ASSET_NOT_FOUND);
  const patch: AssetPatch = {};
  let unpinned = false;

  if (input.pinned !== undefined) {
    if (typeof input.pinned !== 'boolean') return fail(400, 'Valor inválido para fixar.');
    if (input.pinned && !asset.pinned) {
      const pinnedCount = (await deps.repo.listAssets(user.id, asset.brandId)).filter((a) => a.pinned).length;
      if (pinnedCount >= deps.limits.pinnedAssetsPerBrand) {
        return fail(
          409,
          `Você atingiu ${deps.limits.pinnedAssetsPerBrand} itens fixados nesta marca. Desafixe algum para continuar.`,
          { code: 'limit_reached', limit: 'pinnedAssets' }
        );
      }
    }
    if (!input.pinned && asset.pinned) {
      // Vira o recente mais novo, para a poda não apagá-lo logo em seguida.
      patch.lastUsedAt = deps.now().toISOString();
      unpinned = true;
    }
    patch.pinned = input.pinned;
  }
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    if (!name) return fail(400, 'Nome do item inválido.');
    if (
      name.toLowerCase() !== asset.name.toLowerCase() &&
      (await deps.repo.findAssetByName(user.id, asset.brandId, asset.kind, name))
    ) {
      return fail(409, 'Já existe um item com esse nome nesta marca.', { code: 'name_taken' });
    }
    patch.name = name;
  }
  if (input.data !== undefined) {
    const data = cleanObject(input.data, MAX_DATA_BYTES);
    if (!data) return fail(400, 'Dados do item inválidos.');
    patch.data = data;
  }
  if (input.analysis !== undefined) {
    if (input.analysis === null) {
      patch.analysis = null;
    } else {
      const analysis = cleanObject(input.analysis, MAX_DATA_BYTES);
      if (!analysis) return fail(400, 'Análise inválida.');
      patch.analysis = analysis;
    }
  }
  if (Object.keys(patch).length === 0) return fail(400, 'Nada para atualizar.');

  const updated = await deps.repo.updateAsset(user.id, asset.id, patch);
  if (!updated) return fail(404, ASSET_NOT_FOUND);
  if (unpinned) await pruneRecents(deps, user.id, asset.brandId);
  return ok({ asset: updated });
}

export async function deleteAsset(deps: MemoryDeps, user: User, input: { assetId: unknown }): Promise<Result> {
  const asset = await findAsset(deps, user.id, input.assetId);
  if (!asset) return fail(404, ASSET_NOT_FOUND);
  await removePhotosQuietly(deps, asset.photos.map((p) => p.path));
  await deps.repo.deleteAsset(user.id, asset.id);
  return ok();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- api/_lib/memory/service/assets.test.ts`
Expected: PASS (11/11)

- [ ] **Step 5: Typecheck e commit**

Run: `npx tsc --noEmit`
Expected: sem erros.

```bash
git add api/_lib/memory/service/assets.ts api/_lib/memory/service/assets.test.ts
git commit -m "$(cat <<'EOF'
feat: add brand memory assets service (auto-save recents, pinning, pruning)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Serviço de fotos (upload em lote, confirmação, remoção)

**Files:**
- Create: `api/_lib/memory/service/photos.ts`
- Test: `api/_lib/memory/service/photos.test.ts`

**Interfaces:**
- Consumes: `findAsset`, `ASSET_NOT_FOUND` (Task 4); `photoPath`, `isAssetPhotoPath`, `mimeFromPath` (Task 2); `removePhotosQuietly` (Task 3).
- Produces: `requestPhotoUploads(deps, user, { assetId, files })` → `{ uploads: UploadTicket[] }`; `confirmPhotos(deps, user, { assetId, paths })` → `{ asset }`; `removePhoto(deps, user, { assetId, path })` → `{ asset }`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// api/_lib/memory/service/photos.test.ts
import { describe, it, expect } from 'vitest';
import { confirmPhotos, removePhoto, requestPhotoUploads } from './photos.js';
import { photoPath } from '../paths.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from '../testing/fixtures.js';
import type { UploadTicket } from '../types.js';

async function setup(photoCount = 0) {
  const ctx = makeDeps();
  const brand = await seedBrand(ctx.deps, USER_A);
  const photos = Array.from({ length: photoCount }, (_, i) => ({
    path: photoPath(USER_A.id, brand.id, '00000000-0000-4000-8000-0000000000ff', `e0000000-0000-4000-8000-00000000000${i}`, 'image/jpeg'),
    mime: 'image/jpeg',
    size: 1,
  }));
  const asset = await seedAsset(ctx.deps, USER_A, brand.id, { photos, analysis: { resumo: 'antiga' } });
  return { ...ctx, brand, asset };
}

const jpeg = { mime: 'image/jpeg', size: 300_000 };

describe('requestPhotoUploads', () => {
  it('devolve um link por foto, com caminho gerado no prefixo do ativo', async () => {
    const { deps, brand, asset } = await setup();
    const res = await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [jpeg, { mime: 'image/png', size: 10 }] });
    expect(res.status).toBe(200);
    const uploads = res.body.uploads as UploadTicket[];
    expect(uploads).toHaveLength(2);
    expect(uploads[0].path.startsWith(`${USER_A.id}/${brand.id}/${asset.id}/`)).toBe(true);
    expect(uploads[1].path.endsWith('.png')).toBe(true);
  });

  it('400 para tipo não permitido, tamanho acima de 2 MB ou lista vazia', async () => {
    const { deps, asset } = await setup();
    expect((await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [{ mime: 'image/gif', size: 1 }] })).status).toBe(400);
    expect((await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [{ mime: 'image/jpeg', size: 3_000_000 }] })).status).toBe(400);
    expect((await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [] })).status).toBe(400);
  });

  it('409 quando passaria de 4 fotos no ativo', async () => {
    const { deps, asset } = await setup(3);
    const res = await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [jpeg, jpeg] });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'limit_reached', limit: 'photos' });
  });
});

describe('confirmPhotos', () => {
  it('registra as fotos enviadas e zera a análise; repetir não duplica', async () => {
    const { deps, storage, asset } = await setup();
    const { body } = await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [jpeg] });
    const [ticket] = body.uploads as UploadTicket[];
    simulateUpload(storage, ticket.path, 250_000, 'image/jpeg');

    const res = await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: [ticket.path] });
    expect(res.status).toBe(200);
    expect(res.body.asset).toMatchObject({ analysis: null, photos: [{ path: ticket.path, mime: 'image/jpeg', size: 250_000 }] });

    const again = await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: [ticket.path] });
    expect((again.body.asset as { photos: unknown[] }).photos).toHaveLength(1);
  });

  it('400 para caminho fora do prefixo do ativo (inclusive de outro usuário)', async () => {
    const { deps, storage, brand, asset } = await setup();
    const foreign = photoPath(USER_B.id, brand.id, asset.id, 'e0000000-0000-4000-8000-000000000001', 'image/jpeg');
    simulateUpload(storage, foreign);
    expect((await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: [foreign] })).status).toBe(400);
    expect((await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: ['../../x.jpg'] })).status).toBe(400);
  });

  it('400 photo_missing quando o arquivo não foi enviado', async () => {
    const { deps, asset } = await setup();
    const { body } = await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [jpeg] });
    const [ticket] = body.uploads as UploadTicket[];
    const res = await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: [ticket.path] });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'photo_missing' });
  });

  it('400 e remove o arquivo quando o tamanho real passa de 2 MB', async () => {
    const { deps, storage, asset } = await setup();
    const { body } = await requestPhotoUploads(deps, USER_A, { assetId: asset.id, files: [jpeg] });
    const [ticket] = body.uploads as UploadTicket[];
    simulateUpload(storage, ticket.path, 5_000_000);
    expect((await confirmPhotos(deps, USER_A, { assetId: asset.id, paths: [ticket.path] })).status).toBe(400);
    expect(storage.files.has(ticket.path)).toBe(false);
  });
});

describe('removePhoto', () => {
  it('remove do Storage e do ativo e zera a análise', async () => {
    const { deps, storage, asset } = await setup(1);
    const path = asset.photos[0].path;
    simulateUpload(storage, path);
    const res = await removePhoto(deps, USER_A, { assetId: asset.id, path });
    expect(res.status).toBe(200);
    expect(res.body.asset).toMatchObject({ photos: [], analysis: null });
    expect(storage.files.has(path)).toBe(false);
  });

  it('404 para foto que não pertence ao ativo ou ativo de outro usuário', async () => {
    const { deps, asset } = await setup(1);
    expect((await removePhoto(deps, USER_A, { assetId: asset.id, path: 'outra.jpg' })).status).toBe(404);
    expect((await removePhoto(deps, USER_B, { assetId: asset.id, path: asset.photos[0].path })).status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- api/_lib/memory/service/photos.test.ts`
Expected: FAIL — `Cannot find module './photos.js'`

- [ ] **Step 3: Implementar `api/_lib/memory/service/photos.ts`**

```ts
import { fail, ok, type Result, type User } from '../../billing/service/context.js';
import { MAX_PHOTO_BYTES } from '../limits.js';
import { isAssetPhotoPath, mimeFromPath, photoPath } from '../paths.js';
import { isAllowedMime, isPlainObject } from '../validate.js';
import type { MemoryDeps, Photo, PhotoMime } from '../types.js';
import { ASSET_NOT_FOUND, findAsset } from './assets.js';
import { removePhotosQuietly } from './shared.js';

const INVALID_LIST = 'Lista de fotos inválida.';

function photoLimit(deps: MemoryDeps): Result {
  return fail(409, `Cada item pode ter até ${deps.limits.photosPerAsset} fotos.`, {
    code: 'limit_reached',
    limit: 'photos',
  });
}

export async function requestPhotoUploads(
  deps: MemoryDeps,
  user: User,
  input: { assetId: unknown; files: unknown }
): Promise<Result> {
  const asset = await findAsset(deps, user.id, input.assetId);
  if (!asset) return fail(404, ASSET_NOT_FOUND);
  if (!Array.isArray(input.files) || input.files.length === 0 || input.files.length > deps.limits.photosPerAsset) {
    return fail(400, INVALID_LIST);
  }
  const files: { mime: PhotoMime; size: number }[] = [];
  for (const file of input.files as unknown[]) {
    if (
      !isPlainObject(file) ||
      !isAllowedMime(file.mime) ||
      typeof file.size !== 'number' ||
      !Number.isInteger(file.size) ||
      file.size <= 0 ||
      file.size > MAX_PHOTO_BYTES
    ) {
      return fail(400, 'Foto inválida: use JPEG, PNG ou WebP de até 2 MB.');
    }
    files.push({ mime: file.mime, size: file.size });
  }
  if (asset.photos.length + files.length > deps.limits.photosPerAsset) return photoLimit(deps);

  const paths = files.map((f) => photoPath(user.id, asset.brandId, asset.id, deps.newId(), f.mime));
  return ok({ uploads: await deps.storage.createUploadUrls(paths) });
}

export async function confirmPhotos(
  deps: MemoryDeps,
  user: User,
  input: { assetId: unknown; paths: unknown }
): Promise<Result> {
  const asset = await findAsset(deps, user.id, input.assetId);
  if (!asset) return fail(404, ASSET_NOT_FOUND);
  if (!Array.isArray(input.paths) || input.paths.length === 0 || input.paths.length > deps.limits.photosPerAsset) {
    return fail(400, INVALID_LIST);
  }
  const known = new Set(asset.photos.map((p) => p.path));
  const fresh: string[] = [];
  for (const path of input.paths as unknown[]) {
    if (!isAssetPhotoPath(path, user.id, asset.brandId, asset.id)) return fail(400, 'Caminho de foto inválido.');
    if (!known.has(path) && !fresh.includes(path)) fresh.push(path);
  }
  if (fresh.length === 0) return ok({ asset });
  if (asset.photos.length + fresh.length > deps.limits.photosPerAsset) return photoLimit(deps);

  const added: Photo[] = [];
  for (const path of fresh) {
    const info = await deps.storage.stat(path);
    if (!info) return fail(400, 'Foto não encontrada. Envie de novo.', { code: 'photo_missing' });
    if (info.size > MAX_PHOTO_BYTES) {
      await removePhotosQuietly(deps, [path]);
      return fail(400, 'Foto acima de 2 MB.');
    }
    added.push({ path, mime: info.mime ?? mimeFromPath(path), size: info.size });
  }
  const updated = await deps.repo.updateAsset(user.id, asset.id, {
    photos: [...asset.photos, ...added],
    analysis: null,
  });
  return updated ? ok({ asset: updated }) : fail(404, ASSET_NOT_FOUND);
}

export async function removePhoto(
  deps: MemoryDeps,
  user: User,
  input: { assetId: unknown; path: unknown }
): Promise<Result> {
  const asset = await findAsset(deps, user.id, input.assetId);
  if (!asset) return fail(404, ASSET_NOT_FOUND);
  if (typeof input.path !== 'string' || !asset.photos.some((p) => p.path === input.path)) {
    return fail(404, 'Foto não encontrada.');
  }
  const path = input.path;
  await removePhotosQuietly(deps, [path]);
  const updated = await deps.repo.updateAsset(user.id, asset.id, {
    photos: asset.photos.filter((p) => p.path !== path),
    analysis: null,
  });
  return updated ? ok({ asset: updated }) : fail(404, ASSET_NOT_FOUND);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- api/_lib/memory/service/photos.test.ts`
Expected: PASS (9/9)

- [ ] **Step 5: Typecheck e commit**

Run: `npx tsc --noEmit`
Expected: sem erros.

```bash
git add api/_lib/memory/service/photos.ts api/_lib/memory/service/photos.test.ts
git commit -m "$(cat <<'EOF'
feat: add brand memory photo upload, confirm and remove

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Biblioteca de prompts e importação do histórico do navegador

**Files:**
- Create: `api/_lib/memory/service/prompts.ts`
- Create: `api/_lib/memory/service/importLocal.ts`
- Test: `api/_lib/memory/service/prompts.test.ts`
- Test: `api/_lib/memory/service/importLocal.test.ts`

**Interfaces:**
- Consumes: `findBrand`, `BRAND_NOT_FOUND`, `ensureBrands` (Task 3); `findAsset` (Task 4); `cleanSearch`, `cleanKit`, `AGENTS` (Task 2).
- Produces:
  - `prompts.ts`: `ParsedPrompt`, `parsePrompt(raw: Record<string, unknown>): ParsedPrompt | { error: string }`, `encodeCursor(p)`, `decodeCursor(v)`, `listPrompts(deps, user, { brandId, q, favorite, cursor })` → `{ prompts, nextCursor }`, `savePrompt(deps, user, input)` → `{ prompt }`, `setPromptFavorite(deps, user, { promptId, favorite })`, `deletePrompt(deps, user, { promptId })`.
  - `importLocal.ts`: `importLocal(deps, user, { items, preferences })` → `{ brandId, imported, skipped, kitImported }`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// api/_lib/memory/service/prompts.test.ts
import { describe, it, expect } from 'vitest';
import { decodeCursor, deletePrompt, listPrompts, savePrompt, setPromptFavorite } from './prompts.js';
import { makeDeps, seedAsset, seedBrand, USER_A, USER_B } from '../testing/fixtures.js';
import type { PromptEntry } from '../types.js';

const base = { mode: 'video', agent: 'ugc', title: 'Sérum X — UGC', productName: 'Sérum X', deterministicPrompt: 'prompt', enhancedPrompt: undefined, state: { acao: 'aplica' } };
const list = (deps: Parameters<typeof listPrompts>[0], brandId: string, extra: Record<string, unknown> = {}) =>
  listPrompts(deps, USER_A, { brandId, q: undefined, favorite: undefined, cursor: undefined, ...extra });

describe('savePrompt', () => {
  it('salva e aparece no topo da lista', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const res = await savePrompt(deps, USER_A, { brandId: brand.id, ...base });
    expect(res.status).toBe(200);
    const listed = await list(deps, brand.id);
    expect(listed.body.prompts).toMatchObject([{ title: 'Sérum X — UGC', mode: 'video', agent: 'ugc' }]);
  });

  it('400 para modo, agente ou prompt inválidos', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await savePrompt(deps, USER_A, { brandId: brand.id, ...base, mode: 'audio' })).status).toBe(400);
    expect((await savePrompt(deps, USER_A, { brandId: brand.id, ...base, agent: 'x' })).status).toBe(400);
    expect((await savePrompt(deps, USER_A, { brandId: brand.id, ...base, deterministicPrompt: '' })).status).toBe(400);
  });

  it('descarta assetIds de outra marca ou de outro usuário', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const other = await seedBrand(deps, USER_A, 'Outra');
    const mine = await seedAsset(deps, USER_A, brand.id);
    const elsewhere = await seedAsset(deps, USER_A, other.id);
    const foreignBrand = await seedBrand(deps, USER_B);
    const foreign = await seedAsset(deps, USER_B, foreignBrand.id);
    const res = await savePrompt(deps, USER_A, { brandId: brand.id, ...base, assetIds: [mine.id, elsewhere.id, foreign.id, 'x'] });
    expect((res.body.prompt as PromptEntry).assetIds).toEqual([mine.id]);
  });
});

describe('listPrompts', () => {
  it('pagina de 20 em 20 com cursor, sem repetir', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    for (let i = 0; i < 25; i += 1) await savePrompt(deps, USER_A, { brandId: brand.id, ...base, title: `P${i}` });
    const first = await list(deps, brand.id);
    const page1 = first.body.prompts as PromptEntry[];
    expect(page1).toHaveLength(20);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await list(deps, brand.id, { cursor: first.body.nextCursor });
    const page2 = second.body.prompts as PromptEntry[];
    expect(page2).toHaveLength(5);
    expect(second.body.nextCursor).toBeNull();
    expect(new Set([...page1, ...page2].map((p) => p.id)).size).toBe(25);
  });

  it('busca por título ou produto, ignorando caracteres especiais, e filtra favoritos', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    await savePrompt(deps, USER_A, { brandId: brand.id, ...base, title: 'Batom', productName: 'Batom Vermelho' });
    const fav = await savePrompt(deps, USER_A, { brandId: brand.id, ...base, title: 'Creme', productName: 'Creme Noite' });
    await setPromptFavorite(deps, USER_A, { promptId: (fav.body.prompt as PromptEntry).id, favorite: true });
    expect((await list(deps, brand.id, { q: 'vermelho,()' })).body.prompts).toMatchObject([{ title: 'Batom' }]);
    expect((await list(deps, brand.id, { favorite: 'true' })).body.prompts).toMatchObject([{ title: 'Creme' }]);
  });

  it('400 para cursor adulterado ou busca longa demais', async () => {
    const { deps } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    expect((await list(deps, brand.id, { cursor: 'x|y|z' })).status).toBe(400);
    expect((await list(deps, brand.id, { q: 'a'.repeat(101) })).status).toBe(400);
    expect(decodeCursor('2026-01-01T00:00:00.000Z|nao-uuid')).toBeNull();
  });
});

describe('setPromptFavorite / deletePrompt', () => {
  it('404 para prompt de outro usuário; o dono consegue favoritar e apagar', async () => {
    const { deps, repo } = makeDeps();
    const brand = await seedBrand(deps, USER_A);
    const saved = await savePrompt(deps, USER_A, { brandId: brand.id, ...base });
    const id = (saved.body.prompt as PromptEntry).id;
    expect((await setPromptFavorite(deps, USER_B, { promptId: id, favorite: true })).status).toBe(404);
    expect((await deletePrompt(deps, USER_B, { promptId: id })).status).toBe(404);
    expect((await setPromptFavorite(deps, USER_A, { promptId: id, favorite: 'sim' })).status).toBe(400);
    expect((await setPromptFavorite(deps, USER_A, { promptId: id, favorite: true })).body).toMatchObject({ prompt: { favorite: true } });
    expect((await deletePrompt(deps, USER_A, { promptId: id })).status).toBe(200);
    expect(repo.prompts).toHaveLength(0);
  });
});
```

```ts
// api/_lib/memory/service/importLocal.test.ts
import { describe, it, expect } from 'vitest';
import { importLocal } from './importLocal.js';
import { makeDeps, USER_A } from '../testing/fixtures.js';

const item = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  timestamp: Date.UTC(2026, 3, 1),
  mode: 'image',
  agent: 'pov',
  productName: 'Sérum X',
  title: `Prompt ${id}`,
  deterministicPrompt: 'texto',
  imageState: { cenario: 'banheiro' },
  ...extra,
});

describe('importLocal', () => {
  it('importa na "Minha marca", preservando a data original, e pula itens inválidos', async () => {
    const { deps, repo } = makeDeps();
    const res = await importLocal(deps, USER_A, {
      items: [item('1'), item('2'), item('ruim', { mode: 'audio' }), 'lixo'],
      preferences: undefined,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ imported: 2, skipped: 2, kitImported: false });
    const brand = repo.brands[0];
    expect(brand).toMatchObject({ name: 'Minha marca', isDefault: true });
    expect(repo.prompts[0]).toMatchObject({ brandId: brand.id, legacyId: '1', createdAt: '2026-04-01T00:00:00.000Z', state: { cenario: 'banheiro' } });
  });

  it('segunda importação não duplica', async () => {
    const { deps, repo } = makeDeps();
    await importLocal(deps, USER_A, { items: [item('1')], preferences: undefined });
    const again = await importLocal(deps, USER_A, { items: [item('1'), item('1')], preferences: undefined });
    expect(again.body).toMatchObject({ imported: 0, skipped: 2 });
    expect(repo.prompts).toHaveLength(1);
  });

  it('usa as preferências como kit só se o kit ainda estiver vazio', async () => {
    const { deps, repo } = makeDeps();
    const first = await importLocal(deps, USER_A, { items: [], preferences: { autoApply: true, preferredAgent: 'ugc' } });
    expect(first.body).toMatchObject({ kitImported: true });
    const second = await importLocal(deps, USER_A, { items: [], preferences: { preferredAgent: 'pov' } });
    expect(second.body).toMatchObject({ kitImported: false });
    expect(repo.brands[0].kit).toEqual({ autoApply: true, preferredAgent: 'ugc' });
  });

  it('400 para lista que não é array ou grande demais', async () => {
    const { deps } = makeDeps();
    expect((await importLocal(deps, USER_A, { items: 'x', preferences: undefined })).status).toBe(400);
    expect((await importLocal(deps, USER_A, { items: Array.from({ length: 51 }, (_, i) => item(String(i))), preferences: undefined })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- api/_lib/memory/service/prompts.test.ts api/_lib/memory/service/importLocal.test.ts`
Expected: FAIL — `Cannot find module './prompts.js'` e `'./importLocal.js'`

- [ ] **Step 3: Implementar `api/_lib/memory/service/prompts.ts`**

```ts
import { fail, ok, type Result, type User } from '../../billing/service/context.js';
import {
  MAX_PROMPT_ASSETS,
  MAX_PROMPT_BYTES,
  MAX_QUERY_LENGTH,
  MAX_STATE_BYTES,
  MAX_TITLE_LENGTH,
  PROMPTS_PAGE_SIZE,
} from '../limits.js';
import { AGENTS, cleanName, cleanObject, cleanSearch, cleanText, isUuid } from '../validate.js';
import type { MemoryDeps } from '../types.js';
import { findAsset } from './assets.js';
import { BRAND_NOT_FOUND, findBrand } from './brands.js';

const PROMPT_NOT_FOUND = 'Prompt não encontrado.';

export interface ParsedPrompt {
  mode: 'video' | 'image';
  agent: string | null;
  title: string;
  productName: string | null;
  deterministicPrompt: string;
  enhancedPrompt: string | null;
  state: Record<string, unknown> | null;
}

const isBlank = (value: unknown) => value === undefined || value === null || value === '';

export function parsePrompt(raw: Record<string, unknown>): ParsedPrompt | { error: string } {
  if (raw.mode !== 'video' && raw.mode !== 'image') return { error: 'Modo inválido.' };
  let agent: string | null = null;
  if (!isBlank(raw.agent)) {
    if (typeof raw.agent !== 'string' || !AGENTS.has(raw.agent)) return { error: 'Agente inválido.' };
    agent = raw.agent;
  }
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) return { error: 'Título inválido.' };
  let productName: string | null = null;
  if (!isBlank(raw.productName)) {
    productName = cleanName(raw.productName);
    if (!productName) return { error: 'Nome do produto inválido.' };
  }
  const deterministicPrompt = cleanText(raw.deterministicPrompt, MAX_PROMPT_BYTES);
  if (!deterministicPrompt) return { error: 'Prompt inválido.' };
  let enhancedPrompt: string | null = null;
  if (!isBlank(raw.enhancedPrompt)) {
    enhancedPrompt = cleanText(raw.enhancedPrompt, MAX_PROMPT_BYTES);
    if (!enhancedPrompt) return { error: 'Prompt aprimorado inválido.' };
  }
  let state: Record<string, unknown> | null = null;
  if (raw.state !== undefined && raw.state !== null) {
    state = cleanObject(raw.state, MAX_STATE_BYTES);
    if (!state) return { error: 'Estado do prompt inválido.' };
  }
  return { mode: raw.mode, agent, title, productName, deterministicPrompt, enhancedPrompt, state };
}

export function encodeCursor(entry: { createdAt: string; id: string }): string {
  return `${entry.createdAt}|${entry.id}`;
}

export function decodeCursor(value: unknown): { createdAt: string; id: string } | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('|');
  if (parts.length !== 2) return null;
  const [createdAt, id] = parts;
  if (!isUuid(id) || Number.isNaN(Date.parse(createdAt))) return null;
  return { createdAt, id };
}

export async function listPrompts(
  deps: MemoryDeps,
  user: User,
  input: { brandId: unknown; q: unknown; favorite: unknown; cursor: unknown }
): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  let q: string | undefined;
  if (!isBlank(input.q)) {
    if (typeof input.q !== 'string' || input.q.length > MAX_QUERY_LENGTH) return fail(400, 'Busca inválida.');
    q = cleanSearch(input.q);
  }
  let before: { createdAt: string; id: string } | undefined;
  if (!isBlank(input.cursor)) {
    const decoded = decodeCursor(input.cursor);
    if (!decoded) return fail(400, 'Cursor inválido.');
    before = decoded;
  }
  const favorite = input.favorite === true || input.favorite === 'true' ? true : undefined;
  const rows = await deps.repo.listPrompts(user.id, brand.id, { q, favorite, before, limit: PROMPTS_PAGE_SIZE + 1 });
  const page = rows.slice(0, PROMPTS_PAGE_SIZE);
  const nextCursor = rows.length > PROMPTS_PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null;
  return ok({ prompts: page, nextCursor });
}

export async function savePrompt(deps: MemoryDeps, user: User, input: Record<string, unknown>): Promise<Result> {
  const brand = await findBrand(deps, user.id, input.brandId);
  if (!brand) return fail(404, BRAND_NOT_FOUND);
  const parsed = parsePrompt(input);
  if ('error' in parsed) return fail(400, parsed.error);
  const assetIds: string[] = [];
  if (input.assetIds !== undefined) {
    if (!Array.isArray(input.assetIds) || input.assetIds.length > MAX_PROMPT_ASSETS) {
      return fail(400, 'Lista de itens inválida.');
    }
    for (const id of input.assetIds as unknown[]) {
      const asset = await findAsset(deps, user.id, id);
      if (asset && asset.brandId === brand.id && !assetIds.includes(asset.id)) assetIds.push(asset.id);
    }
  }
  const prompt = await deps.repo.insertPrompt(user.id, { ...parsed, brandId: brand.id, assetIds, legacyId: null });
  return ok({ prompt });
}

export async function setPromptFavorite(
  deps: MemoryDeps,
  user: User,
  input: { promptId: unknown; favorite: unknown }
): Promise<Result> {
  if (!isUuid(input.promptId)) return fail(404, PROMPT_NOT_FOUND);
  if (typeof input.favorite !== 'boolean') return fail(400, 'Valor inválido para favorito.');
  const prompt = await deps.repo.setPromptFavorite(user.id, input.promptId, input.favorite);
  return prompt ? ok({ prompt }) : fail(404, PROMPT_NOT_FOUND);
}

export async function deletePrompt(deps: MemoryDeps, user: User, input: { promptId: unknown }): Promise<Result> {
  if (!isUuid(input.promptId)) return fail(404, PROMPT_NOT_FOUND);
  const prompt = await deps.repo.getPrompt(user.id, input.promptId);
  if (!prompt) return fail(404, PROMPT_NOT_FOUND);
  await deps.repo.deletePrompt(user.id, prompt.id);
  return ok();
}
```

- [ ] **Step 4: Implementar `api/_lib/memory/service/importLocal.ts`**

```ts
import { fail, ok, type Result, type User } from '../../billing/service/context.js';
import { MAX_IMPORT_ITEMS } from '../limits.js';
import { cleanKit, isPlainObject } from '../validate.js';
import type { MemoryDeps } from '../types.js';
import { ensureBrands } from './brands.js';
import { parsePrompt, type ParsedPrompt } from './prompts.js';

function toIso(timestamp: unknown, fallback: Date): string {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback.toISOString();
}

// Importação única do histórico do navegador (PromptHistoryItem do frontend) para a marca padrão.
export async function importLocal(
  deps: MemoryDeps,
  user: User,
  input: { items: unknown; preferences: unknown }
): Promise<Result> {
  if (!Array.isArray(input.items) || input.items.length > MAX_IMPORT_ITEMS) return fail(400, 'Histórico inválido.');
  const brands = await ensureBrands(deps, user.id);
  const target = brands.find((b) => b.isDefault) ?? brands[0];

  const candidates: { legacyId: string; createdAt: string; value: ParsedPrompt }[] = [];
  let skipped = 0;
  for (const raw of input.items as unknown[]) {
    if (!isPlainObject(raw) || typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 100) {
      skipped += 1;
      continue;
    }
    const parsed = parsePrompt({
      mode: raw.mode,
      agent: raw.agent,
      title: raw.title,
      productName: raw.productName,
      deterministicPrompt: raw.deterministicPrompt,
      enhancedPrompt: raw.enhancedPrompt,
      state: raw.videoState ?? raw.imageState,
    });
    if ('error' in parsed) {
      skipped += 1;
      continue;
    }
    candidates.push({ legacyId: raw.id, createdAt: toIso(raw.timestamp, deps.now()), value: parsed });
  }

  const seen = new Set(await deps.repo.existingLegacyIds(user.id, candidates.map((c) => c.legacyId)));
  let imported = 0;
  for (const candidate of candidates) {
    if (seen.has(candidate.legacyId)) {
      skipped += 1;
      continue;
    }
    seen.add(candidate.legacyId);
    await deps.repo.insertPrompt(user.id, {
      ...candidate.value,
      brandId: target.id,
      assetIds: [],
      legacyId: candidate.legacyId,
      createdAt: candidate.createdAt,
    });
    imported += 1;
  }

  let kitImported = false;
  if (input.preferences !== undefined && Object.keys(target.kit).length === 0) {
    const kit = cleanKit(input.preferences);
    if (kit && Object.keys(kit).length > 0) {
      await deps.repo.updateBrand(user.id, target.id, { kit });
      kitImported = true;
    }
  }
  return ok({ brandId: target.id, imported, skipped, kitImported });
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- api/_lib/memory/service/prompts.test.ts api/_lib/memory/service/importLocal.test.ts`
Expected: PASS (7/7 + 4/4)

- [ ] **Step 6: Typecheck e commit**

Run: `npx tsc --noEmit`
Expected: sem erros.

```bash
git add api/_lib/memory/service/prompts.ts api/_lib/memory/service/prompts.test.ts \
  api/_lib/memory/service/importLocal.ts api/_lib/memory/service/importLocal.test.ts
git commit -m "$(cat <<'EOF'
feat: add prompt library and local history import

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Roteador, exclusão total do usuário e matriz de isolamento

**Files:**
- Create: `api/_lib/memory/router.ts`
- Create: `api/_lib/memory/service/deleteAll.ts`
- Test: `api/_lib/memory/router.test.ts`
- Test: `api/_lib/memory/service/deleteAll.test.ts`

**Interfaces:**
- Consumes: todos os serviços das Tasks 3-6.
- Produces: `routeMemory(deps, user, action, method, input): Promise<Result>`, `queryInput(query: Record<string, string | string[] | undefined>): Record<string, unknown>` (consumidos pela rota da Task 8); `deleteAllUserMemory(deps, userId): Promise<void>` (uso do suporte).

- [ ] **Step 1: Escrever os testes que falham**

```ts
// api/_lib/memory/router.test.ts
import { describe, it, expect } from 'vitest';
import { queryInput, routeMemory } from './router.js';
import { photoPath } from './paths.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from './testing/fixtures.js';

describe('routeMemory', () => {
  it('404 para ação desconhecida (inclusive chaves de protótipo) e 405 para método errado', async () => {
    const { deps } = makeDeps();
    expect((await routeMemory(deps, USER_A, 'nada', 'GET', {})).status).toBe(404);
    expect((await routeMemory(deps, USER_A, '__proto__', 'GET', {})).status).toBe(404);
    expect((await routeMemory(deps, USER_A, 'constructor', 'GET', {})).status).toBe(404);
    expect((await routeMemory(deps, USER_A, 'use-asset', 'GET', {})).status).toBe(405);
    expect((await routeMemory(deps, USER_A, 'import-local', 'DELETE', {})).status).toBe(405);
  });

  it('só repassa campos conhecidos: user_id no corpo é ignorado', async () => {
    const { deps, repo } = makeDeps();
    const res = await routeMemory(deps, USER_A, 'brands', 'POST', { name: 'Loja', user_id: USER_B.id, isDefault: true });
    expect(res.status).toBe(200);
    expect(repo.brands.find((b) => b.name === 'Loja')).toMatchObject({ userId: USER_A.id, isDefault: false });
  });
});

describe('queryInput', () => {
  it('pega o primeiro valor de cada parâmetro e ignora "action"', () => {
    expect(queryInput({ action: 'prompts', brandId: 'x', q: ['a', 'b'], vazio: undefined })).toEqual({ brandId: 'x', q: 'a' });
  });
});

describe('isolamento entre usuários', () => {
  async function scenario() {
    const ctx = makeDeps();
    const brand = await seedBrand(ctx.deps, USER_A, 'Marca A', true);
    await seedBrand(ctx.deps, USER_A, 'Marca A2');
    await seedBrand(ctx.deps, USER_B, 'Marca B', true);
    const asset = await seedAsset(ctx.deps, USER_A, brand.id, { pinned: true, analysis: { x: 1 } });
    const path = photoPath(USER_A.id, brand.id, asset.id, 'e0000000-0000-4000-8000-000000000001', 'image/jpeg');
    simulateUpload(ctx.storage, path);
    await ctx.repo.updateAsset(USER_A.id, asset.id, { photos: [{ path, mime: 'image/jpeg', size: 1 }] });
    const prompt = await ctx.repo.insertPrompt(USER_A.id, {
      brandId: brand.id, mode: 'video', agent: null, title: 'segredo', productName: null,
      deterministicPrompt: 'p', enhancedPrompt: null, state: null, assetIds: [], legacyId: null,
    });
    const snapshot = JSON.stringify({ b: ctx.repo.brands, a: ctx.repo.assets, p: ctx.repo.prompts });
    return { ...ctx, brand, asset, prompt, path, snapshot };
  }

  const attempts: [string, string, (s: Awaited<ReturnType<typeof scenario>>) => Record<string, unknown>][] = [
    ['brands', 'PATCH', (s) => ({ brandId: s.brand.id, name: 'hack' })],
    ['brands', 'DELETE', (s) => ({ brandId: s.brand.id })],
    ['assets', 'GET', (s) => ({ brandId: s.brand.id })],
    ['assets', 'PATCH', (s) => ({ assetId: s.asset.id, pinned: false })],
    ['assets', 'DELETE', (s) => ({ assetId: s.asset.id })],
    ['use-asset', 'POST', (s) => ({ brandId: s.brand.id, kind: 'product', name: 'Sérum X', data: { nome: 'hack' } })],
    ['photo-upload', 'POST', (s) => ({ assetId: s.asset.id, files: [{ mime: 'image/jpeg', size: 1 }] })],
    ['photo-confirm', 'POST', (s) => ({ assetId: s.asset.id, paths: [s.path] })],
    ['photo-remove', 'POST', (s) => ({ assetId: s.asset.id, path: s.path })],
    ['prompts', 'GET', (s) => ({ brandId: s.brand.id })],
    ['prompts', 'POST', (s) => ({ brandId: s.brand.id, mode: 'video', title: 't', deterministicPrompt: 'p' })],
    ['prompts', 'PATCH', (s) => ({ promptId: s.prompt.id, favorite: true })],
    ['prompts', 'DELETE', (s) => ({ promptId: s.prompt.id })],
  ];

  it.each(attempts)('%s %s com ids do usuário A responde 404 para o usuário B e não altera nada', async (action, method, build) => {
    const s = await scenario();
    const res = await routeMemory(s.deps, USER_B, action, method, build(s));
    expect(res.status).toBe(404);
    expect(JSON.stringify({ b: s.repo.brands, a: s.repo.assets, p: s.repo.prompts })).toBe(s.snapshot);
    expect(s.storage.files.has(s.path)).toBe(true);
  });

  it('GET brands de B mostra só as marcas de B', async () => {
    const s = await scenario();
    const res = await routeMemory(s.deps, USER_B, 'brands', 'GET', {});
    expect(res.body.brands).toMatchObject([{ name: 'Marca B' }]);
  });
});
```

```ts
// api/_lib/memory/service/deleteAll.test.ts
import { describe, it, expect } from 'vitest';
import { deleteAllUserMemory } from './deleteAll.js';
import { makeDeps, seedAsset, seedBrand, simulateUpload, USER_A, USER_B } from '../testing/fixtures.js';

describe('deleteAllUserMemory', () => {
  it('apaga marcas, ativos, prompts e fotos do usuário, e nada de outro usuário', async () => {
    const { deps, repo, storage } = makeDeps();
    const a = await seedBrand(deps, USER_A, 'A', true);
    const b = await seedBrand(deps, USER_B, 'B', true);
    simulateUpload(storage, 'a.jpg');
    simulateUpload(storage, 'b.jpg');
    await seedAsset(deps, USER_A, a.id, { photos: [{ path: 'a.jpg', mime: 'image/jpeg', size: 1 }] });
    await seedAsset(deps, USER_B, b.id, { photos: [{ path: 'b.jpg', mime: 'image/jpeg', size: 1 }] });

    await deleteAllUserMemory(deps, USER_A.id);

    expect(repo.brands.map((x) => x.userId)).toEqual([USER_B.id]);
    expect(repo.assets.map((x) => x.userId)).toEqual([USER_B.id]);
    expect(storage.files.has('a.jpg')).toBe(false);
    expect(storage.files.has('b.jpg')).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- api/_lib/memory/router.test.ts api/_lib/memory/service/deleteAll.test.ts`
Expected: FAIL — `Cannot find module './router.js'` e `'./deleteAll.js'`

- [ ] **Step 3: Implementar `api/_lib/memory/service/deleteAll.ts`**

```ts
import type { MemoryDeps } from '../types.js';

// Pedido de exclusão (LGPD), executado pelo suporte. Diferente das outras remoções, uma falha
// no Storage aqui propaga: o suporte precisa saber que a exclusão não terminou.
// Uploads nunca confirmados sob {userId}/ são removidos pela limpeza diária de órfãs.
export async function deleteAllUserMemory(deps: MemoryDeps, userId: string): Promise<void> {
  const assets = await deps.repo.listAllAssets(userId);
  const paths = assets.flatMap((a) => a.photos.map((p) => p.path));
  if (paths.length > 0) await deps.storage.remove(paths);
  await deps.repo.deleteAllBrands(userId);
}
```

- [ ] **Step 4: Implementar `api/_lib/memory/router.ts`**

```ts
import { fail, type Result, type User } from '../billing/service/context.js';
import type { MemoryDeps } from './types.js';
import { createBrand, deleteBrand, listBrands, updateBrand } from './service/brands.js';
import { deleteAsset, listAssets, updateAsset, useAsset } from './service/assets.js';
import { confirmPhotos, removePhoto, requestPhotoUploads } from './service/photos.js';
import { deletePrompt, listPrompts, savePrompt, setPromptFavorite } from './service/prompts.js';
import { importLocal } from './service/importLocal.js';

type Input = Record<string, unknown>;
type Handler = (deps: MemoryDeps, user: User, input: Input) => Promise<Result>;

// Só campos conhecidos chegam aos serviços; o resto (inclusive user_id) é descartado.
const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  brands: {
    GET: (d, u) => listBrands(d, u),
    POST: (d, u, i) => createBrand(d, u, { name: i.name }),
    PATCH: (d, u, i) => updateBrand(d, u, { brandId: i.brandId, name: i.name, kit: i.kit }),
    DELETE: (d, u, i) => deleteBrand(d, u, { brandId: i.brandId }),
  },
  assets: {
    GET: (d, u, i) => listAssets(d, u, { brandId: i.brandId }),
    PATCH: (d, u, i) =>
      updateAsset(d, u, { assetId: i.assetId, pinned: i.pinned, name: i.name, data: i.data, analysis: i.analysis }),
    DELETE: (d, u, i) => deleteAsset(d, u, { assetId: i.assetId }),
  },
  'use-asset': {
    POST: (d, u, i) =>
      useAsset(d, u, { brandId: i.brandId, kind: i.kind, name: i.name, data: i.data, analysis: i.analysis }),
  },
  'photo-upload': { POST: (d, u, i) => requestPhotoUploads(d, u, { assetId: i.assetId, files: i.files }) },
  'photo-confirm': { POST: (d, u, i) => confirmPhotos(d, u, { assetId: i.assetId, paths: i.paths }) },
  'photo-remove': { POST: (d, u, i) => removePhoto(d, u, { assetId: i.assetId, path: i.path }) },
  prompts: {
    GET: (d, u, i) => listPrompts(d, u, { brandId: i.brandId, q: i.q, favorite: i.favorite, cursor: i.cursor }),
    POST: (d, u, i) =>
      savePrompt(d, u, {
        brandId: i.brandId,
        mode: i.mode,
        agent: i.agent,
        title: i.title,
        productName: i.productName,
        deterministicPrompt: i.deterministicPrompt,
        enhancedPrompt: i.enhancedPrompt,
        state: i.state,
        assetIds: i.assetIds,
      }),
    PATCH: (d, u, i) => setPromptFavorite(d, u, { promptId: i.promptId, favorite: i.favorite }),
    DELETE: (d, u, i) => deletePrompt(d, u, { promptId: i.promptId }),
  },
  'import-local': { POST: (d, u, i) => importLocal(d, u, { items: i.items, preferences: i.preferences }) },
};

export async function routeMemory(
  deps: MemoryDeps,
  user: User,
  action: string,
  method: string,
  input: Input
): Promise<Result> {
  const route = Object.prototype.hasOwnProperty.call(ROUTES, action) ? ROUTES[action] : undefined;
  if (!route) return fail(404, 'Rota não encontrada.');
  const handler = Object.prototype.hasOwnProperty.call(route, method) ? route[method] : undefined;
  if (!handler) return fail(405, 'Método não permitido.');
  return handler(deps, user, input);
}

// GET e DELETE recebem os parâmetros pela query string.
export function queryInput(query: Record<string, string | string[] | undefined>): Input {
  const input: Input = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === 'action') continue;
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') input[key] = first;
  }
  return input;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- api/_lib/memory/router.test.ts api/_lib/memory/service/deleteAll.test.ts`
Expected: PASS (17/17 + 1/1)

- [ ] **Step 6: Suíte inteira, typecheck e commit**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, sem erros de tipo.

```bash
git add api/_lib/memory/router.ts api/_lib/memory/router.test.ts \
  api/_lib/memory/service/deleteAll.ts api/_lib/memory/service/deleteAll.test.ts
git commit -m "$(cat <<'EOF'
feat: add brand memory router, full-user deletion and isolation tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Adaptadores Supabase, rota HTTP e limpeza no cron

**Files:**
- Create: `api/_lib/memory/repo.ts`
- Create: `api/_lib/memory/storage.ts`
- Create: `api/_lib/memory/deps.ts`
- Create: `api/_lib/memory/cleanup.ts`
- Create: `api/memory/[action].ts`
- Modify: `api/cron/billing.ts`

**Interfaces:**
- Consumes: `MemoryRepo`, `StoragePort`, `MemoryDeps` (Task 2); `MEMORY_LIMITS` (Task 2); `routeMemory`, `queryInput` (Task 7); `requireIpRateLimit`, `authenticate`, `requireActiveSubscription`, `logError`, `logWarn`, `errorName` (existentes); tabelas, bucket e função da Task 1.
- Produces: `createSupabaseMemoryRepo(client?)`, `createSupabaseStorage(client?)`, `buildMemoryDeps()`, `cleanupOrphanPhotos(client?, storage?, now?): Promise<number>`, rota `/api/memory/[action]`.

Sem teste automatizado — mesmo padrão dos outros adaptadores Supabase e rotas deste projeto. Verificação ao vivo na Task 9.

- [ ] **Step 1: Implementar `api/_lib/memory/repo.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import type { Asset, AssetPatch, Brand, MemoryRepo, PromptEntry } from './types.js';

type Row = Record<string, any>;

const toBrand = (r: Row): Brand => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  kit: r.kit ?? {},
  isDefault: r.is_default,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toAsset = (r: Row): Asset => ({
  id: r.id,
  brandId: r.brand_id,
  userId: r.user_id,
  kind: r.kind,
  name: r.name,
  data: r.data,
  analysis: r.analysis,
  photos: r.photos ?? [],
  pinned: r.pinned,
  lastUsedAt: r.last_used_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toPrompt = (r: Row): PromptEntry => ({
  id: r.id,
  brandId: r.brand_id,
  userId: r.user_id,
  mode: r.mode,
  agent: r.agent,
  title: r.title,
  productName: r.product_name,
  deterministicPrompt: r.deterministic_prompt,
  enhancedPrompt: r.enhanced_prompt,
  state: r.state,
  assetIds: r.asset_ids ?? [],
  favorite: r.favorite,
  legacyId: r.legacy_id,
  createdAt: r.created_at,
});

function assetPatchRow(patch: AssetPatch): Row {
  const row: Row = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.data !== undefined) row.data = patch.data;
  if (patch.analysis !== undefined) row.analysis = patch.analysis;
  if (patch.photos !== undefined) row.photos = patch.photos;
  if (patch.pinned !== undefined) row.pinned = patch.pinned;
  if (patch.lastUsedAt !== undefined) row.last_used_at = patch.lastUsedAt;
  return row;
}

// A service role ignora o RLS: TODA consulta abaixo filtra por user_id. Nunca remover esse filtro.
export function createSupabaseMemoryRepo(client: SupabaseClient = supabaseAdmin): MemoryRepo {
  const brands = () => client.from('brands');
  const assets = () => client.from('brand_assets');
  const prompts = () => client.from('prompt_library');

  return {
    async listBrands(userId) {
      const { data, error } = await brands().select('*').eq('user_id', userId).order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toBrand);
    },
    async getBrand(userId, brandId) {
      const { data, error } = await brands().select('*').eq('user_id', userId).eq('id', brandId).maybeSingle();
      if (error) throw error;
      return data ? toBrand(data) : null;
    },
    async insertBrand(userId, input) {
      const { data, error } = await brands()
        .insert({ user_id: userId, name: input.name, kit: input.kit, is_default: input.isDefault })
        .select('*')
        .single();
      if (error) throw error;
      return toBrand(data);
    },
    async updateBrand(userId, brandId, patch) {
      const row: Row = { updated_at: new Date().toISOString() };
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.kit !== undefined) row.kit = patch.kit;
      if (patch.isDefault !== undefined) row.is_default = patch.isDefault;
      const { data, error } = await brands().update(row).eq('user_id', userId).eq('id', brandId).select('*').maybeSingle();
      if (error) throw error;
      return data ? toBrand(data) : null;
    },
    async deleteBrand(userId, brandId) {
      const { error } = await brands().delete().eq('user_id', userId).eq('id', brandId);
      if (error) throw error;
    },

    async listAssets(userId, brandId) {
      const { data, error } = await assets()
        .select('*')
        .eq('user_id', userId)
        .eq('brand_id', brandId)
        .order('last_used_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(toAsset);
    },
    async listAllAssets(userId) {
      const { data, error } = await assets().select('*').eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map(toAsset);
    },
    async getAsset(userId, assetId) {
      const { data, error } = await assets().select('*').eq('user_id', userId).eq('id', assetId).maybeSingle();
      if (error) throw error;
      return data ? toAsset(data) : null;
    },
    async findAssetByName(userId, brandId, kind, name) {
      // Comparação em JS (no máximo ~50 linhas por marca e tipo) em vez de `ilike`, que trataria
      // `*`, `%` e `_` do nome como curingas.
      const { data, error } = await assets()
        .select('*')
        .eq('user_id', userId)
        .eq('brand_id', brandId)
        .eq('kind', kind);
      if (error) throw error;
      const target = name.toLowerCase();
      const row = (data ?? []).find((r: Row) => String(r.name).toLowerCase() === target);
      return row ? toAsset(row) : null;
    },
    async insertAsset(userId, input) {
      const { data, error } = await assets()
        .insert({
          user_id: userId,
          brand_id: input.brandId,
          kind: input.kind,
          name: input.name,
          data: input.data,
          analysis: input.analysis,
          photos: input.photos,
          pinned: input.pinned,
          last_used_at: input.lastUsedAt,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toAsset(data);
    },
    async updateAsset(userId, assetId, patch) {
      const { data, error } = await assets()
        .update(assetPatchRow(patch))
        .eq('user_id', userId)
        .eq('id', assetId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? toAsset(data) : null;
    },
    async deleteAsset(userId, assetId) {
      const { error } = await assets().delete().eq('user_id', userId).eq('id', assetId);
      if (error) throw error;
    },

    async listPrompts(userId, brandId, query) {
      let request = prompts().select('*').eq('user_id', userId).eq('brand_id', brandId);
      if (query.favorite) request = request.eq('favorite', true);
      // `q` já chega higienizado (só letras, números e espaços); o cursor foi validado no serviço.
      const groups: string[] = [];
      if (query.q) groups.push(`or(title.ilike.*${query.q}*,product_name.ilike.*${query.q}*)`);
      if (query.before) {
        const { createdAt, id } = query.before;
        groups.push(`or(created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt.${id}))`);
      }
      if (groups.length > 0) request = request.or(`and(${groups.join(',')})`);
      const { data, error } = await request
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(query.limit);
      if (error) throw error;
      return (data ?? []).map(toPrompt);
    },
    async getPrompt(userId, promptId) {
      const { data, error } = await prompts().select('*').eq('user_id', userId).eq('id', promptId).maybeSingle();
      if (error) throw error;
      return data ? toPrompt(data) : null;
    },
    async insertPrompt(userId, input) {
      const row: Row = {
        user_id: userId,
        brand_id: input.brandId,
        mode: input.mode,
        agent: input.agent,
        title: input.title,
        product_name: input.productName,
        deterministic_prompt: input.deterministicPrompt,
        enhanced_prompt: input.enhancedPrompt,
        state: input.state,
        asset_ids: input.assetIds,
        legacy_id: input.legacyId,
      };
      if (input.createdAt) row.created_at = input.createdAt;
      const { data, error } = await prompts().insert(row).select('*').single();
      if (error) throw error;
      return toPrompt(data);
    },
    async setPromptFavorite(userId, promptId, favorite) {
      const { data, error } = await prompts()
        .update({ favorite })
        .eq('user_id', userId)
        .eq('id', promptId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? toPrompt(data) : null;
    },
    async deletePrompt(userId, promptId) {
      const { error } = await prompts().delete().eq('user_id', userId).eq('id', promptId);
      if (error) throw error;
    },
    async existingLegacyIds(userId, legacyIds) {
      if (legacyIds.length === 0) return [];
      const { data, error } = await prompts().select('legacy_id').eq('user_id', userId).in('legacy_id', legacyIds);
      if (error) throw error;
      return (data ?? []).map((r: Row) => r.legacy_id as string);
    },
    async deleteAllBrands(userId) {
      const { error } = await brands().delete().eq('user_id', userId);
      if (error) throw error;
    },
  };
}
```

- [ ] **Step 2: Implementar `api/_lib/memory/storage.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import type { StoragePort, UploadTicket } from './types.js';

export const PHOTO_BUCKET = 'brand-assets';
const REMOVE_CHUNK = 100;

export function createSupabaseStorage(client: SupabaseClient = supabaseAdmin): StoragePort {
  const bucket = () => client.storage.from(PHOTO_BUCKET);
  return {
    async createUploadUrls(paths) {
      const tickets: UploadTicket[] = [];
      for (const path of paths) {
        const { data, error } = await bucket().createSignedUploadUrl(path);
        if (error) throw error;
        tickets.push({ path: data.path, signedUrl: data.signedUrl, token: data.token });
      }
      return tickets;
    },
    async createReadUrls(paths, expiresInSeconds) {
      if (paths.length === 0) return {};
      const { data, error } = await bucket().createSignedUrls(paths, expiresInSeconds);
      if (error) throw error;
      const urls: Record<string, string> = {};
      for (const item of data) {
        if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
      }
      return urls;
    },
    async stat(path) {
      // exists() devolve data=false para 400/404 e lança nos outros erros.
      const found = await bucket().exists(path);
      if (!found.data) return null;
      const { data, error } = await bucket().info(path);
      if (error) throw error;
      return { size: data.size ?? data.metadata?.size ?? 0, mime: data.contentType ?? data.metadata?.mimetype ?? null };
    },
    async remove(paths) {
      for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
        const { error } = await bucket().remove(paths.slice(i, i + REMOVE_CHUNK));
        if (error) throw error;
      }
    },
  };
}
```

- [ ] **Step 3: Implementar `api/_lib/memory/deps.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { MEMORY_LIMITS } from './limits.js';
import { createSupabaseMemoryRepo } from './repo.js';
import { createSupabaseStorage } from './storage.js';
import type { MemoryDeps } from './types.js';

export function buildMemoryDeps(): MemoryDeps {
  return {
    repo: createSupabaseMemoryRepo(),
    storage: createSupabaseStorage(),
    limits: MEMORY_LIMITS.default,
    now: () => new Date(),
    newId: () => randomUUID(),
  };
}
```

- [ ] **Step 4: Implementar `api/_lib/memory/cleanup.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { createSupabaseStorage } from './storage.js';
import type { StoragePort } from './types.js';

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

// Chamado pelo cron diário. Remove fotos com mais de 24h que nenhum ativo referencia
// (upload nunca confirmado, ou remoção do Storage que falhou antes).
export async function cleanupOrphanPhotos(
  client: SupabaseClient = supabaseAdmin,
  storage: StoragePort = createSupabaseStorage(client),
  now: Date = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - ORPHAN_AGE_MS).toISOString();
  const { data, error } = await client.rpc('list_orphan_brand_photos', { p_older_than: cutoff });
  if (error) throw error;
  const paths = ((data ?? []) as { path: string }[]).map((r) => r.path);
  if (paths.length > 0) await storage.remove(paths);
  return paths.length;
}
```

- [ ] **Step 5: Criar a rota `api/memory/[action].ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIpRateLimit } from '../_lib/rateLimit/requireIpRateLimit.js';
import { authenticate } from '../_lib/auth.js';
import { requireActiveSubscription } from '../_lib/billing/requireSubscription.js';
import { buildMemoryDeps } from '../_lib/memory/deps.js';
import { queryInput, routeMemory } from '../_lib/memory/router.js';
import { logError } from '../_lib/logging/logger.js';
import { errorName } from '../_lib/logging/errorName.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await requireIpRateLimit(req, res))) return;

  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const user = await authenticate(req, res);
  if (!user) return;
  if (!(await requireActiveSubscription(user, res))) return;

  const raw = req.query.action;
  const action = String((Array.isArray(raw) ? raw[0] : raw) ?? '');
  const method = req.method ?? 'GET';
  const input =
    method === 'GET' || method === 'DELETE'
      ? queryInput(req.query)
      : req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};

  try {
    const result = await routeMemory(buildMemoryDeps(), user, action, method, input);
    return res.status(result.status).json(result.body);
  } catch (error) {
    await logError('memory_handler_failed', { errorName: errorName(error), action, method });
    return res.status(500).json({ error: 'Erro interno. Tente novamente em instantes.' });
  }
}
```

- [ ] **Step 6: Chamar a limpeza de órfãs no cron (`api/cron/billing.ts`)**

Import junto aos outros:
```ts
import { cleanupOrphanPhotos } from '../_lib/memory/cleanup.js';
```

Estado atual (dentro do `try`):
```ts
    await cleanupOldLogs().catch((err) => {
      logWarn('system_logs_cleanup_failed', { errorName: errorName(err) });
    });
    return res.status(200).json({ ok: true, ...summary });
```

Novo:
```ts
    await cleanupOldLogs().catch((err) => {
      logWarn('system_logs_cleanup_failed', { errorName: errorName(err) });
    });
    await cleanupOrphanPhotos().catch((err) => {
      logWarn('memory_orphan_cleanup_failed', { errorName: errorName(err) });
    });
    return res.status(200).json({ ok: true, ...summary });
```

- [ ] **Step 7: Suíte inteira, typecheck e conferência de imports**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, sem erros de tipo.

Run: `grep -rnE "from '\.\.?/[^']*[^s]'" api/_lib/memory "api/memory" | grep -v "\.js'"`
Expected: nenhuma linha (todo import relativo termina em `.js`).

Run: `grep -rn "console\." api/_lib/memory "api/memory" | grep -v "\.test\.ts"`
Expected: nenhuma linha.

- [ ] **Step 8: Commit**

```bash
git add api/_lib/memory/repo.ts api/_lib/memory/storage.ts api/_lib/memory/deps.ts \
  api/_lib/memory/cleanup.ts "api/memory/[action].ts" api/cron/billing.ts
git commit -m "$(cat <<'EOF'
feat: add brand memory Supabase adapters, /api/memory route and orphan cleanup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Aplicar a migração, publicar e verificar ao vivo

**Files:** nenhum arquivo do repositório.

**Interfaces:** nenhuma.

Todos os passos abaixo mexem em produção: pedir confirmação ao usuário antes de começar, e de novo antes do Step 6 (que usa a sessão dele).

- [ ] **Step 1: Aplicar a migração**

Via MCP do Supabase (`apply_migration`, nome `0007_brand_memory`) no projeto `promptforge` (ref `rgmavolhyrhmbhqnuvcf`), com o conteúdo de `supabase/migrations/0007_brand_memory.sql`.

- [ ] **Step 2: Conferir tabelas, RLS, bucket e permissões da função**

```sql
select
  (select count(*) from pg_policies where tablename in ('brands', 'brand_assets', 'prompt_library')) as policies,
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.brands'::regclass, 'public.brand_assets'::regclass, 'public.prompt_library'::regclass)) as rls_on,
  (select row_to_json(b) from (select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'brand-assets') b) as bucket,
  has_function_privilege('anon', 'public.list_orphan_brand_photos(timestamptz)', 'execute') as anon_exec,
  has_function_privilege('authenticated', 'public.list_orphan_brand_photos(timestamptz)', 'execute') as auth_exec,
  has_function_privilege('service_role', 'public.list_orphan_brand_photos(timestamptz)', 'execute') as service_exec;
```
Esperado: `policies = 0`, `rls_on = true`, bucket `{"public": false, "file_size_limit": 2097152, ...}`, `anon_exec = false`, `auth_exec = false`, `service_exec = true`.

- [ ] **Step 3: Rodar o Security Advisor**

`get_advisors` (security). Esperado: nenhum aviso novo além dos "RLS sem policies" informativos das três tabelas novas (intencionais).

- [ ] **Step 4: Publicar pelo fluxo protegido**

Seguir `docs/superpowers/runbooks/2026-09-22-deploy-workflow.md`: push da branch → PR → check "Vercel" verde → squash-merge. Conferir via `list_deployments` que produção está no commit do merge (`READY`).

- [ ] **Step 5: Verificação sem sessão**

```bash
for m in GET POST; do printf "$m brands: "; curl -s -o /dev/null -w "%{http_code}\n" -X $m -H "Content-Type: application/json" -d '{}' https://3dco.com.br/api/memory/brands; done
```
Esperado: `401` nos dois (a rota carregou; o `.js` dos imports está certo — um import quebrado daria 500).

- [ ] **Step 6: Verificação com sessão real (com permissão do usuário)**

No navegador, na aba do app logada com a conta do usuário (assinatura ativa), rodar pelo console um roteiro que usa o token da sessão do Supabase e **cria e depois apaga uma marca de teste** chamada `Teste backend`:

1. `GET /api/memory/brands` → 200, contém "Minha marca" (criada agora, se não existia).
2. `POST brands {name:'Teste backend'}` → 200; guardar `brandId`.
3. `POST use-asset {brandId, kind:'product', name:'Produto teste', data:{nome:'Produto teste'}}` → 200 `created:true`; guardar `assetId`.
4. `POST photo-upload {assetId, files:[{mime:'image/png', size}]}` com um PNG de 1×1 gerado por canvas → 200; enviar o arquivo com `PUT` no `signedUrl` (header `Content-Type: image/png`) → 200.
5. `POST photo-confirm {assetId, paths:[path]}` → 200, `photos` com 1 item.
6. `GET assets?brandId=…` → 200; o `url` da foto abre (HTTP 200, `image/png`).
7. `POST prompts {brandId, mode:'image', title:'Teste busca', deterministicPrompt:'p'}` → 200; `GET prompts?brandId=…&q=teste busca` → encontra o prompt (confere a busca com espaço no filtro real do PostgREST).
8. `DELETE brands?brandId=…` → 200.
9. SQL: `select count(*) from storage.objects where bucket_id = 'brand-assets' and name like '%<assetId>%'` → `0` (a foto foi removida junto com a marca).

- [ ] **Step 7: Conferir a limpeza de órfãs sem esperar o cron**

```sql
select * from public.list_orphan_brand_photos(now());
```
Esperado: nenhuma linha (nenhuma foto sem dono depois do Step 6).
