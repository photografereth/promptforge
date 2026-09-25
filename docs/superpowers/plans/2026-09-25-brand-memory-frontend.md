# Memória da Marca (Frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lançar a memória da marca para o assinante: seletor de marca, kit da marca na nuvem, escolher produto e criadora salvos, salvamento automático ao gerar, biblioteca de prompts e importação do histórico antigo.

**Architecture:** Lógica em módulos puros e testados em `src/lib/memory/` (URL da API, importação do histórico, montagem do formulário a partir de um item, plano de sincronização de fotos, orquestração do salvamento). Um cliente fino `src/lib/memoryApi.ts` sobre o `apiFetch` existente, um hook `useBrandMemory` para o estado de marcas e itens, e componentes em `src/components/memory/`. `App.tsx` troca o histórico local e as preferências locais pela memória; visitante sem login não tem memória (decisão do usuário).

**Tech Stack:** React 19, TypeScript, Tailwind, Vitest (só funções puras, ambiente node), `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-09-24-brand-memory-design.md` (seção 4, "Experiência no app"). Backend já em produção: `/api/memory/[action]` (PRs #21 e #22).

## Global Constraints

- Memória só para quem está logado **e** tem acesso (`subscription.data.hasAccess`). Visitante no modo demonstração vê "Biblioteca" e "Kit da marca" bloqueados, que abrem a tela de assinatura; o histórico local de 12 itens deixa de existir.
- A memória nunca bloqueia a geração: salvar é em segundo plano; falha vira aviso, nunca erro que impeça gerar ou copiar o prompt.
- Salvamentos são **em série** (uma fila): nunca dois salvamentos ao mesmo tempo, porque pedidos de upload paralelos do mesmo item descartam uns aos outros no backend.
- Query string sempre com `URLSearchParams` (o cursor da biblioteca contém `+00:00`).
- Nome de item: até 80 caracteres (cortado); título de prompt: até 200; só fotos `image/jpeg`, `image/png`, `image/webp`, no máximo 4 por item, as 4 primeiras da galeria.
- Trocar fotos de um item salvo usa `replace: true`; a análise da IA obtida na sessão vai junto no `photo-confirm`.
- A importação do histórico antigo roda uma vez por carregamento (`useRef`), porque o app roda em `<StrictMode>`, que executa efeitos duas vezes em desenvolvimento.
- Imports em `src/` sem extensão `.js` (Vite/bundler); em `api/` nada muda.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Dois salvamentos seguidos do mesmo produto** (clicar "Gerar" e logo "Aprimorar"): o segundo não pode apagar os uploads do primeiro. Esperado: fila em série, as duas terminam e o item fica com as fotos certas. Coberto pela fila no `App.tsx` (Task 6) e verificado ao vivo na Task 7.
- **Galeria alterada enquanto um salvamento está em andamento**: o `storagePath` devolvido não pode ir para a foto errada. Esperado: casar por `dataUrl`, não por posição. Coberto por `mergeStoragePaths` (Task 2).
- **Links de foto expirados** (app aberto por mais de 1h): miniatura quebrada ou falha ao carregar o item. Esperado: recarregar a lista de itens e tentar de novo. Coberto no `AssetPicker` (Task 5) e em `handleSelectAsset` (Task 5).
- **Marca guardada no navegador que não é da conta atual** (outra conta no mesmo navegador, ou marca apagada): esperado cair na marca padrão, sem erro. Coberto em `useBrandMemory` (Task 4).
- **Histórico antigo com campos fora do limite do backend** (nome de produto longo, título longo): esperado importar cortando, não pular o item. Coberto por `toImportItems` (Task 2).

---

### Task 1: Tipos, URL da API e cliente da memória

**Files:**
- Modify: `vitest.config.ts` (incluir `src/**/*.test.ts`)
- Modify: `src/types.ts` (`ReferenceImageItem.storagePath?`)
- Create: `src/lib/memory/types.ts`
- Create: `src/lib/memory/url.ts`
- Create: `src/lib/memoryApi.ts`
- Test: `src/lib/memory/url.test.ts`

**Interfaces:**
- Produces: tipos `AssetKind`, `BrandKit`, `Brand`, `AssetPhoto`, `MemoryAsset`, `LibraryPrompt`, `UploadTicket`, `LimitKind`, `SavePromptInput`; `memoryUrl(action, query?)`; `memoryApi` (métodos abaixo), `MemoryApiError`, `uploadToSignedUrl(url, blob)`, `urlToDataUrl(url)`.

- [ ] **Step 1: Incluir testes do frontend no Vitest**

Em `vitest.config.ts`, trocar:
```ts
    include: ['api/**/*.test.ts'],
```
por:
```ts
    // src/ só tem testes de funções puras (sem DOM); componentes são verificados no navegador.
    include: ['api/**/*.test.ts', 'src/**/*.test.ts'],
```

- [ ] **Step 2: `storagePath` em `ReferenceImageItem` (`src/types.ts`)**

Trocar:
```ts
export interface ReferenceImageItem {
  dataUrl: string;
  name: string;
  size: number;
  mimeType: string;
}
```
por:
```ts
export interface ReferenceImageItem {
  dataUrl: string;
  name: string;
  size: number;
  mimeType: string;
  storagePath?: string; // caminho no Storage quando a foto já está salva na memória da marca
}
```

- [ ] **Step 3: Criar `src/lib/memory/types.ts`**

```ts
import type { AppMode, UserPreferences } from '../../types';

export type AssetKind = 'product' | 'character';
export type LimitKind = 'brands' | 'pinnedAssets' | 'photos';

export type BrandKit = Partial<
  Pick<UserPreferences, 'autoApply' | 'preferredAgent' | 'preferredStyle' | 'preferredPalette' | 'preferredCamera'>
>;

export interface Brand {
  id: string;
  name: string;
  kit: BrandKit;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetPhoto {
  path: string;
  mime: string;
  size: number;
  url?: string | null;
}

export interface MemoryAsset {
  id: string;
  brandId: string;
  kind: AssetKind;
  name: string;
  data: Record<string, unknown>;
  analysis: Record<string, unknown> | null;
  photos: AssetPhoto[];
  pinned: boolean;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryPrompt {
  id: string;
  brandId: string;
  mode: AppMode;
  agent: string | null;
  title: string;
  productName: string | null;
  deterministicPrompt: string;
  enhancedPrompt: string | null;
  state: Record<string, unknown> | null;
  assetIds: string[];
  favorite: boolean;
  createdAt: string;
}

export interface UploadTicket {
  path: string;
  signedUrl: string;
  token: string;
}

export interface SavePromptInput {
  brandId: string;
  mode: AppMode;
  agent?: string;
  title: string;
  productName?: string;
  deterministicPrompt: string;
  enhancedPrompt?: string;
  state?: Record<string, unknown>;
  assetIds?: string[];
}
```

- [ ] **Step 4: Escrever o teste que falha**

```ts
// src/lib/memory/url.test.ts
import { describe, it, expect } from 'vitest';
import { memoryUrl } from './url';

describe('memoryUrl', () => {
  it('monta a rota sem query quando não há parâmetros', () => {
    expect(memoryUrl('brands')).toBe('/api/memory/brands');
  });
  it('codifica o "+" do cursor e omite parâmetros vazios', () => {
    const url = memoryUrl('prompts', { brandId: 'b1', cursor: '2026-09-24T12:00:00.1+00:00|x', q: '', favorite: undefined });
    expect(url).toBe('/api/memory/prompts?brandId=b1&cursor=2026-09-24T12%3A00%3A00.1%2B00%3A00%7Cx');
  });
  it('codifica espaços da busca', () => {
    expect(memoryUrl('prompts', { brandId: 'b1', q: 'teste busca' })).toBe('/api/memory/prompts?brandId=b1&q=teste+busca');
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npm test -- src/lib/memory/url.test.ts`
Expected: FAIL — `Cannot find module './url'`

- [ ] **Step 6: Implementar `src/lib/memory/url.ts`**

```ts
export type Query = Record<string, string | undefined>;

// URLSearchParams codifica "+" como %2B: o cursor da biblioteca contém "+00:00".
export function memoryUrl(action: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return `/api/memory/${action}${qs ? `?${qs}` : ''}`;
}
```

Observação: no teste de espaço, `URLSearchParams` codifica espaço como `+`, que o servidor decodifica de volta para espaço (`application/x-www-form-urlencoded`); só o `+` literal do cursor vira `%2B`.

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -- src/lib/memory/url.test.ts`
Expected: PASS (3/3)

- [ ] **Step 8: Criar `src/lib/memoryApi.ts`** (sem teste: é um invólucro do `apiFetch`, que importa o cliente Supabase e não carrega no Vitest)

```ts
import { apiFetch } from './apiFetch';
import { memoryUrl, type Query } from './memory/url';
import type {
  AssetKind,
  Brand,
  BrandKit,
  LibraryPrompt,
  LimitKind,
  MemoryAsset,
  SavePromptInput,
  UploadTicket,
} from './memory/types';

export class MemoryApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly limit?: LimitKind
  ) {
    super(message);
    this.name = 'MemoryApiError';
  }
}

