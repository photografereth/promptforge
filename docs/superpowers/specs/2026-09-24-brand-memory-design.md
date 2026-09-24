# Memória da Marca na Nuvem — Design

Status: Approved
Date: 2026-09-24
Depends on: Pilar 1 (auth/dados), Pilar 2 (`requireActiveSubscription`), Pilar 5 (rate limit por IP, logger)
Unblocks: Lotes (variações, vários produtos, sequência multi-cena) — spec separado, usa os ativos salvos daqui

## Contexto

Brainstorm de produto (2026-09-24) sobre o que faz a assinatura valer a
pena sem hesitar. Prioridade declarada pelo usuário: **fosso competitivo**
primeiro, depois **inteligência de venda** e **velocidade**.

Levantamento de mercado no mesmo dia:

- O concorrente mais direto, **UGC·AI**, também gera só prompts para TikTok
  Shop, cobra R$ 69,90 / 127,90 / 247,90 e já tem lote de até 20 produtos e
  galeria salva. Nós cobramos R$ 119 com menos recursos.
- Gerar vídeo dentro do app não é fosso: pelo Google Flow (Google AI Pro,
  R$ 96,99/mês, 1.000 créditos) o usuário paga ~R$ 1,95 por vídeo Veo 3.1
  Fast; pela API o mesmo vídeo nos custaria ~R$ 4,40–5,30 antes de novas
  tentativas. Geração in-app fica para depois, via créditos.

Estado atual no código:

- Histórico em `localStorage` (`flow_prompt_forge_history_v2`), limitado a
  12 itens (`src/App.tsx:271`), só naquele navegador.
- `PromptHistoryItem` (`src/types.ts:95`) não guarda as fotos de referência;
  elas se perdem ao recarregar a página.
- `ProductAnchor` e `CharacterAnchor` (`src/types.ts:5-18`) são preenchidos
  de novo a cada sessão. Não existem como entidades reutilizáveis.
- Reenviar as mesmas fotos roda a análise da IA (`api/analyze-references.ts`)
  de novo e consome cota.
- Preferências (`UserPreferences`, `src/types.ts:87`) já são um "kit da
  marca" embrionário, mas ficam só no navegador e valem para a conta inteira.

## Objetivo

Transformar o que o usuário cria em **ativos salvos na conta dele**,
organizados por **marca**: produtos e elenco (com fotos e análise), kit da
marca e biblioteca de prompts ilimitada. Escolher um produto e uma criadora
salvos preenche tudo na hora, sem reenviar fotos nem gastar cota. Quanto
mais o usuário acumula, mais caro fica trocar de ferramenta.

## Decisões tomadas no brainstorm

| Decisão | Escolha |
|---|---|
| Organização | **Marcas como pastas.** Cada conta começa com uma "Minha marca" criada automaticamente |
| Escopo da v1 | Os quatro ativos: produtos, elenco, kit da marca e biblioteca, mais a importação do histórico do navegador |
| Como os ativos entram | **Híbrido.** Tudo que é usado entra em "Recentes" (20 por marca, renovação automática); o usuário **fixa** o que quer manter |
| Limites (plano atual) | **3 marcas, 30 ativos fixados por marca, 4 fotos por ativo**, biblioteca ilimitada |
| Arquitetura | **Tudo pela nossa API**, com tabelas fechadas ao cliente (RLS sem policies), mesmo padrão do billing e das cotas |

## Não-objetivos (fora de escopo desta versão)

- **Plano Agência / criadores trabalhando para terceiros.** Previsto: um
  plano mais caro com limites maiores de marcas. Nesta versão os limites
  ficam num arquivo de configuração por plano justamente para que esse
  plano seja só uma nova entrada, sem mudar a arquitetura.
- Lotes de qualquer tipo (spec próprio, depois deste).
- Guardar fotos de **cenário** (cenário não é um ativo nesta versão).
- Compartilhar marcas entre contas / equipes com vários usuários.
- Exclusão de conta feita pelo próprio usuário (continua por e-mail; ver
  `deleteAllUserMemory` abaixo).
- Geração de imagem ou vídeo dentro do app.
- Acesso somente leitura para quem cancelou (quem cancela perde o acesso,
  mas os dados ficam guardados).

## Design

### 1. Modelo de dados (migração `0007_brand_memory.sql`)

Todas as tabelas com RLS ligado e **sem policies**: só o servidor, com a
chave de serviço, acessa (mesmo padrão de `system_logs` e `ip_rate_limit`).

