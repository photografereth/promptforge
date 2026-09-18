# Pilar 1: Fundação de Dados e Autenticação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o gate de "licença" falso (localStorage) por contas reais via Supabase Auth e um registro persistente de assinatura (Supabase Postgres), migrando o backend de Express (`server.ts`) para Vercel Serverless Functions.

**Architecture:** Frontend (Vite/React) usa `@supabase/supabase-js` diretamente para login/signup (Google + e-mail/senha) e anexa o access token em toda chamada à API. Backend vira um conjunto de funções serverless em `/api/*.ts`, cada uma validando o token via um client Supabase (`anon` key) antes de processar. Um `profiles` table 1:1 com `auth.users` guarda `subscription_status` (placeholder, sem paywall real ainda).

**Tech Stack:** React 19, Vite, TypeScript, Vercel Serverless Functions (`@vercel/node`), Supabase (`@supabase/supabase-js`, Postgres, Auth), `@google/genai` (já existente).

**Spec:** `docs/superpowers/specs/2026-09-18-auth-database-foundation-design.md`

## Global Constraints

- Toda copy de UI é em português do Brasil, no mesmo tom já usado no projeto (`font-mono`, uppercase, `[ COLCHETES ]` para labels de destaque).
- Não introduzir framework de testes automatizados — fora de escopo deste pilar. Validação é manual via `vercel dev` + curl/navegador, conforme cada task descreve.
- Variáveis de ambiente do Supabase usam exatamente estes nomes: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend, expostas ao bundle Vite), `SUPABASE_URL`, `SUPABASE_ANON_KEY` (backend, `/api/*`), `SUPABASE_SERVICE_ROLE_KEY` (reservada para o Pilar 2 — nenhum código deste plano a utiliza; nunca deve ir em variável `VITE_`-prefixada).
- Funções em `/api` são handlers default-export `(req: VercelRequest, res: VercelResponse)`, compatíveis com `"type": "module"` do `package.json`.
- Imagens enviadas para análise multimodal são comprimidas no navegador antes do envio (canvas, JPEG, lado maior ≤ 1600px) para respeitar o limite de 4.5MB por requisição das Vercel Serverless Functions.
- `server.ts` é removido ao final (Task 8) — nenhum código morto do Express permanece no repositório.

---

### Task 1: Provisionar projeto Supabase, credenciais Google OAuth e aplicar a migração SQL

**Este é um passo manual que só o usuário pode executar** (requer acesso às contas Supabase e Google Cloud do usuário) — não é uma tarefa de código.

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

**Interfaces:**
- Produces: tabela `public.profiles`, enums `subscription_status`/`subscription_plan`, trigger `on_auth_user_created` — usados por todo o resto do plano indiretamente (via Supabase Auth), e diretamente pelo Pilar 2 no futuro.

- [ ] **Step 1: Escrever a migração SQL**

Criar `supabase/migrations/0001_profiles.sql`:

```sql
-- Pilar 1: Fundação de dados e autenticação
-- Cria o enum de status de assinatura, a tabela de perfis (1:1 com auth.users),
-- políticas de RLS, e o trigger que popula o perfil automaticamente no signup.

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

-- Auto-cria a linha de perfil sempre que um novo usuário se cadastra.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'display_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 2: Criar (ou reutilizar) o projeto no Supabase**

Acesse https://supabase.com/dashboard, crie um novo projeto (ou use um existente dedicado a este produto). Anote a região mais próxima do público-alvo (ex: `sa-east-1` para Brasil).

- [ ] **Step 3: Aplicar a migração**

No painel do Supabase, abra **SQL Editor** → **New query**, cole o conteúdo de `supabase/migrations/0001_profiles.sql` e execute. Confirme em **Table Editor** que a tabela `profiles` foi criada.

- [ ] **Step 4: Configurar provedores de autenticação**

Em **Authentication → Providers**:
- **Email**: já vem habilitado por padrão; em **Authentication → Settings**, desative "Confirm email" por enquanto (MVP sem fricção de confirmação — sessão é criada imediatamente no signup; reative quando o produto tiver um fluxo de confirmação de e-mail cuidado).
- **Google**: habilite o provedor. Você vai precisar de um **Client ID** e **Client Secret** OAuth do Google Cloud Console (Google exige isso para qualquer "Login com Google", independente de onde a infraestrutura roda): vá em https://console.cloud.google.com/apis/credentials, crie um "OAuth 2.0 Client ID" do tipo "Web application", e adicione como **Authorized redirect URI** a URL de callback que o próprio painel do Supabase mostra na tela do provedor Google (formato `https://<seu-projeto>.supabase.co/auth/v1/callback`). Cole o Client ID e Secret de volta no Supabase.

Em **Authentication → URL Configuration**, adicione `http://localhost:3000` em **Redirect URLs** (para o dev local com `vercel dev`); mais tarde adicione a URL de produção da Vercel quando o Pilar 4 (deploy) existir.

- [ ] **Step 5: Copiar as credenciais**

Em **Settings → API**, copie:
- **Project URL** → vai virar `SUPABASE_URL` e `VITE_SUPABASE_URL`.
- **anon public** key → vai virar `SUPABASE_ANON_KEY` e `VITE_SUPABASE_ANON_KEY`.
- **service_role** key → vai virar `SUPABASE_SERVICE_ROLE_KEY` (guarde-a; não é usada por nenhum código deste plano, mas o Pilar 2 vai precisar).

- [ ] **Step 6: Criar `.env.local`**

Crie `.env.local` na raiz do projeto (já ignorado pelo `.gitignore` existente) com as 6 variáveis (as 5 do Supabase + `GEMINI_API_KEY` que você já usa). O formato exato é definido na Task 2.

- [ ] **Step 7: Commit da migração**

```bash
git add supabase/migrations/0001_profiles.sql
git commit -m "feat: add Supabase profiles table migration for Pilar 1"
```

---

### Task 2: Instalar dependências e atualizar `.env.example`

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Produces: `@supabase/supabase-js` disponível para import em frontend e backend; `@vercel/node` disponível para tipos `VercelRequest`/`VercelResponse`; `vercel` CLI disponível via `npm run dev`.

- [ ] **Step 1: Instalar as dependências**

```bash
npm install @supabase/supabase-js
npm install --save-dev @vercel/node vercel
```

- [ ] **Step 2: Atualizar `.env.example`**

Substituir o conteúdo de `.env.example` por:

```
# GEMINI_API_KEY: Required for Gemini AI API calls (server-side only, read by /api functions).
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# APP_URL: Optional self-referential URL (kept for compatibility with prior tooling).
APP_URL="MY_APP_URL"

# Supabase project credentials — get these from Settings > API in your Supabase project.
# VITE_-prefixed vars are exposed to the browser bundle by Vite; the plain ones are read
# server-side by the Vercel functions under /api (Node runtime, not bundled by Vite).
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"

# SUPABASE_SERVICE_ROLE_KEY: reserved for Pilar 2 (Mercado Pago webhook). No code in this
# pilar uses it yet. NEVER put it in a VITE_-prefixed variable — it must never reach the browser.
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
```

- [ ] **Step 3: Verificar**

Rode `cat .env.local` (criado na Task 1) e confirme que os 5 nomes de variável acima estão preenchidos com valores reais do seu projeto Supabase, mais o `GEMINI_API_KEY` já existente.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add Supabase and Vercel dependencies"
```

---

### Task 3: Libs compartilhadas do backend (`api/_lib`) + rota de health check

**Files:**
- Create: `api/_lib/supabaseAnon.ts`
- Create: `api/_lib/auth.ts`
- Create: `api/_lib/gemini.ts`
- Create: `api/_lib/parseImageData.ts`
- Create: `api/health.ts`

**Interfaces:**
- Produces:
  - `supabaseAnon: SupabaseClient` (de `api/_lib/supabaseAnon.ts`)
  - `authenticate(req: VercelRequest, res: VercelResponse): Promise<{ id: string; email: string } | null>` (de `api/_lib/auth.ts`) — já escreve a resposta 401 e retorna `null` se não autenticado.
  - `getGemini(): GoogleGenAI` e `generateWithFallback(ai, options, timeoutMs?): Promise<any>` (de `api/_lib/gemini.ts`)
  - `parseImageData(input: any): { data: string; mimeType: string } | null` (de `api/_lib/parseImageData.ts`)
- Consumes: nada (é a base para as Tasks 4-7).

- [ ] **Step 1: Criar `api/_lib/supabaseAnon.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'SUPABASE_URL e SUPABASE_ANON_KEY precisam estar definidas no ambiente do servidor.'
  );
}

export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Criar `api/_lib/auth.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAnon } from './supabaseAnon';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

// Valida o Bearer token do Supabase. Em caso de falha, já escreve a resposta 401
// e retorna null — o handler chamador só precisa checar `if (!user) return;`.
export async function authenticate(
  req: VercelRequest,
  res: VercelResponse
): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Não autenticado.' });
    return null;
  }

  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'Não autenticado.' });
    return null;
  }

  return { id: data.user.id, email: data.user.email || '' };
}
```

- [ ] **Step 3: Criar `api/_lib/gemini.ts`**

Move a lógica de `server.ts:18-88` sem alterar o comportamento:

```ts
import { GoogleGenAI } from '@google/genai';

export function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente do servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Nota: este estado vive na memória do processo da função serverless. Em cold starts
// da Vercel, uma nova invocação pode não compartilhar essa memória, então o circuit
// breaker perde efeito entre invocações frias — limitação conhecida, resolvida de
// verdade só quando o Pilar 3 introduzir estado compartilhado (quota/fila).
let lastGeminiHighDemandTime = 0;

function getPreferredModels(): string[] {
  if (Date.now() - lastGeminiHighDemandTime < 180000) {
    return ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  }
  return ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
}

export async function generateWithFallback(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
  },
  timeoutMs = 18000
): Promise<any> {
  const models = getPreferredModels();
  let lastError: any = null;

  for (const modelName of models) {
    try {
      const generatePromise = ai.models.generateContent({
        model: modelName,
        contents: options.contents,
        config: options.config,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout na chamada (${modelName})`)), timeoutMs)
      );

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      if (response && (response.text || response.candidates?.length)) {
        return response;
      }
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || '');
      if (
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('429')
      ) {
        lastGeminiHighDemandTime = Date.now();
      }
    }
  }

  throw lastError || new Error('Falha em todos os modelos de IA disponíveis.');
}
```

- [ ] **Step 4: Criar `api/_lib/parseImageData.ts`**

Move `server.ts:352-367` sem alterar o comportamento:

```ts
export function parseImageData(input: any): { data: string; mimeType: string } | null {
  if (!input) return null;
  let dataStr = typeof input === 'string' ? input : input.data || input.dataUrl || '';
  let mimeType = input.mimeType || 'image/jpeg';

  if (!dataStr || typeof dataStr !== 'string') return null;

  const match = dataStr.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    dataStr = match[2];
  }

  return { data: dataStr.trim(), mimeType };
}
```

- [ ] **Step 5: Criar `api/health.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({ status: 'ok', service: 'Flow Prompt Forge API - TikTok Shop & 3 Agents' });
}
```

- [ ] **Step 6: Verificar tipos**

```bash
npm run lint
```

Expected: sem erros de TypeScript.

- [ ] **Step 7: Rodar `vercel dev` e testar o health check**

```bash
npx vercel dev
```

Na primeira execução, a CLI vai perguntar para linkar um projeto Vercel (pode criar um novo, ex: `promptforge`) e vai detectar o framework Vite automaticamente. Deixe rodando e, em outro terminal:

```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok","service":"Flow Prompt Forge API - TikTok Shop & 3 Agents"}`

- [ ] **Step 8: Commit**

```bash
git add api/_lib api/health.ts
git commit -m "feat: add shared backend libs (Supabase auth, Gemini, image parsing) and health check"
```

---

### Task 4: Migrar `/api/autofill`

**Files:**
- Create: `api/autofill.ts`
- Modify: `server.ts:180-281` (removido nesta rota; arquivo inteiro será apagado na Task 8)

**Interfaces:**
- Consumes: `authenticate` de `api/_lib/auth.ts`, `getGemini`/`generateWithFallback` de `api/_lib/gemini.ts`.
- Produces: endpoint `POST /api/autofill`, protegido por auth, mesmo contrato de request/response que hoje (`{ idea, mode, agent, product }` → `{ success, data, fallback? }`).

- [ ] **Step 1: Criar `api/autofill.ts`**

Porta `server.ts:180-281` (rota + `parseIdeaLocally`, que só é usada aqui), adicionando o gate de autenticação e o check de método:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_lib/auth';
import { getGemini, generateWithFallback } from './_lib/gemini';