async function request<T>(method: string, action: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const res = await apiFetch(memoryUrl(action, opts.query), {
    method,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new MemoryApiError(res.status, json.error ?? 'Algo deu errado. Tente novamente.', json.code, json.limit);
  }
  return json as T;
}

export const memoryApi = {
  listBrands: () => request<{ brands: Brand[] }>('GET', 'brands'),
  createBrand: (name: string) => request<{ brand: Brand }>('POST', 'brands', { body: { name } }),
  updateBrand: (brandId: string, patch: { name?: string; kit?: BrandKit }) =>
    request<{ brand: Brand }>('PATCH', 'brands', { body: { brandId, ...patch } }),
  deleteBrand: (brandId: string) => request<{ ok: true }>('DELETE', 'brands', { query: { brandId } }),

  listAssets: (brandId: string) => request<{ assets: MemoryAsset[] }>('GET', 'assets', { query: { brandId } }),
  updateAsset: (assetId: string, patch: { pinned?: boolean; name?: string }) =>
    request<{ asset: MemoryAsset }>('PATCH', 'assets', { body: { assetId, ...patch } }),
  deleteAsset: (assetId: string) => request<{ ok: true }>('DELETE', 'assets', { query: { assetId } }),
  useAsset: (input: {
    brandId: string;
    kind: AssetKind;
    name: string;
    data: Record<string, unknown>;
    analysis?: Record<string, unknown>;
  }) => request<{ asset: MemoryAsset; created: boolean }>('POST', 'use-asset', { body: input }),
  requestUploads: (assetId: string, files: { mime: string; size: number }[], replace: boolean) =>
    request<{ uploads: UploadTicket[] }>('POST', 'photo-upload', { body: { assetId, files, replace } }),
  confirmPhotos: (assetId: string, paths: string[], replace: boolean, analysis?: Record<string, unknown>) =>
    request<{ asset: MemoryAsset }>('POST', 'photo-confirm', {
      body: { assetId, paths, replace, ...(analysis ? { analysis } : {}) },
    }),

  listPrompts: (brandId: string, opts: { q?: string; favorite?: boolean; cursor?: string | null } = {}) =>
    request<{ prompts: LibraryPrompt[]; nextCursor: string | null }>('GET', 'prompts', {
      query: { brandId, q: opts.q, favorite: opts.favorite ? 'true' : undefined, cursor: opts.cursor ?? undefined },
    }),
  savePrompt: (input: SavePromptInput) => request<{ prompt: LibraryPrompt }>('POST', 'prompts', { body: input }),
  setFavorite: (promptId: string, favorite: boolean) =>
    request<{ prompt: LibraryPrompt }>('PATCH', 'prompts', { body: { promptId, favorite } }),
  deletePrompt: (promptId: string) => request<{ ok: true }>('DELETE', 'prompts', { query: { promptId } }),

  importLocal: (items: unknown[], preferences?: BrandKit) =>
    request<{ brandId: string; imported: number; skipped: number; kitImported: boolean }>('POST', 'import-local', {
      body: { items, ...(preferences ? { preferences } : {}) },
    }),
};

export type MemoryApi = typeof memoryApi;

export async function uploadToSignedUrl(signedUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });
  if (!res.ok) throw new Error(`upload ${res.status}`);
}

// Fotos salvas voltam para a galeria como dataUrl, igual às enviadas pelo usuário,
// para a análise multimodal continuar funcionando com elas.
export async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`foto ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a foto.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Step 9: Suíte, typecheck e commit**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, sem erros de tipo.

```bash
git add vitest.config.ts src/types.ts src/lib/memory/types.ts src/lib/memory/url.ts src/lib/memory/url.test.ts src/lib/memoryApi.ts
git commit -m "$(cat <<'EOF'
feat: add brand memory API client and frontend types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Funções puras — histórico antigo, formulário, fotos

**Files:**
- Create: `src/lib/memory/historyImport.ts`
- Create: `src/lib/memory/assetForm.ts`
- Create: `src/lib/memory/photoPlan.ts`
- Create: `src/lib/memory/dataUrl.ts`
- Test: `src/lib/memory/historyImport.test.ts`
- Test: `src/lib/memory/assetForm.test.ts`
- Test: `src/lib/memory/photoPlan.test.ts`
- Test: `src/lib/memory/dataUrl.test.ts`

**Interfaces:**
- Consumes: tipos da Task 1.
- Produces: `toImportItems(history)`, `kitFromPreferences(prefs)`, `preferencesFromKit(kit)`, `assetName(text)`, `productFromData(data)`, `characterFromData(data)`, `SAVABLE_MIMES`, `MAX_SAVED_PHOTOS`, `PhotoSlot`, `PhotoPlan`, `planPhotoSync(images, savedPaths)`, `withStoragePaths(images, updates)`, `mergeStoragePaths(current, synced)`, `dataUrlToBlob(dataUrl)`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
// src/lib/memory/historyImport.test.ts
import { describe, it, expect } from 'vitest';
import { kitFromPreferences, preferencesFromKit, toImportItems } from './historyImport';
import type { PromptHistoryItem } from '../../types';

const item = (extra: Partial<PromptHistoryItem> = {}): PromptHistoryItem => ({
  id: '1', timestamp: 1700000000000, mode: 'video', title: 'Sérum (UGC)', deterministicPrompt: 'p',
  videoState: { agent: 'pov', product: { nome: 'Sérum', categoria: '', caracteristicasVisuais: '', beneficioVisual: '' } } as PromptHistoryItem['videoState'],
  ...extra,
});

describe('toImportItems', () => {
  it('leva agente e nome do produto do estado salvo', () => {
    expect(toImportItems([item()])[0]).toMatchObject({ id: '1', mode: 'video', agent: 'pov', productName: 'Sérum', title: 'Sérum (UGC)' });
  });
  it('corta nome do produto em 80 e título em 200 em vez de perder o item', () => {
    const long = item({
      title: 't'.repeat(250),
      videoState: { agent: 'ugc', product: { nome: 'n'.repeat(120), categoria: '', caracteristicasVisuais: '', beneficioVisual: '' } } as PromptHistoryItem['videoState'],
    });
    const [out] = toImportItems([long]);
    expect((out.productName as string).length).toBe(80);
    expect((out.title as string).length).toBe(200);
  });
  it('omite nome de produto vazio', () => {
    const empty = item({ videoState: { agent: 'ugc', product: { nome: '  ', categoria: '', caracteristicasVisuais: '', beneficioVisual: '' } } as PromptHistoryItem['videoState'] });
    expect(toImportItems([empty])[0].productName).toBeUndefined();
  });
});

describe('kit ↔ preferências', () => {
  it('descarta textos vazios e volta ao formato de preferências', () => {
    const kit = kitFromPreferences({ autoApply: true, preferredAgent: 'ugc', preferredStyle: 'Cinema', preferredPalette: ' ', preferredCamera: '' });
    expect(kit).toEqual({ autoApply: true, preferredAgent: 'ugc', preferredStyle: 'Cinema' });
    expect(preferencesFromKit(kit)).toEqual({ autoApply: true, preferredAgent: 'ugc', preferredStyle: 'Cinema', preferredPalette: '', preferredCamera: '' });
  });
});
```

```ts
// src/lib/memory/assetForm.test.ts
import { describe, it, expect } from 'vitest';
import { assetName, characterFromData, productFromData } from './assetForm';

describe('assetForm', () => {
  it('monta a ficha do produto, com vazio no que faltar ou não for texto', () => {
    expect(productFromData({ nome: 'Sérum', categoria: 3 })).toEqual({ nome: 'Sérum', categoria: '', caracteristicasVisuais: '', beneficioVisual: '' });
  });
  it('monta a ficha da criadora', () => {
    expect(characterFromData({ cabelo: 'cacheado' })).toEqual({ nomeOuDescricao: '', caracteristicasFisicas: '', cabelo: 'cacheado', estiloVestuario: '', expressaoMarcante: '' });
  });
  it('nome do item: apara e corta em 80', () => {
    expect(assetName('  Sérum X  ')).toBe('Sérum X');
    expect(assetName('a'.repeat(90) + ' fim')).toHaveLength(80);
  });
});
```

```ts
// src/lib/memory/photoPlan.test.ts
import { describe, it, expect } from 'vitest';
import { mergeStoragePaths, planPhotoSync, withStoragePaths } from './photoPlan';
import type { ReferenceImageItem } from '../../types';

const img = (id: string, extra: Partial<ReferenceImageItem> = {}): ReferenceImageItem => ({
  dataUrl: `data:image/jpeg;base64,${id}`, name: id, size: 1, mimeType: 'image/jpeg', ...extra,
});

describe('planPhotoSync', () => {
  it('fotos já salvas na mesma ordem: nada muda', () => {
    const plan = planPhotoSync([img('a', { storagePath: 'p/a' }), img('b', { storagePath: 'p/b' })], ['p/a', 'p/b']);
    expect(plan.unchanged).toBe(true);
  });
  it('galeria vazia nunca apaga as fotos salvas', () => {
    expect(planPhotoSync([], ['p/a']).unchanged).toBe(true);
  });
  it('mistura foto mantida e foto nova, na ordem da galeria', () => {
    const plan = planPhotoSync([img('a', { storagePath: 'p/a' }), img('n')], ['p/a', 'p/b']);
    expect(plan.unchanged).toBe(false);
    expect(plan.slots.map((s) => s.kind)).toEqual(['keep', 'new']);
  });
  it('ignora tipos não suportados (amostras SVG) e guarda só as 4 primeiras', () => {
    const images = [img('svg', { mimeType: 'image/svg+xml' }), img('1'), img('2'), img('3'), img('4'), img('5')];
    const plan = planPhotoSync(images, []);
    expect(plan.skippedUnsupported).toBe(1);
    expect(plan.truncated).toBe(true);
    expect(plan.slots).toHaveLength(4);
    expect(plan.slots.every((s) => s.kind === 'new' && s.image.name !== 'svg')).toBe(true);
  });
});

describe('storagePath de volta na galeria', () => {
  it('withStoragePaths grava por posição original', () => {
    const out = withStoragePaths([img('a'), img('b')], [{ index: 1, path: 'p/b' }]);
    expect(out.map((i) => i.storagePath)).toEqual([undefined, 'p/b']);
  });
  it('mergeStoragePaths casa por dataUrl, não por posição', () => {
    const current = [img('novo'), img('a')];
    const synced = [img('a', { storagePath: 'p/a' })];
    expect(mergeStoragePaths(current, synced).map((i) => i.storagePath)).toEqual([undefined, 'p/a']);
  });
});
```

```ts
// src/lib/memory/dataUrl.test.ts
import { describe, it, expect } from 'vitest';
import { dataUrlToBlob } from './dataUrl';