```sql
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
create index brands_user_idx on public.brands (user_id);

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
create index brand_assets_list_idx on public.brand_assets (brand_id, kind, pinned, last_used_at desc);

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
```

- **`kit`** tem o mesmo formato de `UserPreferences` (`autoApply`,
  `preferredAgent`, `preferredStyle`, `preferredPalette`, `preferredCamera`).
  Fica dentro de `brands` porque é sempre 1 para 1 com a marca.
- **`data`** guarda a ficha (`ProductAnchor` ou `CharacterAnchor`).
- **`analysis`** guarda o resultado bruto da análise da IA (inclui
  `consistencySummary`). É zerado sempre que as fotos mudam.
- **`photos`** é uma lista de até 4 `{ path, mime, size }`.
- **Recentes** são os ativos com `pinned = false`.
- **`legacy_id`** guarda o id do item do histórico antigo, para a importação
  não duplicar.

**Storage:** bucket **privado** `brand-assets`. Caminho sempre gerado pelo
servidor: `{user_id}/{brand_id}/{asset_id}/{uuid}.{ext}`. Leitura só por
links assinados válidos por 1 hora.

**Limites** num único arquivo, `api/_lib/memory/limits.ts`:

```ts
export const MEMORY_LIMITS = {
  default: { brands: 3, pinnedAssetsPerBrand: 30, recentAssetsPerBrand: 20, photosPerAsset: 4 },
} as const;
```

Tamanhos máximos (contra abuso): nome até 80 caracteres; `data` até 20 KB;
`state` até 50 KB; cada texto de prompt até 20 KB; foto até 2 MB
(`image/jpeg`, `image/png` ou `image/webp`).

### 2. API (`api/memory/[action].ts`)

Uma rota só, porque o plano Hobby da Vercel permite no máximo 12 funções
(hoje são 8; com esta, 9). Barreiras na ordem: `requireIpRateLimit` →
`authenticate` → `requireActiveSubscription`. Sem cota de IA (a memória
não chama o Gemini). Roteador no formato de `api/_lib/billing/router.ts`:
tabela `ação → método → handler`, e só campos conhecidos do corpo chegam
aos serviços.

| Ação | Método | O que faz |
|---|---|---|
| `brands` | GET | Lista as marcas. Se não houver nenhuma, cria a "Minha marca" (`is_default`) |
| `brands` | POST | Cria marca (checa o limite) |
| `brands` | PATCH | Renomeia e/ou atualiza o kit |
| `brands` | DELETE | Apaga a marca, seus ativos, sua biblioteca e as fotos no Storage. Recusa se for a última. Se era a padrão, a mais antiga restante vira padrão |
| `assets` | GET | Lista os ativos de uma marca (fixados + recentes), com links de foto assinados |
| `assets` | PATCH | Fixa/desafixa (checa o limite ao fixar), renomeia, edita a ficha ou a análise |
| `assets` | DELETE | Apaga o ativo e as fotos |
| `use-asset` | POST | Salvamento automático ao gerar um prompt. Recebe `{ brandId, kind, name, data, analysis? }`. Cria ou atualiza pela chave `(marca, tipo, nome)`, atualiza `last_used_at` e, se passar de 20 recentes na marca, apaga o mais antigo **e as fotos dele**. `analysis` é o resultado que o app já obteve de `analyze-references` na sessão, quando houver |
| `photo-upload` | POST | Recebe até 4 fotos de uma vez (`{ assetId, files: [{ mime, size }] }`), checa o limite de fotos, tipo e tamanho, e devolve um link de upload temporário por foto, com o caminho gerado pelo servidor |
| `photo-confirm` | POST | Recebe até 4 caminhos. Recusa qualquer caminho fora do prefixo `{userId}/{brandId}/{assetId}/`, confere no Storage se o arquivo existe e se o tamanho real está dentro do limite, registra as fotos no ativo e zera `analysis` |
| `photo-remove` | POST | Remove a foto do ativo e do Storage e zera `analysis` |
| `prompts` | GET | Lista paginada da biblioteca da marca: 20 por página, cursor `(created_at, id)`, busca por `title`/`product_name` (`ilike`), filtro de favoritos |
| `prompts` | POST | Salva um prompt na biblioteca |
| `prompts` | PATCH | Favorita/desfavorita |
| `prompts` | DELETE | Apaga um prompt |
| `import-local` | POST | Importação única do histórico do navegador (até 12 itens) e das preferências antigas para a "Minha marca". Não duplica, pela chave `legacy_id`. As preferências só viram o kit se o kit da "Minha marca" ainda estiver vazio |