// Fallback local calibrado para os 3 agentes TikTok Shop & âncora de produto
function parseIdeaLocally(
  idea: string,
  mode: 'video' | 'image',
  agent: 'pov' | 'ugc' | 'motion' = 'ugc',
  product?: any
) {
  const prodName = product?.nome?.trim() || 'o produto';
  const prodDetails = product?.caracteristicasVisuais?.trim() || '';

  if (mode === 'video') {
    if (agent === 'pov') {
      return {
        sujeito: `Mãos do criador interagindo em close-up com ${prodName}${prodDetails ? ` (${prodDetails})` : ''}`,
        acao: 'abrindo a embalagem e demonstrando o uso prático com gestos firmes e naturais',
        cenario: 'bancada limpa e moderna com iluminação lateral suave e espaço livre inferior',
        estilo: 'Filme ultra realista em 4K, ótica real com detalhes táteis nítidos, textura orgânica de pele',
        enquadramento: 'Plano médio em 1ª pessoa (POV), ângulo ligeiramente inclinado para baixo',
        lente: 'Profundidade de campo rasa focando no produto e nas mãos',
        iluminacao: 'luz natural suave de janela com reflexos autênticos nos materiais',
        humor: 'imersivo, autêntico e focado na experiência sensorial',
        dialogo: '',
        sfx: 'som tátil sutil de abertura da tampa e clique da embalagem',
        somAmbiente: 'sala tranquila com sensação acolhedora e realista',
        hookVisual: 'mão trazendo o produto rapidamente para o centro da câmera nos primeiros 2 segundos',
        evitar: 'sem alegações médicas exageradas, sem elementos cobrindo a barra de compra do TikTok',
        duracao: '8s',
        proporcao: '9:16',
      };
    } else if (agent === 'ugc') {
      return {
        sujeito: `Criador autêntico do TikTok segurando ${prodName} com expressão natural de teste real`,
        acao: 'mostrando o produto para a câmera frontal de smartphone e aplicando de forma descomplicada',
        cenario: 'quarto contemporâneo bem organizado com iluminação acolhedora e estética TikTok real',
        estilo: 'Vídeo ultra realista em 4K gravado com smartphone de alta gama, cores fiéis e textura de pele real',
        enquadramento: 'Plano médio vertical (câmera frontal na altura dos olhos)',
        lente: 'Grande angular suave típica de smartphone de última geração',
        iluminacao: 'iluminação difusa suave (softbox caseiro) sem estourar o produto',
        humor: 'espontâneo, confiável e vibrante sem parecer comercial engessado',
        dialogo: 'Olha a textura disso aqui quando você aplica na prática',
        sfx: 'som natural de manuseio e voz limpa',
        somAmbiente: 'ambiente acústico controlado de quarto moderno',
        hookVisual: 'expressão surpresa mostrando o produto logo no primeiro segundo',
        evitar: 'sem promessas milagrosas ou cura, sem logotipos concorrentes, sem cobrir o canto inferior direito',
        duracao: '8s',
        proporcao: '9:16',
      };
    } else {
      return {
        sujeito: `${prodName} em destaque comercial cinematográfico${prodDetails ? ` com ${prodDetails}` : ''}`,
        acao: 'girando suavemente em 360 graus em slow-motion fluido enquanto a luz varre o acabamento',
        cenario: 'estúdio comercial minimalista com pedestal de apoio e iluminação volumétrica',
        estilo: 'Comercial de produto ultra realista em 4K com física precisa de luz e materiais reais',
        enquadramento: 'Travelling orbital dinâmico e plano detalhe com foco nas texturas',
        lente: 'Lente macro cinema com foco seletivo no logotipo e detalhes da fórmula',
        iluminacao: 'iluminação de estúdio comercial com luz de recorte e reflexos metálicos/vidro precisos',
        humor: 'sofisticado, hipnótico e com alto valor percebido de produto',
        dialogo: '',
        sfx: 'woosh suave de transição de câmera e som límpido de alta definição',
        somAmbiente: 'graves elegantes e sensação de estúdio comercial moderno',
        hookVisual: 'câmera mergulhando em alta velocidade e desacelerando no produto com reflexo luminoso',
        evitar: 'sem distorções digitais, sem efeito plástico de CGI falso, sem elementos na área da sacola de compras',
        duracao: '8s',
        proporcao: '9:16',
      };
    }
  } else {
    return {
      sujeito: `${prodName} em composição ultra realista${prodDetails ? ` (${prodDetails})` : ''}`,
      acao: agent === 'pov' ? 'segurado por mãos cuidadosas em ângulo em 1ª pessoa' : 'posicionado em ângulo de destaque comercial',
      cenario: 'ambiente limpo e com iluminação de alta qualidade para e-commerce TikTok Shop',
      estilo: 'Fotografia comercial ultra realista em 8K, ótica de alta definição e física de luz natural',
      composicao: 'vertical 9:16 centralizada com safe zone inferior para carrinho do TikTok Shop',
      iluminacao: 'luz suave e bem direcionada revelando relevo e acabamento do material',
      paleta: 'cores realistas e fiéis ao produto real',
      humor: 'atraente, profissional e autêntico',
      materiais: prodDetails || 'vidro/plástico com reflexos nítidos e acabamento premium',
      evitar: 'sem claims médicos, sem filtros artificiais plásticos, sem texto nos cantos',
      proporcao: '9:16',
      isEdit: false,
      editMudar: '',
      editManter: '',
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
  if (!user) return;

  const { idea, mode, agent = 'ugc', product = {} } = req.body;
  if (!idea || typeof idea !== 'string') {
    return res.status(400).json({ error: 'A descrição da ideia é obrigatória.' });
  }

  try {
    const ai = getGemini();

    const agentDescription =
      agent === 'pov'
        ? 'AGENTE POV (Ponto de Vista em 1ª pessoa): foco absoluto na perspectiva dos olhos do usuário, mãos interagindo, unboxing ou aplicação direta do produto, profundidade de campo sutil.'
        : agent === 'ugc'
        ? 'AGENTE UGC (Criador Autêntico TikTok Shop): estilo smartphone 4K real, criador espontâneo reagindo e testando o produto, com gancho (hook) visual forte nos primeiros 2 segundos, energia autêntica de social proof.'
        : 'AGENTE MOVIMENTO (B-Roll Dinâmico Comercial): planos cinematográficos de produto em movimento, rotação 360°, slow-motion, iluminação de estúdio comercial com reflexos nos materiais.';

    const productAnchorInfo = product?.nome
      ? `PRODUTO ANCORADO (Consistência inegociável):
- Nome: ${product.nome}
- Categoria: ${product.categoria || 'Geral'}
- Características visuais invariáveis: ${product.caracteristicasVisuais || 'Não especificado'}
- Benefício/Ação visual: ${product.beneficioVisual || 'Uso padrão'}
MANTENHA ESTAS CARACTERÍSTICAS FÍSICAS RIGOROSAMENTE IDÊNTICAS!`
      : 'Nenhum produto pré-ancorado especificado; defina o sujeito de produto claramente a partir da ideia.';

    const promptText = `Você é um diretor de cena e estrategista de criativos para TikTok Shop especializado no Google Flow (modelos de vídeo como Omni 1.1 Flash e Veo para vídeo de até 10s, e Nano Banana para imagem).
Sua missão é decompor a ideia do usuário em campos estruturados em português do Brasil, garantindo:
1. Agente Selecionado: ${agentDescription}
2. Consistência de Produto: ${productAnchorInfo}
3. Conformidade estrita com Políticas do TikTok Shop: PROIBIDO alegações médicas de cura ("cura rugas", "elimina 100% de celulite"), proibições financeiras, antes/depois milagroso. Foco na demonstração sensorial e funcional autêntica.
4. Padrão "VÍDEO ULTRA REALISTA": Câmera real, textura natural de pele e materiais físicos, sem look plástico de IA.
5. Formato padrão: vertical 9:16 com Safe Zone para o carrinho e botões do TikTok Shop.
6. Duração compatível: 4s, 6s, 8s ou 10s (máximo 10s para alta retenção).

O modo atual é: ${mode === 'video' ? 'VÍDEO (Google Flow Omni 1.1 Flash / Veo - Ultra Realista até 10s)' : 'IMAGEM (Google Flow Nano Banana - Ultra Realista)'}.

Retorne ESTRITAMENTE um JSON puro válido (sem markdown, sem explicações):
${
  mode === 'video'
    ? `{
  "sujeito": "Sujeito principal coerente com o agente e produto consistente",
  "acao": "Ação específica e ultra realista (gesto com mãos para POV, reação/teste para UGC, rotação/B-roll para Movimento)",
  "cenario": "Contexto estético compatível com TikTok Shop",
  "estilo": "Filme ultra realista em 4K, textura orgânica, ótica precisa sem artefatos plásticos",
  "enquadramento": "Enquadramento recomendado para o agente em proporção 9:16 vertical",
  "lente": "Especificação ótica de câmera real",
  "iluminacao": "Iluminação física e natural adequada ao estilo",
  "humor": "Tom emocional autêntico",
  "dialogo": "Frase curta e natural falada pelo criador (ou vazio se motion)",
  "sfx": "Efeitos sonoros práticos do produto (clique de tampa, spray, textura)",
  "somAmbiente": "Som de fundo sutil",
  "hookVisual": "Ação de impacto nos primeiros 2 segundos para prender a atenção no feed",
  "evitar": "Termos proibidos no TikTok Shop (sem alegações de cura, sem promessas falsas)",
  "duracao": "8s",
  "proporcao": "9:16"
}`
    : `{
  "sujeito": "Sujeito principal com fidelidade de produto",
  "acao": "Ação ou pose estática ultra realista",
  "cenario": "Cenário limpo e atraente para e-commerce",
  "estilo": "Fotografia comercial ultra realista em 8K com ótica física de estúdio",
  "composicao": "Vertical 9:16 centralizada com safe zone inferior para botão de compra",
  "iluminacao": "Iluminação de estúdio ou luz natural suave",
  "paleta": "Cores reais do produto",
  "humor": "Profissional e desejável",
  "materiais": "Texturas físicas precisas do produto",
  "evitar": "Sem claims falsos, sem texto cobrindo as bordas",
  "proporcao": "9:16",
  "isEdit": false,
  "editMudar": "",
  "editManter": ""
}`
}

Ideia do usuário: "${idea}"`;

    const response: any = await generateWithFallback(
      ai,
      {
        contents: promptText,
        config: {
          responseMimeType: 'application/json',
        },
      },
      15000
    );
    const text = response.text || '{}';
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      data = JSON.parse(cleaned);
    }

    res.json({ success: true, data });
  } catch (error: any) {
    console.warn('Aviso: autofill Gemini encontrou erro, utilizando extração inteligente de contingência:', error.message);
    const fallbackData = parseIdeaLocally(idea, mode, agent, product);
    res.json({ success: true, data: fallbackData, fallback: true });
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Testar sem token (deve dar 401)**

Com `vercel dev` rodando:

```bash
curl -i -X POST http://localhost:3000/api/autofill \
  -H "Content-Type: application/json" \
  -d '{"idea":"teste","mode":"video"}'
```

Expected: `HTTP/1.1 401` e corpo `{"error":"Não autenticado."}`.

- [ ] **Step 4: Testar com token válido**

Obtenha um access token de uma sessão real (via o app depois que a Task 10 estiver pronta, ou manualmente via `supabase.auth.signInWithPassword` no console do navegador apontando para seu projeto). Depois:

```bash
curl -i -X POST http://localhost:3000/api/autofill \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"idea":"creme facial hidratante","mode":"video","agent":"ugc","product":{}}'
```

Expected: `HTTP/1.1 200` com `{"success":true,"data":{...}}`.

- [ ] **Step 5: Commit**

```bash
git add api/autofill.ts
git commit -m "feat: migrate /api/autofill to a Vercel serverless function with auth"
```

---

### Task 5: Migrar `/api/enhance`

**Files:**
- Create: `api/enhance.ts`

**Interfaces:**
- Consumes: `authenticate`, `getGemini`, `generateWithFallback` (mesmos de Task 3).
- Produces: endpoint `POST /api/enhance`, protegido por auth, mesmo contrato (`{ prompt, mode, agent, product, meta }` → `{ success, enhancedPrompt, fallback? }`).

- [ ] **Step 1: Criar `api/enhance.ts`**

Porta `server.ts:284-350`, adicionando auth gate e check de método:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_lib/auth';
import { getGemini, generateWithFallback } from './_lib/gemini';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
  if (!user) return;

  const { prompt, mode, agent = 'ugc', product = {}, meta } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt base é obrigatório.' });
  }

  try {
    const ai = getGemini();

    const instructions =
      mode === 'video'
        ? `Você é um diretor de fotografia comercial e estrategista líder de criativos para TikTok Shop.
Sua tarefa é aprimorar o prompt de vídeo para modelos de ponta como Omni 1.1 Flash e Veo (para vídeos de até 10s), garantindo:
- PADRÃO VÍDEO ULTRA REALISTA: Textura de pele humana real com microporos, materiais com física precisa de refração e reflexo, iluminação volumétrica natural, sem qualquer aspecto de CGI ou plástico de IA.
- AGENTE ESPECIALIZADO: Respeite rigorosamente se o agente é POV (1ª pessoa mãos/unboxing), UGC (criador autêntico smartphone 4K com hook nos primeiros 2s) ou Movimento (B-Roll de produto dinâmico em 360°).
- CONSISTÊNCIA DE PRODUTO INEGOCIÁVEL: Preserve integralmente a descrição dos atributos físicos do produto (nome, embalagem, cores e acabamentos).
- DIRETRIZES DO TIKTOK SHOP: Nenhuma promessa médica ou de cura exagerada. Preservação de Safe Zone 9:16 (sem elementos vitais no rodapé onde fica a sacola de compras).
- Sintaxe padrão calibrada para Omni 1.1 Flash e Veo: Mantenha o formato estruturado com enquadramento, sujeito e ação, iluminação, áudio, o que evitar, e finalize com as tags técnicas [Duração: ... | Proporção: 9:16 | Safe Zone TikTok Shop: Ativa | Modo: Ultra Realista].
- Responda apenas com o texto do prompt aprimorado em português do Brasil.`
        : `Você é um mestre da fotografia comercial ultra realista de produto para o Google Flow Nano Banana (Gemini 2.5 Flash Image).
Sua tarefa é aprimorar o prompt determinístico em linguagem natural coesa, garantindo:
- Estilo estritamente fotográfico ultra realista em 8K, com ótica de lente macro/comercial, profundidade de campo precisa e física de luz real.
- Consistência inabalável dos atributos físicos do produto e conformidade com o TikTok Shop em formato 9:16.
- Responda apenas com o texto do prompt aprimorado em português do Brasil.`;

    const enhancePromptText = `${instructions}

Agente Ativo: ${agent.toUpperCase()}
Produto Ancorado: ${JSON.stringify(product || {})}

Prompt original montado:
"""
${prompt}
"""

Informações adicionais de contexto: ${JSON.stringify(meta || {})}

Gere o prompt ultra realista aprimorado em português do Brasil:`;

    const response: any = await generateWithFallback(
      ai,
      {
        contents: enhancePromptText,
      },
      15000
    );
    const enhancedPrompt = response.text?.trim() || prompt;
    res.json({ success: true, enhancedPrompt });
  } catch (error: any) {
    console.warn('Aviso: enhance Gemini encontrou erro, utilizando versão aprimorada fotográfica:', error.message);
    let fallbackEnhanced = prompt;
    if (mode === 'video') {
      fallbackEnhanced = prompt.replace(
        /A cena é iluminada por ([^.]+)\./i,
        'A cena é banhada por $1, capturando reflexos físicos precisos nos materiais do produto e micro-texturas reais com iluminação ultra realista.'
      );
    } else {
      fallbackEnhanced = prompt.replace(
        /A atmosfera é ([^.]+)\./i,
        'A atmosfera transmite uma sensação $1, com ótica comercial nítida em 8K, foco cirúrgico no produto e fidelidade física de materiais.'
      );
    }
    res.json({ success: true, enhancedPrompt: fallbackEnhanced, fallback: true });
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Testar sem e com token (mesmo padrão da Task 4)**

```bash
curl -i -X POST http://localhost:3000/api/enhance \
  -H "Content-Type: application/json" \
  -d '{"prompt":"teste","mode":"video"}'
# Expected: 401

curl -i -X POST http://localhost:3000/api/enhance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"prompt":"Cena de teste com produto","mode":"video","agent":"ugc"}'
# Expected: 200 com { success: true, enhancedPrompt: "..." }
```

- [ ] **Step 4: Commit**

```bash
git add api/enhance.ts
git commit -m "feat: migrate /api/enhance to a Vercel serverless function with auth"
```

---

### Task 6: Migrar `/api/analyze-references`

**Files:**
- Create: `api/analyze-references.ts`

**Interfaces:**
- Consumes: `authenticate`, `getGemini`, `generateWithFallback`, `parseImageData` (de `api/_lib/parseImageData.ts`).
- Produces: endpoint `POST /api/analyze-references`, protegido por auth, mesmo contrato que hoje.

- [ ] **Step 1: Criar `api/analyze-references.ts`**

Porta `server.ts:370-611`, adicionando auth gate e check de método:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_lib/auth';
import { getGemini, generateWithFallback } from './_lib/gemini';
import { parseImageData } from './_lib/parseImageData';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
  if (!user) return;

  const {
    productImage,
    characterImage,
    productImages = [],
    characterImages = [],
    sceneImages = [],
    agent = 'ugc',
    mode = 'video',
    existingProduct = {},
    existingCharacter = {},
  } = req.body;

  const rawProducts = Array.isArray(productImages) && productImages.length > 0
    ? productImages
    : (productImage ? [productImage] : []);
  const parsedProducts = rawProducts.map(parseImageData).filter(Boolean) as { data: string; mimeType: string }[];

  const rawCharacters = Array.isArray(characterImages) && characterImages.length > 0
    ? characterImages
    : (characterImage ? [characterImage] : []);
  const parsedCharacters = rawCharacters.map(parseImageData).filter(Boolean) as { data: string; mimeType: string }[];

  const rawScenes = Array.isArray(sceneImages) ? sceneImages : [];
  const parsedScenes = rawScenes.map(parseImageData).filter(Boolean) as { data: string; mimeType: string }[];

  if (parsedProducts.length === 0 && parsedCharacters.length === 0 && parsedScenes.length === 0) {
    return res.status(400).json({
      error: 'Envie pelo menos uma imagem de referência (produto, personagem ou cenário) para análise.',
    });
  }

  try {
    const ai = getGemini();

    const parts: any[] = [];

    if (parsedProducts.length > 0) {
      parts.push({
        text: `[REFERÊNCIAS VISUAIS DO PRODUTO: ${parsedProducts.length} foto(s) fornecida(s). Analise todos os ângulos, embalagem, rótulo e textura física]:`,
      });
      for (const prod of parsedProducts) {
        parts.push({ inlineData: { mimeType: prod.mimeType, data: prod.data } });
      }
    }

    if (parsedCharacters.length > 0) {
      parts.push({
        text: `[REFERÊNCIAS VISUAIS DA MODELO / PERSONAGEM: ${parsedCharacters.length} foto(s) fornecida(s). Trave traços faciais, tom de pele, cabelo, vestimenta e expressão]:`,
      });
      for (const char of parsedCharacters) {
        parts.push({ inlineData: { mimeType: char.mimeType, data: char.data } });
      }
    }

    if (parsedScenes.length > 0) {
      parts.push({
        text: `[REFERÊNCIAS VISUAIS DE CENÁRIO / AMBIENTAÇÃO / ILUMINAÇÃO: ${parsedScenes.length} foto(s) fornecida(s). Incorpore a estética espacial, paleta de cores e iluminação]:`,
      });
      for (const sc of parsedScenes) {
        parts.push({ inlineData: { mimeType: sc.mimeType, data: sc.data } });
      }
    }

    const agentContext =
      agent === 'pov'
        ? 'AGENTE POV (Ponto de Vista em 1ª Pessoa): Perspectiva subjetiva dos olhos do criador, foco próximo nas mãos interagindo com o produto, unboxing tátil e demonstração sensorial direta com profundidade de campo sutil.'
        : agent === 'ugc'
        ? 'AGENTE UGC (Criador Autêntico TikTok Shop): Conteúdo estilo smartphone 4K real, criador espontâneo reagindo e testando o produto com energia natural, com gancho (hook) visual forte nos primeiros 2 segundos.'
        : 'AGENTE MOVIMENTO (B-Roll Dinâmico Comercial): Planos cinematográficos com travelling orbital 360° em volta do produto, iluminação de estúdio comercial com reflexos volumétricos nos materiais.';

    const promptInstructions = `Você é um diretor de cena, especialista em computação visual e estrategista sênior de criativos para TikTok Shop com maestria em modelos de vídeo como Omni 1.1 Flash e Veo (para vídeos de até 10s ultra realistas) e Nano Banana para imagem.

Você recebeu ${parsedProducts.length + parsedCharacters.length + parsedScenes.length} imagens de referência para ancorar consistência absoluta entre cortes e cenas:
${parsedProducts.length > 0 ? `- PRODUTO (${parsedProducts.length} referências): Analise minuciosamente o produto físico em todas as imagens fornecidas (formato exato, tipo de embalagem/frasco, tampa, relevo, cores precisas, rótulo/tipografia, textura do líquido/creme/material, reflexos de vidro/plástico/metal).` : ''}
${parsedCharacters.length > 0 ? `- PERSONAGEM / MODELO (${parsedCharacters.length} referências): Analise minuciosamente os traços da pessoa para garantir que a mesma modelo seja reproduzida com total fidelidade em todas as cenas (gênero, idade aparente, tom de pele, traços faciais marcantes, olhos, nariz, sorriso, tipo/cor/corte de cabelo, estilo e cores de vestimenta, expressão característica).` : ''}
${parsedScenes.length > 0 ? `- CENÁRIO / AMBIENTE (${parsedScenes.length} referências): Analise o espaço, iluminação, paleta de cores e atmosfera do ambiente para guiar o cenário da cena.` : ''}

Contexto de Direção:
1. Agente Selecionado: ${agentContext}
2. Modo atual: ${mode === 'video' ? 'VÍDEO (Google Flow Omni 1.1 Flash / Veo - Ultra Realista até 10s)' : 'IMAGEM (Google Flow Nano Banana - 8K Ultra Realista)'}.
3. Políticas do TikTok Shop: PROIBIDO promessas médicas milagrosas ou cura ("cura rugas", "acaba com celulite"). Foco estrito na demonstração física real e autêntica. Safe Zone vertical 9:16 ativa para não cobrir o botão da sacola de compras no rodapé.
4. Padrão VÍDEO ULTRA REALISTA: Textura orgânica de pele humana real com microporos, reflexos de luz física precisa nos materiais, sem qualquer aspecto artificial de CGI ou plástico de IA.

Retorne ESTRITAMENTE um JSON puro válido no seguinte formato exato (sem markdown, sem blocos extras):
{
  "product": {
    "nome": "${existingProduct?.nome || 'Nome detectado ou sugerido do produto'}",
    "categoria": "${existingProduct?.categoria || 'Categoria comercial (Ex: Skincare & Beleza, Gadgets, Moda)'}",
    "caracteristicasVisuais": "Descrição rica e invariável dos detalhes físicos (formato, cor exata, frasco, tampa, rótulo, material)",
    "beneficioVisual": "Ação ou demonstração visual ideal do produto em cena (textura sendo espalhada, gotas límpidas, acabamento luminoso)"
  },
  "character": {
    "nomeOuDescricao": "${existingCharacter?.nomeOuDescricao || 'Descrição identificatória (Ex: Criadora brasileira, ~25 anos, estilo autêntico)'}",
    "caracteristicasFisicas": "Tom de pele, formato do rosto, olhos, sorriso e traços faciais distintivos para travamento de identidade",
    "cabelo": "Cor, comprimento, textura (liso, ondulado, cacheado) e corte",
    "estiloVestuario": "Figurino visual, cores e estilo de roupas observados",
    "expressaoMarcante": "Expressão e atitude cênica observada (olhar acolhedor, sorriso espontâneo)"
  },
  "scene": {
    "sujeito": "Sujeito da cena articulando o personagem com o produto",
    "acao": "Ação ultra realista ideal para o agente selecionado",
    "cenario": "Cenário limpo, contextualizado e sofisticado para TikTok Shop",
    "estilo": "Filme ultra realista em 4K, textura orgânica, ótica precisa sem artefatos plásticos",
    "enquadramento": "Enquadramento 9:16 vertical ideal para o agente",
    "lente": "Especificação ótica de câmera real",
    "iluminacao": "Iluminação física e natural adequada",
    "humor": "Atmosfera e tom emocional",
    "dialogo": "Frase falada curta e natural ou vazia",
    "sfx": "Som tátil da embalagem e do produto",
    "somAmbiente": "Acústica ambiente suave",
    "hookVisual": "Hook nos primeiros 2 segundos para prender a atenção",
    "materiais": "Texturas físicas precisas observadas na imagem",
    "evitar": "Termos proibidos no TikTok Shop e defeitos visuais"
  },
  "consistencySummary": "Resumo em 1-2 frases destacando os atributos invariáveis travados do produto e do personagem para consistência entre cenas."
}`;

    parts.push({ text: promptInstructions });

    const response: any = await generateWithFallback(
      ai,
      {
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
        },
      },
      25000
    );
    const text = response.text || '{}';

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      data = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      product: data.product,
      character: data.character,
      scene: data.scene,
      consistencySummary: data.consistencySummary,
    });
  } catch (error: any) {
    console.warn('Aviso: Falha na chamada multimodal do Gemini, utilizando análise heurística estruturada:', error.message);

    const fallbackProduct = {
      nome: existingProduct?.nome || (parsedProducts.length > 0 ? 'Produto de Referência Identificado' : 'Produto TikTok Shop'),
      categoria: existingProduct?.categoria || 'E-commerce & Beleza',
      caracteristicasVisuais:
        existingProduct?.caracteristicasVisuais ||
        'Embalagem física premium com acabamento fosco, rótulo minimalista de alta resolução e tampa com vedação precisa observada na imagem',
      beneficioVisual:
        existingProduct?.beneficioVisual ||
        'Aplicação prática suave revelando a textura e o acabamento imediato do produto em primeiro plano',
    };

    const fallbackCharacter = {
      nomeOuDescricao:
        existingCharacter?.nomeOuDescricao ||
        (parsedCharacters.length > 0 ? 'Modelo/Criador de Referência (~25 anos)' : 'Criador autêntico de conteúdo'),
      caracteristicasFisicas:
        existingCharacter?.caracteristicasFisicas ||
        'Traços faciais naturais com pele bem cuidada, expressão comunicativa e olhar direto para a câmera',
      cabelo: existingCharacter?.cabelo || 'Cabelo natural com corte moderno e textura alinhada à imagem',
      estiloVestuario: existingCharacter?.estiloVestuario || 'Vestimenta casual contemporânea em tons neutros',
      expressaoMarcante: existingCharacter?.expressaoMarcante || 'Sorriso espontâneo e postura confiável',
    };

    const fallbackScene = {
      sujeito: parsedCharacters.length > 0
        ? `${fallbackCharacter.nomeOuDescricao} interagindo de forma autêntica com ${fallbackProduct.nome}`
        : `Mãos do criador apresentando ${fallbackProduct.nome} em plano próximo`,
      acao:
        agent === 'pov'
          ? `segurando ${fallbackProduct.nome} com as duas mãos e abrindo a embalagem com precisão tátil`
          : agent === 'ugc'
          ? `mostrando o resultado de ${fallbackProduct.nome} com expressão genuína de surpresa nos primeiros segundos`
          : `destacando o acabamento físico de ${fallbackProduct.nome} em rotação orbital suave de 360 graus`,
      cenario: 'ambiente moderno, minimalista e bem iluminado contextualizado para o público do TikTok Shop',
      estilo: 'Filme ultra realista em 4K, textura orgânica de pele e materiais, ótica cinematográfica real',
      enquadramento:
        agent === 'pov'
          ? 'Plano detalhe/médio em 1ª pessoa (POV) vertical 9:16'
          : agent === 'ugc'
          ? 'Câmera frontal de smartphone na altura dos olhos, proporção vertical 9:16'
          : 'Travelling orbital dinâmico vertical 9:16 com slow-motion suave',
      lente: 'Lente primária de smartphone topo de linha com profundidade de campo física sutil',
      iluminacao: 'iluminação difusa suave de softbox sem reflexos estourados no produto',
      humor: 'espontâneo, confiável e focado na textura real',
      dialogo: agent === 'ugc' ? 'Vocês precisam ver como esse produto se comporta na prática!' : '',
      sfx: 'som sutil e límpido de clique e abertura da embalagem',
      somAmbiente: 'acústica aconchegante de quarto ou estúdio contemporâneo',
      hookVisual: 'movimento dinâmico trazendo o produto direto para a lente nos primeiros 2 segundos',
      materiais: fallbackProduct.caracteristicasVisuais,
      evitar: 'sem alegações médicas de cura milagrosa, sem textos obstruindo a área da sacola de compras do TikTok',
    };

    res.json({
      success: true,
      product: fallbackProduct,
      character: fallbackCharacter,
      scene: fallbackScene,
      consistencySummary:
        'Trava invariável de consistência ativada: os traços da modelo e os detalhes da embalagem foram ancorados para manter identidade contínua entre cenas.',
      fallback: true,
      fallbackReason: error.message,
    });
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Testar sem token (401) e sem imagens com token (400)**

```bash
curl -i -X POST http://localhost:3000/api/analyze-references \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 401

curl -i -X POST http://localhost:3000/api/analyze-references \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{}'
# Expected: 400, { error: "Envie pelo menos uma imagem..." }
```

- [ ] **Step 4: Commit**

```bash
git add api/analyze-references.ts
git commit -m "feat: migrate /api/analyze-references to a Vercel serverless function with auth"
```

---

### Task 7: Migrar `/api/parse-product-url`

**Files:**
- Create: `api/parse-product-url.ts`

**Interfaces:**
- Consumes: `authenticate`, `getGemini`, `generateWithFallback`, `parseImageData`.
- Produces: endpoint `POST /api/parse-product-url`, protegido por auth, mesmo contrato que hoje.

- [ ] **Step 1: Criar `api/parse-product-url.ts`**

Porta `server.ts:614-872`, adicionando auth gate e check de método:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_lib/auth';
import { getGemini, generateWithFallback } from './_lib/gemini';
import { parseImageData } from './_lib/parseImageData';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const user = await authenticate(req, res);
  if (!user) return;

  const { url, rawNotes, image } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'O link real do produto é obrigatório.' });
  }

  const cleanUrl = url.trim();

  let fetchedMeta = {
    title: '',
    description: '',
    ogImage: '',
    rawSnippet: '',
    fetchSucceeded: false,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const html = await response.text();
      const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
      const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      const ogImgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);

      fetchedMeta.title = ogTitleMatch?.[1] || titleMatch?.[1] || '';
      fetchedMeta.description = ogDescMatch?.[1] || metaDescMatch?.[1] || '';
      fetchedMeta.ogImage = ogImgMatch?.[1] || '';

      const strippedBody = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 2500);

      fetchedMeta.rawSnippet = strippedBody;
      fetchedMeta.fetchSucceeded = true;
    }
  } catch (err: any) {
    console.log('Nota: Busca de metadados da URL direta concluiu com:', err.message);
  }

  try {
    const ai = getGemini();

    const parts: any[] = [];

    const parsedImage = parseImageData(image);
    if (parsedImage) {
      parts.push({ inlineData: { mimeType: parsedImage.mimeType, data: parsedImage.data } });
      parts.push({
        text: `[IMAGEM ANEXADA DA PÁGINA / EMBALAGEM DO PRODUTO NO TIKTOK SHOP]: Analise com precisão o design físico da embalagem, rótulo, tampa, cores e forma.`,
      });
    }

    const extractionPrompt = `Você é um engenheiro de produto e diretor de criativos para TikTok Shop.
Um usuário colou o seguinte link real de produto ou loja:
URL: "${cleanUrl}"

Dados recuperados da URL:
- Título detectado: "${fetchedMeta.title || 'Não disponível via scraping direto'}"
- Descrição detectada: "${fetchedMeta.description || 'Não disponível via scraping direto'}"
- Trecho da página: "${fetchedMeta.rawSnippet.slice(0, 1000) || 'Sem acesso direto ao HTML'}"
${rawNotes ? `- Observações ou texto adicional do usuário: "${rawNotes}"` : ''}

Sua tarefa é extrair e estruturar um objeto COMPLETO de Produto Campeão para o TikTok Shop, respeitando rigorosamente:
1. NOME COMERCIAL LIMPO: Nome claro e atraente em português.
2. CARACTERÍSTICAS FÍSICAS INVARIÁVEIS: Descrição precisa da embalagem (formato do frasco/corpo, material como vidro/fosco/alumínio, cor exata, tipo de tampa/dispenser, rótulo e textura do produto/fórmula). Essa âncora impede a IA de alterar o frasco entre cenas.
3. BENEFÍCIO VISUAL SENSORIAL: Ação física imediata que demonstra valor (ex: absorção na pele, luz LED ligando, corte limpo) sem alegações médicas falsas ou promessas exageradas proibidas pelo TikTok Shop.
4. ROTEIROS PRÉ-CALIBRADOS PARA OS 3 AGENTES:
   - POV: Ponto de vista em 1ª pessoa (mãos manipulando, unboxing, sensação tátil).
   - UGC: Criador autêntico gravando na câmera frontal de smartphone com hook nos primeiros 2s.
   - MOTION: Travelling orbital 360°, slow-motion, iluminação de estúdio comercial de alta conversão.
5. ESTIMATIVAS DE MERCADO: Nicho ('skincare', 'tech', 'wellness', 'home' ou 'beauty'), ticket médio, comissão (%) e ganho em R$ por venda.

Retorne EXCLUSIVAMENTE um JSON puro válido no formato:
{
  "name": "Nome comercial limpo do produto",
  "category": "Categoria no e-commerce",
  "niche": "skincare",
  "status": "explosao",
  "salesVolume": "15.000+ vendas no TikTok Shop",
  "commissionRate": "30%",
  "commissionValue": "R$ 35,00 / venda",
  "ticketPrice": "R$ 119,00",
  "productAnchor": {
    "nome": "Nome detalhado do produto com medida/volume",
    "categoria": "Categoria geral",
    "caracteristicasVisuais": "Descrição física completa da embalagem, materiais, rótulo e líquido/textura",
    "beneficioVisual": "Demonstração sensorial do benefício prático sem alegações médicas"
  },
  "suggestedHooks": {
    "pov": "Gancho visual em 1ª pessoa para prender o scroll nos primeiros 2s",
    "ugc": "Gancho visual com criadora na câmera frontal com alta curiosidade",
    "motion": "Abertura comercial dinâmica em slow-motion com luz de recorte"
  },
  "suggestedActions": {
    "pov": "Ação detalhada com as mãos aplicando ou testando o produto",
    "ugc": "Ação espontânea do criador demonstrando a textura e aprovando",
    "motion": "Movimento de câmera e produto com rotação fluida 360°"
  },
  "suggestedScenarios": {
    "pov": "Cenário limpo e autêntico para visão em primeira pessoa",
    "ugc": "Ambiente autêntico com luz natural suave de smartphone",
    "motion": "Estúdio comercial minimalista com iluminação volumétrica"
  }
}`;

    parts.push({ text: extractionPrompt });

    const response: any = await generateWithFallback(
      ai,
      {
        contents: parts,
        config: {
          responseMimeType: 'application/json',
        },
      },
      16000
    );

    const responseText = response.text || '{}';
    let extractedData: any;
    try {
      extractedData = JSON.parse(responseText);
    } catch {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedData = JSON.parse(cleaned);
    }

    const uniqueId = `custom-prod-${Date.now()}`;
    const resultProduct = {
      id: uniqueId,
      name: extractedData.name || fetchedMeta.title || 'Produto Importado via Link Real',
      category: extractedData.category || 'Produtos em Alta',
      niche: extractedData.niche || 'beauty',
      status: extractedData.status || 'explosao',
      salesVolume: extractedData.salesVolume || 'Alta procura no TikTok',
      commissionRate: extractedData.commissionRate || '25% a 35%',
      commissionValue: extractedData.commissionValue || 'Comissão de Afiliado',
      ticketPrice: extractedData.ticketPrice || 'Conforme Loja',
      affiliateUrl: cleanUrl,
      isCustom: true,
      sourceType: 'link' as const,
      productAnchor: {
        nome: extractedData.productAnchor?.nome || extractedData.name || 'Produto Ancorado',
        categoria: extractedData.productAnchor?.categoria || extractedData.category || 'Geral',
        caracteristicasVisuais:
          extractedData.productAnchor?.caracteristicasVisuais ||
          'Embalagem física moderna com acabamento de alta definição conforme link oficial',
        beneficioVisual:
          extractedData.productAnchor?.beneficioVisual ||
          'Aplicação sensorial destacando a textura e o benefício do produto em primeiro plano',
      },
      suggestedHooks: extractedData.suggestedHooks || {
        pov: 'Mãos trazendo o produto direto para o centro da câmera abrindo a tampa nos primeiros 2s',
        ugc: 'Criadora segurando o produto ao lado do rosto com expressão de surpresa nos primeiros segundos',
        motion: 'Travelling dinâmico de aproximação com iluminação comercial suave sobre o produto',
      },
      suggestedActions: extractedData.suggestedActions || {
        pov: 'Manusear a embalagem com firmeza, demonstrando a facilidade de abertura e o uso prático',
        ugc: 'Aplicar uma pequena porção diante da câmera e mostrar o resultado natural de imediato',
        motion: 'Giro contínuo de 360 graus com reflexos de luz realçando a embalagem',
      },
      suggestedScenarios: extractedData.suggestedScenarios || {
        pov: 'Bancada limpa e moderna com iluminação natural suave e safe zone 9:16 ativa',
        ugc: 'Ambiente de quarto ou home office bem iluminado com estética TikTok nativa',
        motion: 'Estúdio comercial escuro ou minimalista com pedestal de apoio e iluminação de recorte',
      },
    };

    res.json({
      success: true,
      product: resultProduct,
      fetchedTitle: fetchedMeta.title,
    });
  } catch (error: any) {
    console.warn('Aviso: extração Gemini falhou, gerando produto estruturado a partir da URL:', error.message);

    const urlParts = cleanUrl.split('/').filter(Boolean);
    const lastSlug = urlParts[urlParts.length - 1] || 'produto';
    const readableSlug = decodeURIComponent(lastSlug)
      .replace(/[-_]/g, ' ')
      .replace(/\?.*$/, '');

    const fallbackName =
      fetchedMeta.title || (readableSlug.length > 3 ? readableSlug.toUpperCase() : 'Produto TikTok Shop');

    const fallbackProduct = {
      id: `custom-prod-${Date.now()}`,
      name: fallbackName.slice(0, 65),
      category: 'Produto TikTok Shop Verificado',
      niche: 'beauty' as const,
      status: 'explosao' as const,
      salesVolume: 'Produto em Alta no Feed',
      commissionRate: '30%',
      commissionValue: 'Alta Rentabilidade',
      ticketPrice: 'Conforme Catálogo',
      affiliateUrl: cleanUrl,
      isCustom: true,
      sourceType: 'link' as const,
      productAnchor: {
        nome: fallbackName.slice(0, 65),
        categoria: 'E-commerce & TikTok Shop',
        caracteristicasVisuais:
          'Embalagem física moderna com tampa de precisão, rótulo impresso de alta nitidez e materiais com acabamento acetinado fiéis ao produto real',
        beneficioVisual:
          'Demonstração prática de uso revelando textura e eficiência imediata do produto no primeiro segundo',
      },
      suggestedHooks: {
        pov: 'Mão trazendo o produto para o foco da câmera e destravando a embalagem rapidamente',
        ugc: 'Criadora segurando o produto no enquadramento vertical mostrando o resultado prático',
        motion: 'Close cinematográfico com luz de recorte destacando o relevo do produto',
      },
      suggestedActions: {
        pov: 'Demonstrar a abertura e o toque sensorial com gestos manuais precisos',
        ugc: 'Explicar os diferenciais enquanto mostra o produto na mão com naturalidade',
        motion: 'Rotação contínua em câmera lenta revelando todos os ângulos da embalagem',
      },
      suggestedScenarios: {
        pov: 'Superfície limpa de bancada com iluminação suave e proporção 9:16',
        ugc: 'Cenário acolhedor com luz de janela e profundidade suave',
        motion: 'Estúdio comercial contemporâneo com iluminação volumétrica',
      },
    };

    res.json({
      success: true,
      product: fallbackProduct,
      fallback: true,
    });
  }
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Testar sem token (401) e com token (200)**