describe('dataUrlToBlob', () => {
  it('decodifica base64 com o tipo certo', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(8);
  });
  it('lança para texto que não é data URL', () => {
    expect(() => dataUrlToBlob('https://x/y.png')).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/memory`
Expected: FAIL — `Cannot find module` para `./historyImport`, `./assetForm`, `./photoPlan`, `./dataUrl`.

- [ ] **Step 3: Implementar `src/lib/memory/historyImport.ts`**

```ts
import type { PromptHistoryItem, UserPreferences } from '../../types';
import type { BrandKit } from './types';

const clip = (value: string | undefined, max: number): string | undefined => {
  const text = value?.trim();
  return text ? text.slice(0, max) : undefined;
};

// Formato aceito por /api/memory/import-local; corta nos limites do backend em vez de perder o item.
export function toImportItems(history: PromptHistoryItem[]): Record<string, unknown>[] {
  return history.slice(0, 50).map((item) => {
    const state = item.videoState ?? item.imageState;
    return {
      id: item.id,
      timestamp: item.timestamp,
      mode: item.mode,
      agent: item.videoState?.agent ?? item.imageState?.agent ?? item.agent,
      productName: clip(state?.product?.nome ?? item.productName, 80),
      title: clip(item.title, 200),
      deterministicPrompt: item.deterministicPrompt,
      enhancedPrompt: item.enhancedPrompt,
      videoState: item.videoState,
      imageState: item.imageState,
    };
  });
}

export function kitFromPreferences(prefs: UserPreferences): BrandKit {
  const kit: BrandKit = { autoApply: Boolean(prefs.autoApply) };
  if (prefs.preferredAgent) kit.preferredAgent = prefs.preferredAgent;
  for (const key of ['preferredStyle', 'preferredPalette', 'preferredCamera'] as const) {
    const text = prefs[key];
    if (typeof text === 'string' && text.trim()) kit[key] = text.slice(0, 200);
  }
  return kit;
}

export function preferencesFromKit(kit: BrandKit): UserPreferences {
  return {
    autoApply: kit.autoApply ?? false,
    preferredAgent: kit.preferredAgent,
    preferredStyle: kit.preferredStyle ?? '',
    preferredPalette: kit.preferredPalette ?? '',
    preferredCamera: kit.preferredCamera ?? '',
  };
}
```

- [ ] **Step 4: Implementar `src/lib/memory/assetForm.ts`**

```ts
import type { CharacterAnchor, ProductAnchor } from '../../types';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function assetName(value: string): string {
  return value.trim().slice(0, 80).trim();
}

export function productFromData(data: Record<string, unknown>): ProductAnchor {
  return {
    nome: text(data.nome),
    categoria: text(data.categoria),
    caracteristicasVisuais: text(data.caracteristicasVisuais),
    beneficioVisual: text(data.beneficioVisual),
  };
}

export function characterFromData(data: Record<string, unknown>): CharacterAnchor {
  return {
    nomeOuDescricao: text(data.nomeOuDescricao),
    caracteristicasFisicas: text(data.caracteristicasFisicas),
    cabelo: text(data.cabelo),
    estiloVestuario: text(data.estiloVestuario),
    expressaoMarcante: text(data.expressaoMarcante),
  };
}
```

- [ ] **Step 5: Implementar `src/lib/memory/photoPlan.ts`**

```ts
import type { ReferenceImageItem } from '../../types';

export const SAVABLE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_SAVED_PHOTOS = 4;

export type PhotoSlot = { kind: 'keep'; path: string } | { kind: 'new'; image: ReferenceImageItem; index: number };

export interface PhotoPlan {
  unchanged: boolean;
  slots: PhotoSlot[];
  truncated: boolean;
  skippedUnsupported: number;
}

// `index` é a posição da imagem na galeria original, para gravar o storagePath de volta.
// Galeria vazia conta como "sem mudança": nunca apaga as fotos já salvas.
export function planPhotoSync(images: ReferenceImageItem[], savedPaths: string[]): PhotoPlan {
  const savable = images
    .map((image, index) => ({ image, index }))
    .filter(({ image }) => SAVABLE_MIMES.includes(image.mimeType));
  const chosen = savable.slice(0, MAX_SAVED_PHOTOS);
  const saved = new Set(savedPaths);
  const slots: PhotoSlot[] = chosen.map(({ image, index }) =>
    image.storagePath && saved.has(image.storagePath)
      ? { kind: 'keep', path: image.storagePath }
      : { kind: 'new', image, index }
  );
  const sameAsSaved =
    slots.length === savedPaths.length && slots.every((s, i) => s.kind === 'keep' && s.path === savedPaths[i]);
  return {
    unchanged: slots.length === 0 || sameAsSaved,
    slots,
    truncated: savable.length > MAX_SAVED_PHOTOS,
    skippedUnsupported: images.length - savable.length,
  };
}

export function withStoragePaths(
  images: ReferenceImageItem[],
  updates: { index: number; path: string }[]
): ReferenceImageItem[] {
  const byIndex = new Map(updates.map((u) => [u.index, u.path]));
  return images.map((image, index) => (byIndex.has(index) ? { ...image, storagePath: byIndex.get(index) } : image));
}

// A galeria pode ter mudado enquanto o salvamento rodava: casa por dataUrl, não por posição.
export function mergeStoragePaths(current: ReferenceImageItem[], synced: ReferenceImageItem[]): ReferenceImageItem[] {
  const byDataUrl = new Map(synced.filter((i) => i.storagePath).map((i) => [i.dataUrl, i.storagePath as string]));
  return current.map((image) =>
    !image.storagePath && byDataUrl.has(image.dataUrl) ? { ...image, storagePath: byDataUrl.get(image.dataUrl) } : image
  );
}
```

- [ ] **Step 6: Implementar `src/lib/memory/dataUrl.ts`**

```ts
export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Imagem inválida.');
  const [, mime, base64, payload] = match;
  const bytes = base64
    ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));
  return new Blob([bytes], { type: mime });
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -- src/lib/memory`
Expected: PASS (url 3 + historyImport 4 + assetForm 3 + photoPlan 6 + dataUrl 2 = 18/18)

- [ ] **Step 8: Typecheck e commit**

Run: `npx tsc --noEmit`
Expected: sem erros.

```bash
git add src/lib/memory
git commit -m "$(cat <<'EOF'
feat: add pure helpers for history import, asset forms and photo sync

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Orquestração do salvamento ao gerar

**Files:**
- Create: `src/lib/memory/saveGeneration.ts`
- Test: `src/lib/memory/saveGeneration.test.ts`

**Interfaces:**
- Consumes: `planPhotoSync`, `withStoragePaths`, `dataUrlToBlob`, `assetName` (Task 2); tipos (Task 1).
- Produces: `SaveGenerationApi` (subconjunto de `memoryApi`: `useAsset`, `requestUploads`, `confirmPhotos`, `savePrompt`), `UploadFile`, `GenerationInput`, `AssetSaveResult`, `GenerationResult`, `saveGeneration(api, upload, input)`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/memory/saveGeneration.test.ts
import { describe, it, expect } from 'vitest';
import { saveGeneration, type GenerationInput, type SaveGenerationApi } from './saveGeneration';
import type { MemoryAsset } from './types';
import type { ReferenceImageItem } from '../../types';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
// Todas usam o mesmo PNG válido; o plano de fotos distingue por storagePath e posição.
const img = (name: string, extra: Partial<ReferenceImageItem> = {}): ReferenceImageItem => ({
  dataUrl: PNG, name, size: 8, mimeType: 'image/png', ...extra,
});

function fakeApi(savedPhotos: Record<string, string[]> = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  let seq = 0;
  const asset = (kind: string, name: string, photos: string[], analysis: Record<string, unknown> | null = null): MemoryAsset => ({
    id: `${kind}-id`, brandId: 'b1', kind: kind as MemoryAsset['kind'], name, data: {}, analysis,
    photos: photos.map((path) => ({ path, mime: 'image/png', size: 8 })), pinned: false,
    lastUsedAt: '', createdAt: '', updatedAt: '',
  });
  const api: SaveGenerationApi = {
    async useAsset(input) {
      calls.push({ name: 'useAsset', args: [input] });
      return { asset: asset(input.kind, input.name, savedPhotos[input.kind] ?? []), created: !savedPhotos[input.kind] };
    },
    async requestUploads(assetId, files, replace) {
      calls.push({ name: 'requestUploads', args: [assetId, files, replace] });
      return { uploads: files.map(() => ({ path: `new/${++seq}`, signedUrl: `https://up/${seq}`, token: 't' })) };
    },
    async confirmPhotos(assetId, paths, replace, analysis) {
      calls.push({ name: 'confirmPhotos', args: [assetId, paths, replace, analysis] });
      return { asset: asset(assetId.split('-')[0], 'x', paths, analysis ?? null) };
    },
    async savePrompt(input) {
      calls.push({ name: 'savePrompt', args: [input] });
      return { prompt: { id: 'prompt-1' } as never };
    },
  };
  const uploads: string[] = [];
  const upload = async (url: string) => {
    uploads.push(url);
  };
  return { api, calls, uploads, upload };
}

const base = (extra: Partial<GenerationInput> = {}): GenerationInput => ({
  brandId: 'b1',
  prompt: { mode: 'video', agent: 'ugc', title: 'Sérum (UGC)', productName: 'Sérum', deterministicPrompt: 'p', state: {} },
  product: { nome: 'Sérum', categoria: '', caracteristicasVisuais: '', beneficioVisual: '' },
  productImages: [],
  character: { nomeOuDescricao: '', caracteristicasFisicas: '', cabelo: '', estiloVestuario: '', expressaoMarcante: '' },
  characterImages: [],
  ...extra,
});

describe('saveGeneration', () => {
  it('produto novo com 2 fotos: salva o item, envia as fotos com replace e confirma com a análise', async () => {
    const { api, calls, uploads, upload } = fakeApi();
    const res = await saveGeneration(api, upload, base({
      productImages: [img('a'), img('b')],
      analysis: { product: { resumo: 'ok' } },
    }));
    expect(calls.map((c) => c.name)).toEqual(['useAsset', 'requestUploads', 'confirmPhotos', 'savePrompt']);
    expect(calls[0].args[0]).toMatchObject({ kind: 'product', name: 'Sérum', analysis: { resumo: 'ok' } });
    expect(calls[1].args[2]).toBe(true);
    expect(uploads).toHaveLength(2);
    expect(calls[2].args).toEqual(['product-id', ['new/1', 'new/2'], true, { resumo: 'ok' }]);
    expect(res.product?.images.map((i) => i.storagePath)).toEqual(['new/1', 'new/2']);
    expect(calls[3].args[0]).toMatchObject({ brandId: 'b1', assetIds: ['product-id'] });
    expect(res.promptSaved).toBe(true);
  });

  it('fotos já salvas e iguais: não envia nem confirma nada', async () => {
    const { api, calls, upload } = fakeApi({ product: ['p/a'] });
    await saveGeneration(api, upload, base({ productImages: [img('a', { storagePath: 'p/a' })] }));
    expect(calls.map((c) => c.name)).toEqual(['useAsset', 'savePrompt']);
  });

  it('mantém a foto antiga e envia só a nova, na ordem da galeria', async () => {
    const { api, calls, upload } = fakeApi({ product: ['p/a', 'p/b'] });
    await saveGeneration(api, upload, base({ productImages: [img('a', { storagePath: 'p/a' }), img('n')] }));
    const req = calls.find((c) => c.name === 'requestUploads')!;
    expect((req.args[1] as unknown[]).length).toBe(1);
    expect(calls.find((c) => c.name === 'confirmPhotos')!.args[1]).toEqual(['p/a', 'new/1']);
  });

  it('pula amostras SVG, guarda só 4 fotos e avisa', async () => {
    const { api, upload, uploads } = fakeApi();
    const images = [img('svg', { mimeType: 'image/svg+xml' }), img('1'), img('2'), img('3'), img('4'), img('5')];
    const res = await saveGeneration(api, upload, base({ productImages: images }));
    expect(uploads).toHaveLength(4);
    expect(res.product).toMatchObject({ truncated: true, skippedUnsupported: 1 });
  });

  it('criadora sem nome não é salva; nomes longos são cortados em 80', async () => {
    const { api, calls, upload } = fakeApi();
    await saveGeneration(api, upload, base({ product: { nome: 'x'.repeat(100), categoria: '', caracteristicasVisuais: '', beneficioVisual: '' } }));
    const uses = calls.filter((c) => c.name === 'useAsset');
    expect(uses).toHaveLength(1);
    expect((uses[0].args[0] as { name: string }).name).toHaveLength(80);
  });

  it('falha no produto não impede salvar o prompt', async () => {
    const { api, calls, upload } = fakeApi();
    api.useAsset = async () => {
      throw new Error('rede');
    };
    const res = await saveGeneration(api, upload, base());
    expect(res.errors).toEqual(['produto']);
    expect(res.promptSaved).toBe(true);
    expect(calls.find((c) => c.name === 'savePrompt')!.args[0]).toMatchObject({ assetIds: [] });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- src/lib/memory/saveGeneration.test.ts`
Expected: FAIL — `Cannot find module './saveGeneration'`

- [ ] **Step 3: Implementar `src/lib/memory/saveGeneration.ts`**

```ts
import type { CharacterAnchor, ProductAnchor, ReferenceImageItem } from '../../types';
import { assetName } from './assetForm';
import { dataUrlToBlob } from './dataUrl';
import { planPhotoSync, withStoragePaths } from './photoPlan';
import type { AssetKind, MemoryAsset, SavePromptInput, UploadTicket } from './types';

export interface SaveGenerationApi {
  useAsset(input: {
    brandId: string;
    kind: AssetKind;
    name: string;
    data: Record<string, unknown>;
    analysis?: Record<string, unknown>;
  }): Promise<{ asset: MemoryAsset; created: boolean }>;
  requestUploads(assetId: string, files: { mime: string; size: number }[], replace: boolean): Promise<{ uploads: UploadTicket[] }>;
  confirmPhotos(assetId: string, paths: string[], replace: boolean, analysis?: Record<string, unknown>): Promise<{ asset: MemoryAsset }>;
  savePrompt(input: SavePromptInput): Promise<unknown>;
}

export type UploadFile = (signedUrl: string, blob: Blob) => Promise<void>;

export interface GenerationInput {
  brandId: string;
  prompt: Omit<SavePromptInput, 'brandId' | 'assetIds'>;
  product: ProductAnchor;
  productImages: ReferenceImageItem[];
  character?: CharacterAnchor;
  characterImages: ReferenceImageItem[];
  // Análise da IA feita nesta sessão (não a que veio de um item salvo).
  analysis?: { product?: Record<string, unknown>; character?: Record<string, unknown> };
}

export interface AssetSaveResult {
  asset: MemoryAsset;
  created: boolean;
  images: ReferenceImageItem[];
  truncated: boolean;
  skippedUnsupported: number;
}

export interface GenerationResult {
  promptSaved: boolean;
  product?: AssetSaveResult;
  character?: AssetSaveResult;
  errors: string[];
}

async function saveAsset(
  api: SaveGenerationApi,
  upload: UploadFile,
  brandId: string,
  kind: AssetKind,
  name: string,
  data: Record<string, unknown>,
  images: ReferenceImageItem[],
  analysis: Record<string, unknown> | undefined
): Promise<AssetSaveResult> {
  const { asset, created } = await api.useAsset({ brandId, kind, name, data, ...(analysis ? { analysis } : {}) });
  const plan = planPhotoSync(images, asset.photos.map((p) => p.path));
  const summary = { truncated: plan.truncated, skippedUnsupported: plan.skippedUnsupported };
  if (plan.unchanged) return { asset, created, images, ...summary };

  const fresh = plan.slots.flatMap((s) => (s.kind === 'new' ? [s] : []));
  const blobs = fresh.map((s) => dataUrlToBlob(s.image.dataUrl));
  let newPaths: string[] = [];
  if (fresh.length > 0) {
    const { uploads } = await api.requestUploads(asset.id, blobs.map((b) => ({ mime: b.type, size: b.size })), true);
    await Promise.all(uploads.map((ticket, i) => upload(ticket.signedUrl, blobs[i])));
    newPaths = uploads.map((t) => t.path);
  }
  let next = 0;
  const paths = plan.slots.map((s) => (s.kind === 'keep' ? s.path : newPaths[next++]));
  const confirmed = await api.confirmPhotos(asset.id, paths, true, analysis);
  next = 0;
  const updates = plan.slots.flatMap((s) => (s.kind === 'new' ? [{ index: s.index, path: newPaths[next++] }] : []));
  return { asset: confirmed.asset, created, images: withStoragePaths(images, updates), ...summary };
}

// Salva produto, criadora e prompt, nessa ordem; uma falha em um não impede os outros.
export async function saveGeneration(
  api: SaveGenerationApi,
  upload: UploadFile,
  input: GenerationInput
): Promise<GenerationResult> {
  const errors: string[] = [];
  const attempt = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch {
      errors.push(label);
      return undefined;
    }
  };

  const result: GenerationResult = { promptSaved: false, errors };
  const productName = assetName(input.product.nome);
  if (productName) {
    result.product = await attempt('produto', () =>
      saveAsset(api, upload, input.brandId, 'product', productName, { ...input.product }, input.productImages, input.analysis?.product)
    );
  }
  const characterName = input.character ? assetName(input.character.nomeOuDescricao) : '';
  if (input.character && characterName) {
    const character = input.character;
    result.character = await attempt('criadora', () =>
      saveAsset(api, upload, input.brandId, 'character', characterName, { ...character }, input.characterImages, input.analysis?.character)
    );
  }
  const assetIds = [result.product?.asset.id, result.character?.asset.id].filter((id): id is string => Boolean(id));
  const saved = await attempt('prompt', () => api.savePrompt({ ...input.prompt, brandId: input.brandId, assetIds }));
  result.promptSaved = saved !== undefined;
  return result;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- src/lib/memory/saveGeneration.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Suíte, typecheck e commit**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, sem erros de tipo.

```bash
git add src/lib/memory/saveGeneration.ts src/lib/memory/saveGeneration.test.ts
git commit -m "$(cat <<'EOF'
feat: add brand memory save orchestration for generated prompts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Estado de marcas, seletor no Header, kit da marca e avisos

**Files:**
- Create: `src/hooks/useBrandMemory.ts`
- Create: `src/components/memory/BrandSwitcher.tsx`
- Create: `src/components/memory/MemoryNotice.tsx`
- Create: `src/components/memory/MemoryLimitModal.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/PreferencesModal.tsx` (título)
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `memoryApi`, `MemoryApiError` (Task 1); `preferencesFromKit`, `kitFromPreferences` (Task 2).
- Produces: `useBrandMemory(enabled)` → `{ status, brands, currentBrand, assets, reload, selectBrand, createBrand, renameBrand, deleteBrand, saveKit, refreshAssets, setPinned, removeAsset }`; `<BrandSwitcher>`; `<MemoryNotice notice onDismiss>` com tipo `Notice = { message: string; actionLabel?: string; onAction?: () => void }`; `<MemoryLimitModal error onClose>`; `Header` ganha `brandSlot?: ReactNode` e `memoryLocked?: boolean`, perde `historyCount`.

Sem teste automatizado (componentes e hook; o projeto não tem biblioteca de teste de componentes). Verificação: `npx tsc --noEmit`, `npm run build` e navegador na Task 7.

- [ ] **Step 1: Criar `src/hooks/useBrandMemory.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { memoryApi } from '../lib/memoryApi';
import type { Brand, BrandKit, MemoryAsset } from '../lib/memory/types';

const STORAGE_KEY_BRAND = 'flow_prompt_forge_brand_v1';

function readStoredBrand(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_BRAND);
  } catch {
    return null;
  }
}

function storeBrand(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY_BRAND, id);
    else localStorage.removeItem(STORAGE_KEY_BRAND);
  } catch {
    // Navegador sem localStorage: a escolha vale só nesta sessão.
  }
}

// `enabled` = logado e com acesso. A marca guardada no navegador pode ser de outra conta
// ou já apagada: nesse caso cai na marca padrão.
export function useBrandMemory(enabled: boolean) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState<string | null>(readStoredBrand);
  const [assets, setAssets] = useState<MemoryAsset[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const currentBrand = brands.find((b) => b.id === brandId) ?? brands.find((b) => b.isDefault) ?? brands[0] ?? null;
  const currentBrandId = currentBrand?.id ?? null;

  const reload = useCallback(async () => {
    setStatus('loading');
    try {
      const { brands: list } = await memoryApi.listBrands();
      setBrands(list);
      setStatus(list.length > 0 ? 'ready' : 'error');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      void reload();
    } else {
      setBrands([]);
      setAssets([]);
      setStatus('idle');
    }
  }, [enabled, reload]);

  const refreshAssets = useCallback(async () => {
    if (!currentBrandId) {
      setAssets([]);
      return;
    }
    try {
      setAssets((await memoryApi.listAssets(currentBrandId)).assets);
    } catch {
      // A lista anterior continua na tela.
    }
  }, [currentBrandId]);

  useEffect(() => {
    void refreshAssets();
  }, [refreshAssets]);

  const selectBrand = (id: string) => {
    setBrandId(id);
    storeBrand(id);
  };

  const createBrand = async (name: string) => {
    const { brand } = await memoryApi.createBrand(name);
    setBrands((prev) => [...prev, brand]);
    selectBrand(brand.id);
    return brand;
  };

  const renameBrand = async (id: string, name: string) => {
    const { brand } = await memoryApi.updateBrand(id, { name });
    setBrands((prev) => prev.map((b) => (b.id === id ? brand : b)));
  };

  const deleteBrand = async (id: string) => {
    await memoryApi.deleteBrand(id);
    if (id === brandId) {
      setBrandId(null);
      storeBrand(null);
    }
    await reload();
  };

  const saveKit = async (kit: BrandKit) => {
    if (!currentBrandId) return;
    const { brand } = await memoryApi.updateBrand(currentBrandId, { kit });
    setBrands((prev) => prev.map((b) => (b.id === brand.id ? brand : b)));
  };

  const setPinned = async (asset: MemoryAsset, pinned: boolean) => {
    try {
      await memoryApi.updateAsset(asset.id, { pinned });
    } finally {
      await refreshAssets();
    }
  };

  const removeAsset = async (asset: MemoryAsset) => {
    await memoryApi.deleteAsset(asset.id);
    await refreshAssets();
  };

  return {
    status,
    brands,
    currentBrand,
    assets,
    reload,
    selectBrand,
    createBrand,
    renameBrand,
    deleteBrand,
    saveKit,
    refreshAssets,
    setPinned,
    removeAsset,
  };
}

export type BrandMemory = ReturnType<typeof useBrandMemory>;
```

- [ ] **Step 2: Criar `src/components/memory/MemoryNotice.tsx`**

```tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface Notice {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface MemoryNoticeProps {
  notice: Notice | null;
  onDismiss: () => void;
}

export const MemoryNotice: React.FC<MemoryNoticeProps> = ({ notice, onDismiss }) => {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-neutral-700 bg-neutral-900/95 px-4 py-3 text-xs text-neutral-200 shadow-2xl flex items-start gap-3">
      <span className="flex-1">{notice.message}</span>
      {notice.actionLabel && notice.onAction && (
        <button
          type="button"
          onClick={() => {
            notice.onAction?.();
            onDismiss();
          }}
          className="font-semibold text-amber-400 hover:text-amber-300 whitespace-nowrap cursor-pointer"
        >
          {notice.actionLabel}
        </button>
      )}
      <button type="button" onClick={onDismiss} className="text-neutral-500 hover:text-neutral-300 cursor-pointer" aria-label="Fechar aviso">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
```

- [ ] **Step 3: Criar `src/components/memory/MemoryLimitModal.tsx`**

```tsx
import React from 'react';
import type { MemoryApiError } from '../../lib/memoryApi';

interface MemoryLimitModalProps {
  error: MemoryApiError | null;
  onClose: () => void;
}

const HINT: Record<string, string> = {
  brands: 'Apague uma marca que não usa mais. Em breve teremos um plano para criadores e agências com mais marcas.',
  pinnedAssets: 'Desafixe algum item desta marca para liberar espaço.',
  photos: 'Remova alguma foto deste item antes de adicionar outra.',
};

export const MemoryLimitModal: React.FC<MemoryLimitModalProps> = ({ error, onClose }) => {
  if (!error) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl space-y-3">
        <h3 className="text-base font-bold text-neutral-100 font-display">Limite do seu plano</h3>
        <p className="text-sm text-neutral-300">{error.message}</p>
        {error.limit && <p className="text-xs text-neutral-400">{HINT[error.limit]}</p>}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-neutral-950 hover:bg-amber-400 cursor-pointer"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Criar `src/components/memory/BrandSwitcher.tsx`**

```tsx
import React, { useState } from 'react';
import { ChevronDown, Check, Plus, Settings2, Trash2 } from 'lucide-react';
import { MemoryApiError } from '../../lib/memoryApi';
import type { BrandMemory } from '../../hooks/useBrandMemory';

interface BrandSwitcherProps {
  memory: BrandMemory;
  onLimit: (error: MemoryApiError) => void;
}

export const BrandSwitcher: React.FC<BrandSwitcherProps> = ({ memory, onLimit }) => {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (e instanceof MemoryApiError && e.code === 'limit_reached') onLimit(e);
      else setError(e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.');
    }
  };

  if (memory.status === 'error') {
    return (
      <button
        type="button"
        onClick={() => void memory.reload()}
        className="px-3 py-1.5 rounded-lg text-xs text-red-300 bg-red-950/40 border border-red-800/60 cursor-pointer"
        title="Não foi possível carregar suas marcas"
      >
        Marcas indisponíveis · tentar de novo
      </button>
    );
  }
  if (!memory.currentBrand) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-100 bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700/60 cursor-pointer max-w-[180px]"
        title="Trocar de marca"
      >
        <span className="truncate">{memory.currentBrand.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl p-2 z-40 space-y-1">
          {memory.brands.map((brand) => (
            <button
              key={brand.id}
              type="button"
              onClick={() => {
                memory.selectBrand(brand.id);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-neutral-200 hover:bg-neutral-800 cursor-pointer"
            >
              <span className="truncate">{brand.name}</span>
              {brand.id === memory.currentBrand?.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
            </button>
          ))}
          <form
            className="flex gap-1 pt-1 border-t border-neutral-800"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newName.trim();
              if (!name) return;
              void run(async () => {
                await memory.createBrand(name);
                setNewName('');
                setOpen(false);
              });
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
              placeholder="Nova marca"
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100"
            />
            <button type="submit" className="px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 cursor-pointer" title="Criar marca">
              <Plus className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setManaging(true);
              setOpen(false);
            }}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-neutral-400 hover:bg-neutral-800 cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" /> Gerenciar marcas
          </button>
          {error && <p className="px-2 text-[11px] text-red-300">{error}</p>}
        </div>
      )}

      {managing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-bold text-neutral-100 font-display">Gerenciar marcas</h3>
            {memory.brands.map((brand) => (
              <div key={brand.id} className="flex items-center gap-2">
                {renaming?.id === brand.id ? (
                  <form
                    className="flex-1 flex gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        await memory.renameBrand(brand.id, renaming.name.trim());
                        setRenaming(null);
                      });
                    }}
                  >
                    <input
                      autoFocus
                      value={renaming.name}
                      maxLength={80}
                      onChange={(e) => setRenaming({ id: brand.id, name: e.target.value })}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-100"
                    />
                    <button type="submit" className="px-2 text-xs text-amber-400 cursor-pointer">Salvar</button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRenaming({ id: brand.id, name: brand.name })}
                    className="flex-1 text-left text-sm text-neutral-200 truncate cursor-pointer"
                    title="Renomear"
                  >
                    {brand.name}
                    {brand.isDefault && <span className="ml-2 text-[10px] text-neutral-500">padrão</span>}
                  </button>
                )}
                {memory.brands.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      confirmDelete === brand.id
                        ? void run(async () => {
                            await memory.deleteBrand(brand.id);
                            setConfirmDelete(null);
                          })
                        : setConfirmDelete(brand.id)
                    }
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-red-300 hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {confirmDelete === brand.id ? 'Apagar tudo desta marca?' : ''}
                  </button>
                )}
              </div>
            ))}
            {error && <p className="text-[11px] text-red-300">{error}</p>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setManaging(false);
                  setRenaming(null);
                  setConfirmDelete(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-neutral-800 text-neutral-200 hover:bg-neutral-700 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 5: Ajustar `src/components/Header.tsx`**

Trocar a interface e a assinatura:
```tsx
interface HeaderProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenLanding?: () => void;
  historyCount: number;
  hasAutoPreferences: boolean;
  userEmail?: string;
  onLogout?: () => void;
  onOpenSubscription?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenHistory,
  onOpenLanding,
  historyCount,
  hasAutoPreferences,
  userEmail,
  onLogout,
  onOpenSubscription,
}) => {
```
por:
```tsx
interface HeaderProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenLanding?: () => void;
  hasAutoPreferences: boolean;
  userEmail?: string;
  onLogout?: () => void;
  onOpenSubscription?: () => void;
  brandSlot?: React.ReactNode;
  memoryLocked?: boolean; // visitante sem assinatura: Biblioteca e Kit abrem a assinatura
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenHistory,
  onOpenLanding,
  hasAutoPreferences,
  userEmail,
  onLogout,
  onOpenSubscription,
  brandSlot,
  memoryLocked = false,
}) => {
```

Trocar o import de ícones:
```tsx
import { Settings, History, Sparkles, Clapperboard, CreditCard } from 'lucide-react';
```
por:
```tsx
import { Settings, Library, Clapperboard, CreditCard, Lock } from 'lucide-react';
```

Logo antes de `{/* History button */}`, inserir:
```tsx
          {brandSlot}
```

Trocar o botão de histórico inteiro (de `{/* History button */}` até o `</button>` correspondente) por:
```tsx
          {/* Library button */}
          <button
            id="btn-open-history"
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700/60 hover:border-neutral-600 transition-all cursor-pointer"
            title={memoryLocked ? 'Assine para salvar produtos, criadoras e prompts na nuvem' : 'Biblioteca de prompts da marca'}
          >
            {memoryLocked ? <Lock className="w-3.5 h-3.5 text-neutral-500" /> : <Library className="w-3.5 h-3.5 text-neutral-400" />}
            <span className="hidden md:inline">Biblioteca</span>
          </button>
```

No botão de preferências, trocar:
```tsx
            title="Meus padrões (Salvar preferências padrão)"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Meus padrões</span>
```
por:
```tsx
            title={memoryLocked ? 'Assine para salvar o kit da sua marca' : 'Kit da marca (padrões visuais)'}
          >
            {memoryLocked ? <Lock className="w-4 h-4 text-neutral-500" /> : <Settings className="w-4 h-4 text-amber-400" />}
            <span className="hidden md:inline">Kit da marca</span>
```

- [ ] **Step 6: Título do modal (`src/components/PreferencesModal.tsx`)**

Trocar:
```tsx
                Meus padrões visuais
```
por:
```tsx
                Kit da marca
```

- [ ] **Step 7: Ligar marcas, kit e avisos no `src/App.tsx`**

7a. Imports — junto aos outros:
```tsx
import { useBrandMemory } from './hooks/useBrandMemory';
import { BrandSwitcher } from './components/memory/BrandSwitcher';
import { MemoryNotice, type Notice } from './components/memory/MemoryNotice';
import { MemoryLimitModal } from './components/memory/MemoryLimitModal';
import { MemoryApiError } from './lib/memoryApi';
import { kitFromPreferences, preferencesFromKit } from './lib/memory/historyImport';
```

7b. Logo depois de `const subscription = useSubscription(isAuthenticated);`, inserir:
```tsx
  // Memória da marca: só para quem está logado e tem acesso.
  const memoryEnabled = isAuthenticated && Boolean(subscription.data?.hasAccess);
  const memory = useBrandMemory(memoryEnabled);
  const [notice, setNotice] = useState<Notice | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const [limitError, setLimitError] = useState<MemoryApiError | null>(null);
```

7c. Trocar o bloco de preferências locais:
```tsx
  // Preferences & History
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      return saved ? JSON.parse(saved) : defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  });
```
por:
```tsx
  // Kit da marca atual (na nuvem). Visitante sem memória usa os padrões do app.
  const preferences: UserPreferences = memory.currentBrand
    ? preferencesFromKit(memory.currentBrand.kit)
    : defaultPreferences;