Respostas de erro seguem o padrão existente `{ error, code? }`:

- **404** para rota inexistente **e** para qualquer recurso que não é do
  usuário (sem revelar que existe).
- **405** para método errado.
- **409** com `code: 'limit_reached'` e `limit: 'brands' | 'pinnedAssets' | 'photos'`
  ao passar de um limite.
- **400** para entrada inválida (tamanho, tipo, campo obrigatório).

### 3. Regras de negócio (`api/_lib/memory/`)

Mesmo padrão dos pilares anteriores: lógica pura e testada, com o acesso ao
banco e ao Storage atrás de interfaces injetáveis.

- `types.ts`: tipos de marca, ativo, prompt e das duas interfaces:
  - `MemoryRepo`: todos os métodos recebem `userId` e filtram por ele.
  - `StoragePort`: `createUploadUrls(paths)`, `createReadUrls(paths)`, `stat(path)`, `remove(paths)`, `listOlderThan(prefix, date)`.
- `limits.ts`: `MEMORY_LIMITS`, com os tamanhos máximos.
- `testing/memoryRepo.ts` e `testing/memoryStorage.ts`: versões em memória para o Vitest.
- `repo.ts` e `storage.ts`: implementações Supabase. Sem teste direto, mesmo padrão dos outros repositórios Supabase do projeto.
- `service/*.ts`: uma função por ação, cada uma recebendo `(deps, user, input)`.
- `router.ts`: `routeMemory(deps, user, action, method, body)`.
- `deleteAllUserMemory(deps, userId)`: apaga marcas (e em cascata o resto) e todos os arquivos sob `{userId}/`. Usada pelo suporte em pedidos de exclusão (LGPD) até existir exclusão pelo próprio usuário.

**Regra central de segurança:** como a chave de serviço ignora o RLS, o
isolamento entre usuários depende **inteiramente** do código. Todo método
do `MemoryRepo` exige `userId`, e nenhuma consulta existe sem esse filtro.

**Limites e concorrência:** a checagem é "contar e depois gravar". Dois
pedidos simultâneos (duas abas) podem, raramente, passar do limite por 1.
Aceito nesta versão (ver Riscos).

**Fotos órfãs** (link de upload pedido, mas foto nunca confirmada): o cron
diário existente (`api/cron/billing.ts`) chama
`cleanupOrphanPhotos()`, que apaga do Storage os arquivos com mais de 24h
que nenhum ativo referencia. Mesmo padrão de `cleanupOldWindows` e
`cleanupOldLogs`: falha registrada com `logWarn`, sem derrubar o cron.

**Logs:** falhas via `logError`/`logWarn` só com `errorName(err)` e ids.
Nunca nome de produto, ficha, texto de prompt ou dado da marca.

### 4. Experiência no app

O ponto de ligação já existe: toda geração passa por `saveToHistory`
(`src/App.tsx:245`).

1. **Seletor de marca no Header.** Mostra a marca atual; lista as marcas;
   "+ Nova marca"; "Gerenciar marcas" (renomear, apagar). Trocar de marca
   troca ativos, kit e biblioteca exibidos.
2. **"Meus padrões" vira "Kit da marca".** É a mesma tela
   (`PreferencesModal`), agora salva na nuvem e por marca.
3. **Botões "Produto: escolher ▾" e "Criadora: escolher ▾"** acima das
   galerias de referência. O seletor tem abas **Fixados** e **Recentes**,
   com miniatura e nome, e um 📌 para fixar. Escolher preenche a ficha, as
   fotos e a análise; se o ativo já tem `analysis`, o app **não chama a IA
   de novo**. Preencher do zero continua funcionando como hoje.
4. **Salvamento automático ao gerar**, em segundo plano: o prompt vai para
   a biblioteca da marca, e o produto e a criadora usados vão para
   "Recentes" (`use-asset`). As fotos só são enviadas quando mudaram, em
   lote (`photo-upload` e `photo-confirm`): as **4 primeiras** da galeria do
   produto (`productImages`) e da galeria da criadora (`characterImages`),
   na ordem em que aparecem. Se a galeria tiver mais, o aviso diz que só as
   4 primeiras foram guardadas. Aviso discreto:
   *"Sérum X salvo nos recentes. 📌 Fixar"*.
5. **"Histórico" vira "Biblioteca"** (`HistoryDrawer`): busca, filtro
   "⭐ Favoritos", rolagem infinita e "Reabrir", que restaura os campos.
6. **Limite atingido:** janela explicando o limite e o que fazer
   ("desafixe algum item"). A mensagem de marcas já fica escrita pensando
   no futuro plano Agência.