```bash
curl -i -X POST http://localhost:3000/api/parse-product-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
# Expected: 401

curl -i -X POST http://localhost:3000/api/parse-product-url \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{"url":"https://example.com"}'
# Expected: 200 com { success: true, product: {...} }
```

- [ ] **Step 4: Commit**

```bash
git add api/parse-product-url.ts
git commit -m "feat: migrate /api/parse-product-url to a Vercel serverless function with auth"
```

---

### Task 8: Remover `server.ts` e atualizar `package.json`

**Files:**
- Delete: `server.ts`
- Modify: `package.json`

**Interfaces:**
- Nenhuma — task de limpeza, não afeta contratos de API.

- [ ] **Step 1: Apagar `server.ts`**

```bash
rm server.ts
```

- [ ] **Step 2: Atualizar `package.json`**

Substituir os campos `scripts` e `dependencies`/`devDependencies` (mantendo as demais entradas intactas — apenas remova `express`, `@types/express` e `dotenv`, que só eram usados por `server.ts`, e ajuste os scripts):

```json
{
  "scripts": {
    "dev": "vercel dev",
    "build": "vite build",
    "start": "vercel dev",
    "clean": "rm -rf dist",
    "lint": "tsc --noEmit"
  }
}
```

Remova as linhas de `express`, `dotenv` e `@types/express` das seções `dependencies`/`devDependencies`. Remova também a menção a `esbuild` do script `build` (o binário `esbuild` continua como devDependency transitiva do Vite, então não precisa ser removido do `package.json`, só do script).