```

7d. Trocar `handleSavePreferences` inteiro:
```tsx
  // Save preferences to localStorage
  const handleSavePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(newPrefs));
    } catch (e) {
      console.error(e);
    }
  };
```
por:
```tsx
  const handleSavePreferences = (newPrefs: UserPreferences) => {
    memory.saveKit(kitFromPreferences(newPrefs)).catch(() =>
      setNotice({ message: 'Não foi possível salvar o kit da marca. Tente novamente.' })
    );
  };
```

7e. Trocar o efeito de auto-aplicar:
```tsx
  // Initial auto-apply if preference configured
  useEffect(() => {
    if (preferences.autoApply) {
      applyPreferencesToState(preferences);
    }
  }, []);
```
por:
```tsx
  // Ao entrar ou trocar de marca, aplica o kit dela se estiver marcado para aplicar sozinho.
  useEffect(() => {
    if (memory.currentBrand?.kit.autoApply) applyPreferencesToState(preferences);
  }, [memory.currentBrand?.id]);
```

7f. No `<Header ...>`, remover a linha `historyCount={history.length}` e trocar:
```tsx
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
```
por:
```tsx
        onOpenSettings={() => (memoryEnabled ? setIsSettingsOpen(true) : setCheckoutPlan('annual'))}
        onOpenHistory={() => (memoryEnabled ? setIsHistoryOpen(true) : setCheckoutPlan('annual'))}
        memoryLocked={!memoryEnabled}
        brandSlot={memoryEnabled ? <BrandSwitcher memory={memory} onLimit={setLimitError} /> : undefined}