7. **Importação no primeiro acesso:** o histórico e as preferências do
   navegador vão para a "Minha marca"; aviso *"Importamos seus N prompts
   recentes"*. A cópia local só é apagada **depois** da confirmação do
   servidor.
8. **A memória nunca bloqueia a geração.** Se salvar falhar, o prompt é
   gerado e exibido normalmente, com o aviso *"Não foi possível salvar na
   nuvem, tente novamente"*.
9. **Links de foto expirados** (app aberto há mais de 1h): quando uma
   imagem falha ao carregar, a tela pede links novos.

### 5. Documentos legais

Fotos de criadoras e modelos são **dado pessoal** (rosto). Junto com o
preenchimento dos dados legais já pendente:

- **Política de Privacidade:** informar que fotos, fichas e prompts ficam
  guardados na conta enquanto ela existir, e os logs de erro por 30 dias.
- **Termos de Uso:** o usuário declara ter direito ou autorização sobre as
  imagens de pessoas que envia.

## Testes

TDD, mesmo padrão dos pilares anteriores.

**Backend** (`api/_lib/memory/`, com repositório e Storage em memória):

- Limites: 4ª marca → 409 `brands`; 31º fixado → 409 `pinnedAssets`;
  5ª foto → 409 `photos`.
- Poda de recentes: o 21º recente apaga o mais antigo **e as fotos dele**;
  fixados nunca são podados.
- `use-asset` atualiza (sem duplicar) quando o nome já existe, ignorando
  maiúsculas/minúsculas.
- Trocar ou remover foto zera `analysis`.
- `photo-confirm` recusa caminho fora do prefixo, arquivo inexistente e
  arquivo acima de 2 MB.
- Não dá para apagar a última marca; apagar a padrão promove outra.
- `import-local` não duplica numa segunda chamada; não sobrescreve um kit
  já preenchido.
- `GET brands` sem marcas cria exatamente uma "Minha marca".
- **Isolamento entre usuários:** para **cada ação**, o usuário B recebe 404
  ao tentar ler, editar, apagar ou confirmar foto de marca, ativo ou prompt
  do usuário A.
- `deleteAllUserMemory` remove tudo do usuário e nada de outro.
- Roteador: ação inexistente → 404, método errado → 405, campos
  desconhecidos do corpo descartados.

**Frontend:** o `vitest.config.ts` passa a incluir também
`src/**/*.test.ts`, **só para funções puras** (converter o histórico antigo
para o formato de `import-local`; preencher o formulário a partir de um
ativo). Sem biblioteca nova de testes. As telas são verificadas
manualmente no navegador, em produção.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Vazamento entre usuários (a chave de serviço ignora o RLS) | Todo método do `MemoryRepo` exige `userId`; testes de isolamento por ação; foco explícito do revisor final |
| Confirmar foto num caminho de outro usuário | Caminho gerado pelo servidor; `photo-confirm` recusa qualquer caminho fora de `{userId}/{brandId}/{assetId}/` |
| Tamanho declarado no upload diferente do real | `photo-confirm` confere o tamanho real no Storage |
| Rate limit por IP (100 a cada 5 min) atingido por uso normal | Upload e confirmação em lote, e fotos só enviadas quando mudaram: no máximo ~7 chamadas por geração |
| Passar do limite por 1 com duas abas simultâneas | Aceito nesta versão; impacto é um item a mais |
| Fotos de rostos são dado pessoal (LGPD) | Atualização da Política e dos Termos (seção 5); `deleteAllUserMemory` para pedidos de exclusão |
| Storage gratuito de 1 GB esgotar | Consulta de uso no runbook; migrar para o Supabase Pro ao chegar em ~70% |
| Links de foto expiram com o app aberto | A tela pede links novos quando a imagem falha |
| Limite de funções da Vercel (12 no Hobby) | Uma rota só (9 de 12) |
| Importação duplicada em dois aparelhos | Chave `legacy_id` única por usuário |

## Entrega

Dois planos, cada um com PR e deploy próprios, pelo fluxo de
`docs/superpowers/runbooks/2026-09-22-deploy-workflow.md`:

1. **Backend:** migração 0007, bucket `brand-assets`, regras, rota
   `/api/memory/[action]`, `cleanupOrphanPhotos` no cron. Vai ao ar sem
   mudança visível (ninguém chama a API ainda).
2. **Frontend:** seletor de marca, kit, seletores de produto e criadora,
   salvamento automático, biblioteca, importação do histórico. É o
   lançamento para o usuário.