- [ ] **Step 3: Reinstalar dependências para atualizar o lockfile**

```bash
npm install
```

- [ ] **Step 4: Verificar que o projeto ainda builda**

```bash
npm run build
```

Expected: build do Vite completa sem erros (sem mais o passo de bundling do `server.ts`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove server.ts, migrate scripts to Vercel dev/build"
```

---

### Task 9: Frontend — cliente Supabase, sessão, `apiFetch` autenticado e compressão de imagens

**Files:**
- Create: `src/lib/supabaseClient.ts`
- Create: `src/hooks/useSupabaseSession.ts`
- Create: `src/lib/apiFetch.ts`
- Create: `src/utils/imageCompression.ts`
- Modify: `src/App.tsx:516-525` e `src/App.tsx:615-625` (chamadas fetch de autofill/enhance)
- Modify: `src/components/ImportProductModal.tsx:38-54` e `:73-83`
- Modify: `src/components/ReferenceUploadSection.tsx:192-210` e `:393-403`

**Interfaces:**
- Produces:
  - `supabase: SupabaseClient` (de `src/lib/supabaseClient.ts`)
  - `useSupabaseSession(): { session: Session | null; isLoading: boolean }` (de `src/hooks/useSupabaseSession.ts`)
  - `apiFetch(path: string, init?: RequestInit): Promise<Response>` (de `src/lib/apiFetch.ts`) — igual a `fetch`, mas anexa `Authorization: Bearer <token>` da sessão atual.
  - `compressImageFile(file: File): Promise<{ dataUrl: string; mimeType: string }>` (de `src/utils/imageCompression.ts`) — redimensiona para ≤1600px no lado maior e reencoda como JPEG.
- Consumes: nenhuma interface de tasks anteriores (é a base do frontend). Será consumido pela Task 10 (`CheckoutModal`) e Task 11 (`App.tsx`/`Header.tsx`).

- [ ] **Step 1: Criar `src/lib/supabaseClient.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar definidas (.env.local).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 2: Criar `src/hooks/useSupabaseSession.ts`**

```ts
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, isLoading };
}
```

- [ ] **Step 3: Criar `src/lib/apiFetch.ts`**

```ts
import { supabase } from './supabaseClient';

// Wrapper de `fetch` que anexa o Bearer token da sessão Supabase atual (se houver)
// e assume Content-Type JSON quando um body é enviado sem headers explícitos.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(path, { ...init, headers });
}
```

- [ ] **Step 4: Criar `src/utils/imageCompression.ts`**

```ts
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

// Redimensiona (lado maior <= 1600px) e reencoda como JPEG via canvas, para manter
// o corpo das requisições de análise multimodal dentro do limite de 4.5MB das
// Vercel Serverless Functions mesmo com várias fotos de celular em alta resolução.
export function compressImageFile(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao decodificar a imagem.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D não suportado neste navegador.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve({ dataUrl, mimeType: 'image/jpeg' });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 5: Usar `apiFetch` em `src/App.tsx`**

Adicionar o import no topo (perto dos outros imports de `./utils`/`./types`):

```ts
import { apiFetch } from './lib/apiFetch';
```

Em `src/App.tsx:516-525`, trocar:

```ts
      const response = await fetch('/api/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          mode,
          agent: currentAgent,
          product: currentProduct,
        }),
      });