```

7g. No `<PreferencesModal`, acrescentar `key` (o modal guarda cópia local das preferências ao montar):
```tsx
      <PreferencesModal
        key={memory.currentBrand?.id ?? 'sem-marca'}
```

7h. Antes do `{/* Checkout / Subscription Modal */}`, inserir:
```tsx
      <MemoryNotice notice={notice} onDismiss={dismissNotice} />
      <MemoryLimitModal error={limitError} onClose={() => setLimitError(null)} />
```

O histórico local (`history`, `saveToHistory`, `HistoryDrawer`) continua funcionando até a Task 6, que o substitui.

- [ ] **Step 8: Typecheck, build e commit**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: sem erros de tipo, build ok, suíte PASS.

```bash
git add src/hooks/useBrandMemory.ts src/components/memory src/components/Header.tsx src/components/PreferencesModal.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat: add brand switcher, cloud brand kit and memory notices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Escolher produto e criadora salvos

**Files:**
- Create: `src/components/memory/AssetPicker.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `BrandMemory` (Task 4), `MemoryAsset` (Task 1), `productFromData`, `characterFromData` (Task 2), `urlToDataUrl` (Task 1).
- Produces: `<AssetPicker kind label assets onSelect onTogglePin onDelete onImagesExpired />`; `handleSelectAsset(asset)` e o estado `sessionAnalysis` no `App.tsx` (consumido pela Task 6).

Sem teste automatizado (componente); verificação no navegador (Task 7).

- [ ] **Step 1: Criar `src/components/memory/AssetPicker.tsx`**

```tsx
import React, { useState } from 'react';
import { ChevronDown, Pin, PinOff, Trash2, Package, User } from 'lucide-react';
import type { AssetKind, MemoryAsset } from '../../lib/memory/types';