```

por:

```ts
      const response = await apiFetch('/api/autofill', {
        method: 'POST',
        body: JSON.stringify({
          idea,
          mode,
          agent: currentAgent,
          product: currentProduct,
        }),
      });
```

Em `src/App.tsx:615-625`, trocar:

```ts
      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentDeterministicPrompt,
          mode,
          agent: currentAgent,
          product: currentProduct,
          meta: mode === 'video' ? videoState : imageState,
        }),
      });
```

por:

```ts
      const response = await apiFetch('/api/enhance', {
        method: 'POST',
        body: JSON.stringify({
          prompt: currentDeterministicPrompt,
          mode,
          agent: currentAgent,
          product: currentProduct,
          meta: mode === 'video' ? videoState : imageState,
        }),
      });
```

- [ ] **Step 6: Usar `apiFetch` e `compressImageFile` em `src/components/ImportProductModal.tsx`**

Adicionar imports no topo:

```ts
import { apiFetch } from '../lib/apiFetch';
import { compressImageFile } from '../utils/imageCompression';
```

Trocar `handleImageUpload` (linhas 38-54):

```ts
  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      setImageData({
        data: result,
        mimeType: file.type,
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };
```

por:

```ts
  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }
    compressImageFile(file)
      .then(({ dataUrl, mimeType }) => {
        setImagePreview(dataUrl);
        setImageData({ data: dataUrl, mimeType });
        setError(null);
      })
      .catch(() => {
        setError('Não foi possível processar a imagem selecionada.');
      });
  };
```

Trocar a chamada `fetch` em `handleAnalyze` (linhas 73-83):

```ts
      const response = await fetch('/api/parse-product-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          rawNotes: rawNotes.trim() || undefined,
          image: imageData || undefined,
        }),
      });
```

por:

```ts
      const response = await apiFetch('/api/parse-product-url', {
        method: 'POST',
        body: JSON.stringify({
          url: url.trim(),
          rawNotes: rawNotes.trim() || undefined,
          image: imageData || undefined,
        }),
      });
```

- [ ] **Step 7: Usar `apiFetch` e `compressImageFile` em `src/components/ReferenceUploadSection.tsx`**

Adicionar imports no topo:

```ts
import { apiFetch } from '../lib/apiFetch';
import { compressImageFile } from '../utils/imageCompression';
```

Trocar `processFile` (linhas 192-206):

```ts
  const processFile = (file: File): Promise<ReferenceImageItem> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          dataUrl: reader.result as string,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'image/jpeg',
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };
```

por:

```ts
  const processFile = async (file: File): Promise<ReferenceImageItem> => {
    const { dataUrl, mimeType } = await compressImageFile(file);
    return {
      dataUrl,
      name: file.name,
      size: file.size,
      mimeType,
    };
  };
```

Trocar a chamada `fetch` em `handleRunAnalysis` (linha 393):

```ts
      const response = await fetch('/api/analyze-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
```

por:

```ts
      const response = await apiFetch('/api/analyze-references', {
        method: 'POST',
        body: JSON.stringify({
```

(o restante do corpo do `body` permanece idêntico — só a linha da chamada `fetch`/headers muda).

- [ ] **Step 8: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 9: Verificação manual no navegador**

Com `vercel dev` rodando, abra `http://localhost:3000`, entre no app (ver Task 11), abra o DevTools → Network, dispare "Preencher com IA" (autofill) e confirme na aba Network que a requisição para `/api/autofill` tem um header `Authorization: Bearer ...`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/supabaseClient.ts src/hooks/useSupabaseSession.ts src/lib/apiFetch.ts src/utils/imageCompression.ts src/App.tsx src/components/ImportProductModal.tsx src/components/ReferenceUploadSection.tsx
git commit -m "feat: wire Supabase session, authenticated apiFetch, and client-side image compression"
```

---

### Task 10: Reescrever `CheckoutModal.tsx` para signup/login real via Supabase

**Files:**
- Modify: `src/components/CheckoutModal.tsx` (reescrita completa)

**Interfaces:**
- Consumes: `supabase` (de `src/lib/supabaseClient.ts`, Task 9).
- Produces: mesmo contrato de props (`isOpen`, `plan`, `onClose`, `onSuccess`) — `onSuccess` agora só é chamado depois que uma sessão Supabase real foi criada (signup, login ou volta do OAuth do Google).

- [ ] **Step 1: Reescrever `src/components/CheckoutModal.tsx`**

```tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface CheckoutModalProps {
  isOpen: boolean;
  plan: 'monthly' | 'annual';
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  plan,
  onClose,
  onSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoogleProcessing, setIsGoogleProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  if (!isOpen) return null;

  const price = plan === 'monthly' ? 'R$ 119,00' : 'R$ 948,00';
  const recurrence = plan === 'monthly' ? 'por mês (cartão ou pix)' : 'por ano (equivale a 12x R$ 79,00)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || undefined } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      setCompleted(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível processar sua solicitação. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleProcessing(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      // O navegador é redirecionado para o Google; ao voltar, a sessão já estará
      // ativa e o useSupabaseSession() do App detecta automaticamente.
    } catch (err: any) {
      setErrorMessage(err.message || 'Não foi possível iniciar o login com Google.');
      setIsGoogleProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-lg p-6 sm:p-8 shadow-2xl text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <span className="font-mono text-[10px] tracking-widest uppercase text-amber-400">
              CHECKOUT SEGURO • FLOW PROMPT FORGE
            </span>
            <h3 className="text-base sm:text-lg font-black uppercase text-neutral-100 tracking-tight mt-0.5">
              Assinatura de Licença Pessoal
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono text-neutral-400 hover:text-white px-2 py-1 bg-neutral-900 border border-neutral-800 rounded cursor-pointer"
          >
            [ FECHAR ]
          </button>
        </div>

        {completed ? (
          <div className="py-12 text-center space-y-3">
            <div className="font-mono text-xs text-emerald-400 font-bold uppercase tracking-widest">
              [ CONTA CRIADA ]
            </div>
            <h4 className="text-xl font-bold uppercase text-white">
              Sua Conta Foi Criada com Sucesso
            </h4>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Sessão iniciada para <strong className="text-neutral-200">{email}</strong>. Redirecionando para a plataforma...
            </p>
            <div className="font-mono text-[11px] text-amber-400 pt-2">
              [ INGRESSANDO NO AMBIENTE AUTORIZADO... ]
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            {/* Plan Summary Box */}
            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-neutral-400 uppercase">PLANO SELECIONADO</span>
                <span className="font-bold text-neutral-100 uppercase">
                  {plan === 'monthly' ? 'Plano Mensal Flexível' : 'Plano Anual Fundador'}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-neutral-800">
                <span className="text-neutral-400">VALOR DA LICENÇA:</span>
                <div className="text-right">
                  <span className="font-mono text-lg font-black text-amber-400">{price}</span>
                  <span className="text-[10px] text-neutral-500 ml-1">/{recurrence}</span>
                </div>
              </div>
              <p className="text-[10px] text-neutral-500 pt-1 border-t border-neutral-800">
                Pagamento será solicitado após a criação da conta — nenhuma cobrança é feita agora.
              </p>
            </div>

            {/* Auth mode toggle */}
            <div className="flex items-center justify-center gap-2 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`uppercase px-2 py-1 rounded cursor-pointer ${
                  authMode === 'signup' ? 'text-amber-400 font-bold' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Criar Conta
              </button>
              <span className="text-neutral-700">/</span>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`uppercase px-2 py-1 rounded cursor-pointer ${
                  authMode === 'login' ? 'text-amber-400 font-bold' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Já Tenho Conta
              </button>
            </div>

            {/* Google login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleProcessing}
              className="w-full py-2.5 border border-neutral-700 rounded text-xs font-semibold text-neutral-200 hover:bg-neutral-900 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGoogleProcessing ? 'REDIRECIONANDO...' : 'CONTINUAR COM GOOGLE'}
            </button>

            <div className="flex items-center gap-3 text-[10px] text-neutral-600 uppercase font-mono">
              <div className="flex-1 h-px bg-neutral-800" />
              ou com e-mail
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    placeholder="Seu nome ou marca"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-neutral-400 mb-1">
                  Senha
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Mínimo de 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2.5 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/70 border border-red-800/80 rounded text-[11px] text-red-200">
                {errorMessage}
              </div>
            )}

            {/* Security Guarantee Notice */}
            <div className="p-3 bg-neutral-900/40 border border-neutral-800 rounded text-[11px] text-neutral-400 space-y-1">
              <div className="font-mono text-neutral-300 font-bold uppercase">
                GARANTIA DE SEGURANÇA E ANTI-TRAPAÇA:
              </div>
              <p>
                Sua conta é individual e intransferível. A plataforma autoriza 1 sessão única simultânea e disponibiliza o acesso imediato ao motor de produtos campeões e ao canal do Telegram.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider rounded transition-all cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isProcessing
                ? 'PROCESSANDO...'
                : authMode === 'signup'
                ? 'CRIAR CONTA E CONTINUAR'
                : 'ENTRAR'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CheckoutModal.tsx
git commit -m "feat: replace simulated checkout with real Supabase signup/login"
```

---

### Task 11: `Header.tsx` + `App.tsx` — substituir `isLicensed`/localStorage pela sessão real

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/App.tsx:1-38` (imports/constantes), `:126-134` (estado de licença), `:713-738` (view landing), `:744-778` (ribbon), `:957-971` (checkout na app view)

**Interfaces:**
- Consumes: `useSupabaseSession` (Task 9), `supabase` (Task 9).
- Produces: nenhuma nova interface pública — é o ponto de consumo final desta pilar.

- [ ] **Step 1: Adicionar props de sessão em `src/components/Header.tsx`**

Adicionar `userEmail?: string` e `onLogout?: () => void` à interface `HeaderProps` e desestruturação:

```ts
interface HeaderProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenLanding?: () => void;
  historyCount: number;
  hasAutoPreferences: boolean;
  userEmail?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenHistory,
  onOpenLanding,
  historyCount,
  hasAutoPreferences,
  userEmail,
  onLogout,
}) => {
```

Dentro do bloco `{/* Right actions */}` (`div className="flex items-center gap-2 sm:gap-3"`), logo antes do bloco `{onOpenLanding && (...)}`, adicionar:

```tsx
          {userEmail && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-neutral-800/50 border border-neutral-700/60">
              <span className="text-neutral-400 truncate max-w-[140px]">{userEmail}</span>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-neutral-500 hover:text-red-400 uppercase font-mono text-[10px] cursor-pointer"
                >
                  Sair
                </button>
              )}
            </div>
          )}
```

- [ ] **Step 2: Trocar o estado de licença por sessão real em `src/App.tsx`**

Adicionar imports (junto aos demais em `src/App.tsx:1-21`):

```ts
import { supabase } from './lib/supabaseClient';
import { useSupabaseSession } from './hooks/useSupabaseSession';
```

Em `src/App.tsx:126-134`, trocar:

```ts
  const [checkoutPlan, setCheckoutPlan] = useState<'monthly' | 'annual' | null>(null);
  const [isLicensed, setIsLicensed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flow_prompt_forge_licensed') === 'true';
    } catch {
      return false;
    }
  });
```

por:

```ts
  const [checkoutPlan, setCheckoutPlan] = useState<'monthly' | 'annual' | null>(null);
  const { session } = useSupabaseSession();
  const isAuthenticated = session !== null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
```

- [ ] **Step 3: Atualizar a view de landing (`src/App.tsx:713-738`)**

Trocar:

```tsx
  if (currentView === 'landing') {
    return (
      <>
        <LandingPage
          onEnterApp={() => setCurrentView('app')}
          onSelectPlan={(plan) => setCheckoutPlan(plan)}
        />
        <CheckoutModal
          isOpen={checkoutPlan !== null}
          plan={checkoutPlan || 'annual'}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => {
            setIsLicensed(true);
            try {
              localStorage.setItem('flow_prompt_forge_licensed', 'true');
            } catch {
              // ignore
            }
            setCheckoutPlan(null);
            setCurrentView('app');
          }}
        />
      </>
    );
  }
```

por:

```tsx
  if (currentView === 'landing') {
    return (
      <>
        <LandingPage
          onEnterApp={() => setCurrentView('app')}
          onSelectPlan={(plan) => setCheckoutPlan(plan)}
        />
        <CheckoutModal
          isOpen={checkoutPlan !== null}
          plan={checkoutPlan || 'annual'}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => {
            setCheckoutPlan(null);
            setCurrentView('app');
          }}
        />
      </>
    );
  }