interface AssetPickerProps {
  kind: AssetKind;
  label: string;
  assets: MemoryAsset[];
  onSelect: (asset: MemoryAsset) => void;
  onTogglePin: (asset: MemoryAsset) => void;
  onDelete: (asset: MemoryAsset) => void;
  onImagesExpired: () => void; // links assinados valem 1h
}

export const AssetPicker: React.FC<AssetPickerProps> = ({
  kind,
  label,
  assets,
  onSelect,
  onTogglePin,
  onDelete,
  onImagesExpired,
}) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'pinned' | 'recent'>('pinned');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const ofKind = assets.filter((a) => a.kind === kind);
  const pinned = ofKind.filter((a) => a.pinned);
  const recent = ofKind.filter((a) => !a.pinned);
  const shown = tab === 'pinned' ? pinned : recent;
  const Icon = kind === 'product' ? Package : User;

  return (
    <div className="relative flex-1">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setTab(pinned.length > 0 ? 'pinned' : 'recent');
        }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-neutral-200 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-amber-400" />
          {label}: escolher
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-2 z-30 rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl p-2">
          <div className="flex gap-1 mb-2">
            {(['pinned', 'recent'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                  tab === t ? 'bg-amber-500/15 text-amber-300' : 'text-neutral-400 hover:bg-neutral-800'
                }`}
              >
                {t === 'pinned' ? `Fixados (${pinned.length})` : `Recentes (${recent.length})`}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="px-2 py-3 text-[11px] text-neutral-500">
              {tab === 'pinned'
                ? 'Nada fixado ainda. Fixe um item dos Recentes com o alfinete.'
                : 'Os itens usados ao gerar um prompt aparecem aqui.'}
            </p>
          ) : (
            <ul className="max-h-64 overflow-y-auto space-y-1">
              {shown.map((asset) => (
                <li key={asset.id} className="flex items-center gap-2 rounded-lg hover:bg-neutral-800 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(asset);
                      setOpen(false);
                    }}
                    className="flex-1 flex items-center gap-2 py-1.5 text-left min-w-0 cursor-pointer"
                  >
                    {asset.photos[0]?.url ? (
                      <img
                        src={asset.photos[0].url}
                        alt=""
                        onError={onImagesExpired}
                        className="w-8 h-8 rounded-md object-cover bg-neutral-800 shrink-0"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-md bg-neutral-800 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-neutral-500" />
                      </span>
                    )}
                    <span className="text-xs text-neutral-200 truncate">{asset.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTogglePin(asset)}
                    className="p-1 text-neutral-400 hover:text-amber-300 cursor-pointer"
                    title={asset.pinned ? 'Desafixar' : 'Fixar'}
                  >
                    {asset.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDelete === asset.id) {
                        onDelete(asset);
                        setConfirmDelete(null);
                      } else {
                        setConfirmDelete(asset.id);
                      }
                    }}
                    className="p-1 text-neutral-500 hover:text-red-300 cursor-pointer text-[10px]"
                    title="Apagar"
                  >
                    {confirmDelete === asset.id ? 'Apagar?' : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Estado da análise da sessão e seleção de item no `src/App.tsx`**

2a. Imports:
```tsx
import { AssetPicker } from './components/memory/AssetPicker';
import { urlToDataUrl } from './lib/memoryApi';
import { characterFromData, productFromData } from './lib/memory/assetForm';
import type { MemoryAsset } from './lib/memory/types';
```
e trocar `ReferenceMediaState,` no import de `./types` por `ReferenceMediaState, ReferenceImageItem,`.

2b. Depois do estado `limitError` (Task 4), inserir:
```tsx
  // Análise da IA feita nesta sessão; vai junto quando o item é salvo com fotos novas.
  const [sessionAnalysis, setSessionAnalysis] = useState<{
    product?: Record<string, unknown>;
    character?: Record<string, unknown>;
  }>({});
```

2c. No começo de `handleAnalysisSuccess`, antes de `// 1. Update Product`, inserir:
```tsx
    setSessionAnalysis({
      product: result.product ? { ...result.product, consistencySummary: result.consistencySummary } : undefined,
      character: result.character ? { ...result.character, consistencySummary: result.consistencySummary } : undefined,
    });
```

2d. Em `handleClearForm`, depois de `setErrorMessage(null);`, inserir:
```tsx
    setSessionAnalysis({});
```

2e. Antes de `const activeProduct = ...`, inserir:
```tsx
  // Escolher um item salvo preenche a ficha e a galeria; nenhuma análise de IA é chamada.
  const handleSelectAsset = async (asset: MemoryAsset) => {
    if (asset.kind === 'product') handleApplyProductPreset(productFromData(asset.data));
    else handleApplyCharacterPreset(characterFromData(asset.data));
    setSessionAnalysis((prev) => ({ ...prev, [asset.kind]: undefined }));

    let images: ReferenceImageItem[] = [];
    try {
      images = await Promise.all(
        asset.photos
          .filter((p) => p.url)
          .map(async (p, i) => ({
            dataUrl: await urlToDataUrl(p.url as string),
            name: `${asset.name} ${i + 1}`,
            size: p.size,
            mimeType: p.mime,
            storagePath: p.path,
          }))
      );
    } catch {
      setNotice({ message: 'Não foi possível carregar as fotos deste item. Abra a lista de novo e tente outra vez.' });
      void memory.refreshAssets();
      return;
    }
    setMediaState((prev) =>
      asset.kind === 'product'
        ? { ...prev, productImages: images, productImage: images[0] ?? null }
        : { ...prev, characterImages: images, characterImage: images[0] ?? null }
    );
  };

  const handleTogglePin = (asset: MemoryAsset) => {
    memory.setPinned(asset, !asset.pinned).catch((e) => {
      if (e instanceof MemoryApiError && e.code === 'limit_reached') setLimitError(e);
      else setNotice({ message: 'Não foi possível atualizar o item. Tente novamente.' });
    });
  };

  const handleDeleteAsset = (asset: MemoryAsset) => {
    memory.removeAsset(asset).catch(() => setNotice({ message: 'Não foi possível apagar o item. Tente novamente.' }));
  };
```

2f. Entre `<AgentSelector ... />` e `{/* 2. Reference Images Upload ... */}`, inserir:
```tsx
            {memoryEnabled && memory.currentBrand && (
              <div className="flex flex-col sm:flex-row gap-2">
                {(['product', 'character'] as const).map((kind) => (
                  <AssetPicker
                    key={kind}
                    kind={kind}
                    label={kind === 'product' ? 'Produto' : 'Criadora'}
                    assets={memory.assets}
                    onSelect={handleSelectAsset}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDeleteAsset}
                    onImagesExpired={() => void memory.refreshAssets()}
                  />
                ))}
              </div>
            )}
```

- [ ] **Step 3: Typecheck, build e commit**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: sem erros, build ok, suíte PASS.

```bash
git add src/components/memory/AssetPicker.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat: pick saved products and creators from the brand memory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Salvar ao gerar, biblioteca e importação do histórico

**Files:**
- Create: `src/components/memory/LibraryDrawer.tsx`
- Modify: `src/App.tsx`
- Delete: `src/components/HistoryDrawer.tsx`

**Interfaces:**
- Consumes: `saveGeneration` (Task 3), `mergeStoragePaths` (Task 2), `toImportItems`, `kitFromPreferences` (Task 2), `memoryApi`, `uploadToSignedUrl` (Task 1), `sessionAnalysis` (Task 5).
- Produces: `<LibraryDrawer isOpen onClose brandId brandName onOpenPrompt />`.

Sem teste automatizado (a orquestração já foi testada na Task 3); verificação no navegador (Task 7).

- [ ] **Step 1: Criar `src/components/memory/LibraryDrawer.tsx`**

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, Star, Trash2, Copy, Check, ArrowUpRight, Library, Clapperboard, Image as ImageIcon } from 'lucide-react';
import { memoryApi } from '../../lib/memoryApi';
import type { LibraryPrompt } from '../../lib/memory/types';

interface LibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  brandId: string;
  brandName: string;
  onOpenPrompt: (prompt: LibraryPrompt) => void;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export const LibraryDrawer: React.FC<LibraryDrawerProps> = ({ isOpen, onClose, brandId, brandName, onOpenPrompt }) => {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [items, setItems] = useState<LibraryPrompt[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (reset: boolean, fromCursor: string | null) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await memoryApi.listPrompts(brandId, { q: debounced, favorite: onlyFavorites, cursor: reset ? null : fromCursor });
        if (id !== requestId.current) return; // resposta de uma busca antiga
        setItems((prev) => (reset ? res.prompts : [...prev, ...res.prompts]));
        setCursor(res.nextCursor);
      } catch {
        if (id === requestId.current) setError('Não foi possível carregar a biblioteca. Tente novamente.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [brandId, debounced, onlyFavorites]
  );

  useEffect(() => {
    if (isOpen) void load(true, null);
  }, [isOpen, load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading) void load(false, cursor);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loading, load]);

  if (!isOpen) return null;

  const toggleFavorite = async (item: LibraryPrompt) => {
    try {
      const { prompt } = await memoryApi.setFavorite(item.id, !item.favorite);
      setItems((prev) =>
        onlyFavorites && !prompt.favorite ? prev.filter((p) => p.id !== prompt.id) : prev.map((p) => (p.id === prompt.id ? prompt : p))
      );
    } catch {
      setError('Não foi possível atualizar o favorito.');
    }
  };

  const remove = async (item: LibraryPrompt) => {
    try {
      await memoryApi.deletePrompt(item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
    } catch {
      setError('Não foi possível apagar o prompt.');
    }
  };

  const copy = async (item: LibraryPrompt) => {
    try {
      await navigator.clipboard.writeText(item.enhancedPrompt || item.deterministicPrompt);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setError('Não foi possível copiar.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border-l border-neutral-800 h-full flex flex-col shadow-2xl">
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2 min-w-0">
            <Library className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-base font-bold text-neutral-100 font-display truncate">Biblioteca · {brandName}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-800 cursor-pointer" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-neutral-800 flex gap-2">
          <label className="flex-1 flex items-center gap-2 px-2 rounded-lg bg-neutral-950 border border-neutral-800">
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            <input
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título ou produto"
              className="flex-1 bg-transparent py-1.5 text-xs text-neutral-100 outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            className={`flex items-center gap-1 px-2 rounded-lg text-xs border cursor-pointer ${
              onlyFavorites ? 'border-amber-500/50 text-amber-300 bg-amber-500/10' : 'border-neutral-800 text-neutral-400'
            }`}
          >
            <Star className="w-3.5 h-3.5" /> Favoritos
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {error && <p className="text-xs text-red-300">{error}</p>}
          {!loading && items.length === 0 && !error && (
            <p className="text-xs text-neutral-500 p-3">
              {debounced || onlyFavorites ? 'Nada encontrado.' : 'Os prompts gerados nesta marca aparecem aqui.'}
            </p>
          )}
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-100 truncate">{item.title}</p>
                  <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                    {item.mode === 'video' ? <Clapperboard className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <button type="button" onClick={() => void toggleFavorite(item)} className="p-1 cursor-pointer" title="Favorito">
                  <Star className={`w-4 h-4 ${item.favorite ? 'text-amber-400 fill-amber-400' : 'text-neutral-600'}`} />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenPrompt(item);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> Reabrir
                </button>
                <button type="button" onClick={() => void copy(item)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-neutral-300 hover:bg-neutral-800 cursor-pointer">
                  {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} Copiar
                </button>
                <button
                  type="button"
                  onClick={() => (confirmDelete === item.id ? void remove(item) : setConfirmDelete(item.id))}
                  className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-red-300 hover:bg-red-950/40 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {confirmDelete === item.id ? 'Apagar?' : ''}
                </button>
              </div>
            </div>
          ))}
          {loading && <p className="text-xs text-neutral-500 p-2">Carregando…</p>}
          <div ref={sentinel} />
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Trocar o histórico local pela memória no `src/App.tsx`**

2a. Imports: remover `import { HistoryDrawer } from './components/HistoryDrawer';` e acrescentar:
```tsx
import { LibraryDrawer } from './components/memory/LibraryDrawer';
import { memoryApi, uploadToSignedUrl } from './lib/memoryApi';
import { saveGeneration } from './lib/memory/saveGeneration';
import { mergeStoragePaths } from './lib/memory/photoPlan';
import { toImportItems } from './lib/memory/historyImport';
import type { LibraryPrompt } from './lib/memory/types';
```
(juntar `memoryApi, uploadToSignedUrl` ao import de `./lib/memoryApi` já existente, que tem `MemoryApiError` e `urlToDataUrl`; e `toImportItems` ao import de `./lib/memory/historyImport`.)

2b. Remover o estado `history` inteiro:
```tsx
  const [history, setHistory] = useState<PromptHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
```

2c. Depois do estado `sessionAnalysis` (Task 5), inserir a fila de salvamento e a importação:
```tsx
  // Salvamentos em série: pedidos de upload paralelos do mesmo item descartariam uns aos outros.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  // Importação única do histórico antigo do navegador. O useRef evita a execução dupla do <StrictMode>.
  const importStarted = useRef(false);
  useEffect(() => {
    if (memory.status !== 'ready' || importStarted.current) return;
    let items: PromptHistoryItem[] = [];
    let prefs: UserPreferences | null = null;
    try {
      const rawHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
      items = Array.isArray(rawHistory) ? rawHistory : [];
      prefs = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFS) || 'null');
    } catch {
      items = [];
    }
    if (items.length === 0 && !prefs) return;
    importStarted.current = true;
    memoryApi
      .importLocal(toImportItems(items), prefs ? kitFromPreferences(prefs) : undefined)
      .then((res) => {
        try {
          localStorage.removeItem(STORAGE_KEY_HISTORY);
          localStorage.removeItem(STORAGE_KEY_PREFS);
        } catch {
          // Sem localStorage: a importação não duplica numa próxima vez (o servidor ignora o que já veio).
        }
        if (res.kitImported) void memory.reload();
        if (res.imported > 0) setNotice({ message: `Importamos seus ${res.imported} prompts recentes para a biblioteca.` });
      })
      .catch(() => {
        importStarted.current = false; // tenta de novo no próximo carregamento
      });
  }, [memory.status]);