```

- [ ] **Step 4: Atualizar o ribbon e o botão do topo (`src/App.tsx:744-778`)**

Trocar:

```tsx
              {isLicensed ? (
                <span className="text-emerald-400 font-bold">[ LICENÇA PESSOAL ATIVA • SESSÃO PROTEGIDA ]</span>
              ) : (
                <span className="text-amber-400 font-bold">[ MODO DEMONSTRAÇÃO • SESSÃO LOCAL ]</span>
              )}
```

por:

```tsx
              {isAuthenticated ? (
                <span className="text-emerald-400 font-bold">[ LICENÇA PESSOAL ATIVA • SESSÃO PROTEGIDA ]</span>
              ) : (
                <span className="text-amber-400 font-bold">[ MODO DEMONSTRAÇÃO • SESSÃO LOCAL ]</span>
              )}
```

E trocar:

```tsx
            {!isLicensed && (
```

por:

```tsx
            {!isAuthenticated && (
```

- [ ] **Step 5: Passar `userEmail`/`onLogout` para `Header` e atualizar o checkout na app view (`src/App.tsx:781-787` e `:957-971`)**

Trocar:

```tsx
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenLanding={() => setCurrentView('landing')}
        historyCount={history.length}
        hasAutoPreferences={preferences.autoApply}
      />
```

por:

```tsx
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenLanding={() => setCurrentView('landing')}
        historyCount={history.length}
        hasAutoPreferences={preferences.autoApply}
        userEmail={session?.user?.email}
        onLogout={handleLogout}
      />
```

Trocar (checkout modal da app view, `src/App.tsx:957-971`):

```tsx
      <CheckoutModal
        isOpen={checkoutPlan !== null}
        plan={checkoutPlan || 'annual'}
        onClose={() => setCheckoutPlan(null)}
        onSuccess={() => {
          setIsLicensed(true);
          try {
            localStorage.setItem('flow_prompt_forge_licensed', 'true');
          } catch {
            // ignore
          }
          setCheckoutPlan(null);
        }}
      />
```

por:

```tsx
      <CheckoutModal
        isOpen={checkoutPlan !== null}
        plan={checkoutPlan || 'annual'}
        onClose={() => setCheckoutPlan(null)}
        onSuccess={() => {
          setCheckoutPlan(null);
        }}
      />
```

- [ ] **Step 6: Verificar tipos**

```bash
npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/Header.tsx
git commit -m "feat: replace localStorage license flag with real Supabase session"
```

---

### Task 12: Verificação manual de ponta a ponta

**Files:** nenhum (task de validação).

- [ ] **Step 1: Subir o ambiente**

```bash
npx vercel dev
```

- [ ] **Step 2: Signup por e-mail/senha**

No navegador, abra `http://localhost:3000`, clique em um plano na landing page, preencha nome/e-mail/senha em modo "Criar Conta" e envie. Confirme que a tela "CONTA CRIADA" aparece e que você é redirecionado para o app. Confira no painel do Supabase (**Table Editor → profiles**) que uma linha foi criada com `subscription_status = trial`.

- [ ] **Step 3: Logout e login**

No Header, clique em "Sair". Confirme que o ribbon volta a mostrar "MODO DEMONSTRAÇÃO". Abra o checkout de novo, mude para "Já Tenho Conta", entre com o mesmo e-mail/senha, e confirme que a sessão volta (ribbon mostra "LICENÇA PESSOAL ATIVA").

- [ ] **Step 4: Login com Google**

Clique em "Continuar com Google" no checkout, complete o fluxo OAuth, e confirme que volta autenticado para o app.

- [ ] **Step 5: Gate de autenticação nas rotas de IA**

Com a sessão ativa, use "Preencher com IA" (autofill) e "Aprimorar com IA" (enhance) e confirme que funcionam normalmente. Depois, faça logout e, pelo DevTools → Console, rode:

```js
fetch('/api/enhance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
```

Expected: `401`.

- [ ] **Step 6: Upload de múltiplas imagens (compressão)**

Com sessão ativa, vá em "Referências" e envie 3-4 fotos de celular em alta resolução (produto + modelo). Confirme que a análise multimodal roda sem erro de payload (checar aba Network: o tamanho do request para `/api/analyze-references` deve ficar bem abaixo de 4.5MB).

- [ ] **Step 7: Confirmar `/api/health` público**

```bash
curl http://localhost:3000/api/health
```

Expected: `200` sem precisar de token.

- [ ] **Step 8: Registro final**

Se tudo acima passou, este pilar está funcionalmente completo. Nenhum commit de código nesta task — é só validação.