```

2d. Trocar o corpo de `saveToHistory` a partir de `setHistory((prev) => {` até o fim da função (inclusive o `});` do `setHistory`) por:
```tsx
    if (!memoryEnabled || !memory.currentBrand) return;
    const brand = memory.currentBrand;
    const productAnchor = mode === 'video' ? videoState.product : imageState.product;
    const characterAnchor = mode === 'video' ? videoState.character : imageState.character;
    const input = {
      brandId: brand.id,
      prompt: {
        mode,
        agent: currentAgent,
        title: newItem.title.slice(0, 200),
        productName: prodName.trim().slice(0, 80) || undefined,
        deterministicPrompt: detPrompt,
        enhancedPrompt: enhPrompt || undefined,
        state: (mode === 'video' ? { ...videoState } : { ...imageState }) as unknown as Record<string, unknown>,
      },
      product: productAnchor,
      productImages: mediaState.productImages,
      character: characterAnchor,
      characterImages: mediaState.characterImages,
      analysis: sessionAnalysis,
    };

    saveQueue.current = saveQueue.current.then(async () => {
      const result = await saveGeneration(memoryApi, uploadToSignedUrl, input);
      setMediaState((prev) => ({
        ...prev,
        productImages: result.product ? mergeStoragePaths(prev.productImages, result.product.images) : prev.productImages,
        characterImages: result.character ? mergeStoragePaths(prev.characterImages, result.character.images) : prev.characterImages,
      }));
      void memory.refreshAssets();

      if (result.errors.length > 0) {
        setNotice({ message: `Não foi possível salvar na nuvem (${result.errors.join(', ')}). O prompt continua aqui; tente gerar de novo.` });
        return;
      }
      const created = result.product?.created ? result.product : result.character?.created ? result.character : undefined;
      const trimmed = result.product?.truncated || result.character?.truncated;
      const extra = trimmed ? ' Só as 4 primeiras fotos foram guardadas.' : '';
      if (created) {
        setNotice({
          message: `${created.asset.name} salvo nos recentes.${extra}`,
          actionLabel: '📌 Fixar',
          onAction: () => handleTogglePin(created.asset),
        });
      } else if (extra) {
        setNotice({ message: extra.trim() });
      }
    });
```

`newItem`, `prodName` e `currentAgent` continuam sendo montados no começo da função como hoje (o título do prompt reaproveita a mesma regra).

2e. Trocar `handleLoadHistoryItem`, `handleDeleteHistoryItem` e `handleClearAllHistory` (as três funções inteiras) por:
```tsx
  // Reabre um prompt da biblioteca com todos os campos.
  const handleOpenLibraryPrompt = (prompt: LibraryPrompt) => {
    setMode(prompt.mode);
    if (prompt.state) {
      if (prompt.mode === 'video') setVideoState({ ...initialVideoState, ...(prompt.state as Partial<VideoPromptState>) });
      else setImageState({ ...initialImageState, ...(prompt.state as Partial<ImagePromptState>) });
    }
    setEnhancedPrompt(prompt.enhancedPrompt ?? '');
  };
```

2f. Trocar o bloco `{/* History Drawer */}` e o `<HistoryDrawer ... />` por:
```tsx
      {memoryEnabled && memory.currentBrand && (
        <LibraryDrawer
          key={memory.currentBrand.id}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          brandId={memory.currentBrand.id}
          brandName={memory.currentBrand.name}
          onOpenPrompt={handleOpenLibraryPrompt}
        />
      )}
```

2g. Apagar o arquivo sem uso:
```bash
git rm src/components/HistoryDrawer.tsx
```

- [ ] **Step 3: Conferir que nada mais usa o histórico local**

Run: `grep -n "setHistory\|history\.length\|HistoryDrawer\|handleLoadHistoryItem" src/App.tsx src/components/*.tsx`
Expected: nenhuma linha.

Run: `grep -n "localStorage" src/App.tsx`
Expected: só as leituras e remoções da importação (Step 2c).

- [ ] **Step 4: Typecheck, build, suíte e commit**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: sem erros, build ok, suíte PASS.

```bash
git add src/components/memory/LibraryDrawer.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat: save generations to the brand memory, add the prompt library and import local history

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Publicar e verificar no navegador

**Files:** nenhum arquivo do repositório (a menos que a verificação ache um defeito — aí, correção com teste quando for lógica pura, e novo commit).

**Interfaces:** nenhuma.

Pede confirmação ao usuário antes de começar (merge em produção e uso da conta de teste com assinatura ativada temporariamente, como nas verificações do backend).

- [ ] **Step 1: PR, check da Vercel e merge**

Pelo fluxo de `docs/superpowers/runbooks/2026-09-22-deploy-workflow.md`. Conferir via `list_deployments` que produção está no commit do merge (`READY`).

- [ ] **Step 2: Visitante sem login**

Aba anônima em `https://3dco.com.br`, entrar no app sem login: "Biblioteca" e "Kit da marca" aparecem com cadeado e abrem a assinatura; não há seletor de marca nem botões de produto/criadora.

- [ ] **Step 3: Assinante (conta de teste, assinatura ativa só durante o teste)**

Antes de recarregar o app, semear o histórico antigo pelo console para testar a importação:
```js
localStorage.setItem('flow_prompt_forge_history_v2', JSON.stringify([{ id: 'imp-1', timestamp: Date.now() - 86400000, mode: 'image', title: 'Prompt antigo importado', deterministicPrompt: 'texto antigo', imageState: { product: { nome: 'Produto antigo' } } }]));
localStorage.setItem('flow_prompt_forge_prefs_v2', JSON.stringify({ autoApply: false, preferredStyle: 'Estilo importado', preferredPalette: '', preferredCamera: '' }));
```

Conferir, nesta ordem:
1. Ao carregar: aviso "Importamos seus 1 prompts recentes…"; as duas chaves somem do `localStorage`; a Biblioteca mostra "Prompt antigo importado".
2. Seletor de marca mostra "Minha marca"; criar "Loja teste" → vira a marca atual; Biblioteca vazia nela.
3. Kit da marca: salvar estilo "Cinema teste" com auto-aplicar; trocar para "Minha marca" e voltar → o estilo é aplicado sozinho ao voltar.
4. Preencher produto "Sérum verificação" + 2 fotos JPEG, analisar referências, clicar "Gerar": aviso "Sérum verificação salvo nos recentes. 📌 Fixar"; Biblioteca mostra o prompt; busca "verificação" encontra.
5. "Gerar" e logo "Aprimorar" em seguida (dois salvamentos seguidos): no fim o item continua com 2 fotos (SQL: `photos` com 2 caminhos que existem em `storage.objects`).
6. Recarregar a página, limpar o formulário, escolher "Sérum verificação" em Produto → ficha e 2 fotos voltam; na aba Network **não** há chamada a `/api/analyze-references`.
7. Trocar uma das fotos e gerar de novo → SQL: item com 2 fotos, a antiga removida do Storage, `analysis` mantida só se a análise foi refeita.
8. Fixar pelo aviso; a aba Fixados mostra o item; desafixar volta para Recentes.
9. Criar marcas até passar de 3 → janela "Limite do seu plano".
10. Biblioteca: favoritar, filtrar Favoritos, Reabrir (campos voltam), Copiar, apagar.
11. Apagar "Loja teste" e as marcas extras pelo "Gerenciar marcas"; apagar o item e os prompts de teste da "Minha marca".
12. SQL final: nenhum item, prompt ou foto de teste sobrando; `list_orphan_brand_photos(now())` vazio; `system_logs` sem erros novos; assinatura de teste de volta a `canceled`.
