# Pilar 5 (parte 1): Termos de Uso e Política de Privacidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `/termos` e `/privacidade` com conteúdo real e específico do produto, linkados de verdade no rodapé da landing page.

**Architecture:** Duas páginas React estáticas (`TermsOfService.tsx`, `PrivacyPolicy.tsx`) compartilhando um wrapper de layout (`LegalPageLayout.tsx`), roteadas via o mesmo padrão de `window.location.pathname` já usado por `/subscription/confirm` em `App.tsx` — sem router novo. Sem lógica de negócio, sem estado além da leitura do pathname.

**Tech Stack:** React + TypeScript, Tailwind (classes já usadas no resto do app — sem CSS novo).

**Spec:** `docs/superpowers/specs/2026-09-23-legal-pages-design.md`

## Global Constraints

- Sem `react-router` nem dependência nova — mesmo padrão de `window.location.pathname` de `App.tsx:143` (`/subscription/confirm`).
- As páginas legais são públicas: renderizam antes de qualquer checagem de `isAuthenticated`/assinatura.
- Dados legais reais (razão social, CNPJ/CPF, e-mail de contato) não existem ainda — usar os placeholders `[RAZÃO SOCIAL]`, `[CNPJ/CPF]` e `[E-MAIL DE CONTATO]` exatamente como especificado, nunca inventar valores.
- Preço exato dos planos não é hardcoded no texto legal (evita precisar atualizar o documento toda vez que o preço mudar) — referenciar "conforme exibido no momento da contratação".

## Review Focus

- Placeholder esquecido sem estar claramente marcado — nenhum trecho do texto final deve conter algo que pareça um dado real mas seja inventado; os únicos placeholders são os 3 listados acima, sempre entre colchetes.
- Página legal exige sessão/assinatura ativa por engano — a Task 2 verifica manualmente com uma sessão deslogada.
- Refresh direto na URL (`/termos`, não só navegação client-side) cai no app principal em vez da página legal — o rewrite do `vercel.json` manda tudo pra `index.html`, então isso só quebra se a leitura do `pathname` no `App.tsx` rodar depois de algum outro retorno condicional; verificado na Task 2 com reload de verdade, não só clique no link.
- Conteúdo legal genérico que não reflete o produto (cota de IA, reembolso de 7 dias, quem processa os dados) — o texto já foi escrito a partir do levantamento real do código (spec, seção "Contexto"), a Task 1 só precisa transcrever fielmente.

---

### Task 1: Componentes das páginas legais e wiring no app

**Files:**
- Create: `src/components/legal/LegalPageLayout.tsx`
- Create: `src/components/legal/TermsOfService.tsx`
- Create: `src/components/legal/PrivacyPolicy.tsx`
- Modify: `src/App.tsx` (import + state + early return)
- Modify: `src/components/LandingPage.tsx:753-755` (rodapé)

**Interfaces:**
- Produces: `LegalPageLayout` (props `title: string`, `lastUpdated: string`, `children: React.ReactNode`), `TermsOfService` e `PrivacyPolicy` (componentes sem props) — consumidos por `App.tsx`.

Sem teste automatizado: este projeto não tem nenhum teste de componente React (só `api/**/*.test.ts` via Vitest, conferir `vitest.config.ts`) — páginas estáticas sem lógica de negócio seguem o mesmo padrão. Verificação é manual, na Task 2.

- [ ] **Step 1: Criar `src/components/legal/LegalPageLayout.tsx`**

```tsx
import React from 'react';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({ title, lastUpdated, children }) => (
  <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased selection:bg-amber-500 selection:text-neutral-950">
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <a
        href="/"
        className="font-mono text-[11px] uppercase tracking-widest text-amber-400 hover:text-amber-300 transition-colors"
      >
        ← Voltar para o Flow Prompt Forge
      </a>
      <h1 className="mt-6 text-3xl sm:text-4xl font-black tracking-tight text-neutral-100">{title}</h1>
      <p className="mt-2 text-sm text-neutral-500">Última atualização: {lastUpdated}</p>
      <div className="mt-10 space-y-8 text-neutral-300 leading-relaxed text-sm sm:text-base">{children}</div>
    </div>
  </div>
);
```

- [ ] **Step 2: Criar `src/components/legal/TermsOfService.tsx`**

```tsx
import React from 'react';
import { LegalPageLayout } from './LegalPageLayout';

export const TermsOfService: React.FC = () => (
  <LegalPageLayout title="Termos de Uso" lastUpdated="23 de setembro de 2026">
    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">1. Quem somos</h2>
      <p>
        [RAZÃO SOCIAL], inscrita no CNPJ/CPF sob o nº [CNPJ/CPF], doravante "PromptForge", oferece o
        serviço descrito nestes Termos de Uso ("Termos"). Dúvidas: [E-MAIL DE CONTATO].
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">2. O que é o serviço</h2>
      <p>
        O Flow Prompt Forge é uma ferramenta que gera e aprimora prompts em linguagem natural para uso
        com o Google Flow (modelos Veo e Nano Banana/Gemini), voltada para criadores de conteúdo do
        TikTok Shop. O serviço não gera imagens ou vídeos — gera o texto do prompt que você usa em
        outra ferramenta.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">3. Cadastro e conta</h2>
      <p>
        Para usar o serviço você precisa criar uma conta com e-mail e senha (ou provedor OAuth
        suportado). Você é responsável por manter suas credenciais em sigilo e por toda atividade
        realizada na sua conta.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">4. Planos e cobrança</h2>
      <p>
        O acesso ao serviço é pago, por assinatura recorrente (mensal ou anual, conforme o plano
        exibido no momento da contratação). A cobrança é processada pelo Mercado Pago; o PromptForge
        nunca tem acesso aos dados do seu cartão. A assinatura renova automaticamente ao fim de cada
        ciclo, até que você cancele.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">5. Direito de arrependimento</h2>
      <p>
        Nos termos do art. 49 do Código de Defesa do Consumidor, você pode desistir da assinatura em
        até 7 (sete) dias corridos contados da primeira cobrança, com reembolso integral e
        cancelamento imediato do acesso. Após esse prazo, o cancelamento (seção 6) não gera reembolso
        proporcional do período já pago.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">6. Cancelamento</h2>
      <p>
        Você pode cancelar a qualquer momento. O acesso permanece ativo até o fim do período já pago.
        Em caso de falha na cobrança de renovação, mantemos o acesso por um período de carência antes
        de suspender a conta, com aviso.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">7. Limite de uso</h2>
      <p>
        As funcionalidades de IA (aprimoramento de prompt, preenchimento automático, análise de
        referências e importação de produto) têm um limite diário compartilhado de gerações por conta,
        que reseta à meia-noite (horário de São Paulo). O limite existe para manter o serviço
        sustentável para todos os usuários e pode ser ajustado; mudanças relevantes serão comunicadas.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">8. Uso aceitável</h2>
      <p>Você concorda em não:</p>
      <ul className="list-disc list-inside mt-2 space-y-1">
        <li>tentar acessar o serviço além do seu uso individual autorizado;</li>
        <li>fazer engenharia reversa, raspagem automatizada (scraping) ou contornar limites técnicos do serviço;</li>
        <li>revender, sublicenciar ou compartilhar credenciais de acesso;</li>
        <li>usar o serviço para gerar conteúdo ilegal, enganoso ou que viole direitos de terceiros.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">9. Propriedade dos resultados</h2>
      <p>
        Os prompts gerados a partir do seu uso do serviço são seus, para usar como quiser. O
        PromptForge não reivindica direitos sobre o conteúdo gerado.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">10. Disponibilidade e limitação de responsabilidade</h2>
      <p>
        O serviço depende de provedores externos (Google, Mercado Pago, Supabase) e pode sofrer
        indisponibilidades fora do nosso controle. O serviço é fornecido "como está"; na extensão
        máxima permitida por lei, não respondemos por lucros cessantes ou danos indiretos decorrentes
        do uso ou impossibilidade de uso do serviço.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">11. Alterações nestes Termos</h2>
      <p>
        Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas por e-mail ou aviso no
        serviço, com antecedência razoável. O uso continuado após a alteração implica concordância com
        os novos Termos.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">12. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pela legislação brasileira. Fica eleito o foro do seu domicílio para
        dirimir eventuais controvérsias, conforme o Código de Defesa do Consumidor.
      </p>
    </section>
  </LegalPageLayout>
);
```

- [ ] **Step 3: Criar `src/components/legal/PrivacyPolicy.tsx`**

```tsx
import React from 'react';
import { LegalPageLayout } from './LegalPageLayout';

export const PrivacyPolicy: React.FC = () => (
  <LegalPageLayout title="Política de Privacidade" lastUpdated="23 de setembro de 2026">
    <p>
      Esta Política de Privacidade descreve como [RAZÃO SOCIAL] ("PromptForge", "nós") trata os dados
      pessoais de quem usa o Flow Prompt Forge, em conformidade com a Lei Geral de Proteção de Dados
      (Lei nº 13.709/2018, "LGPD").
    </p>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">1. Quem é o controlador</h2>
      <p>
        [RAZÃO SOCIAL], CNPJ/CPF [CNPJ/CPF], é o controlador dos dados pessoais tratados no serviço.
        Contato: [E-MAIL DE CONTATO].
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">2. Quais dados coletamos</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>
          <strong className="text-neutral-100">Dados de cadastro:</strong> e-mail e, se você informar,
          nome de exibição.
        </li>
        <li>
          <strong className="text-neutral-100">Dados de uso:</strong> contagem diária de gerações de
          IA (para aplicar o limite descrito nos Termos de Uso), histórico de eventos de assinatura
          (para suporte e auditoria de cobrança).
        </li>
        <li>
          <strong className="text-neutral-100">Dados de pagamento:</strong> não coletamos nem
          armazenamos dados de cartão. O processamento é feito inteiramente pelo Mercado Pago;
          recebemos apenas o status da cobrança (aprovado, recusado, cancelado) e identificadores da
          transação.
        </li>
        <li>
          <strong className="text-neutral-100">Conteúdo enviado por você:</strong> prompts, texto e
          imagens de produto/referência que você envia às funcionalidades de IA são transmitidos à API
          do Google Gemini para gerar a resposta e não são armazenados pelo PromptForge após a resposta
          ser retornada.
        </li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">3. Por que tratamos esses dados (base legal)</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>
          <strong className="text-neutral-100">Execução do contrato</strong> (art. 7º, V, LGPD): manter
          sua conta, processar sua assinatura, aplicar o limite de uso, dar suporte.
        </li>
        <li>
          <strong className="text-neutral-100">Cumprimento de obrigação legal</strong> (art. 7º, II):
          manter registros necessários para fins fiscais e de defesa em caso de disputa de cobrança.
        </li>
        <li>
          <strong className="text-neutral-100">Legítimo interesse</strong> (art. 7º, IX), quando
          aplicável: prevenção a fraude e abuso do serviço.
        </li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">4. Com quem compartilhamos</h2>
      <ul className="list-disc list-inside space-y-2">
        <li><strong className="text-neutral-100">Supabase:</strong> hospeda nosso banco de dados e sistema de autenticação.</li>
        <li><strong className="text-neutral-100">Mercado Pago:</strong> processa pagamentos e cobranças recorrentes.</li>
        <li><strong className="text-neutral-100">Google (API do Gemini):</strong> processa os prompts e imagens que você envia às funcionalidades de IA, para gerar a resposta.</li>
      </ul>
      <p className="mt-2">Não vendemos seus dados pessoais a terceiros.</p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">5. Transferência internacional</h2>
      <p>
        A API do Google Gemini pode processar dados fora do Brasil. Esse processamento é limitado ao
        necessário para gerar a resposta da funcionalidade de IA que você usou, e segue as salvaguardas
        contratuais do próprio provedor.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">6. Por quanto tempo guardamos os dados</h2>
      <p>
        Mantemos os dados da sua conta enquanto ela estiver ativa. Registros de cobrança são mantidos
        pelo prazo exigido pela legislação fiscal aplicável, mesmo após o cancelamento da conta.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">7. Seus direitos como titular (art. 18 da LGPD)</h2>
      <p>Você pode solicitar, a qualquer momento, via [E-MAIL DE CONTATO]:</p>
      <ul className="list-disc list-inside mt-2 space-y-1">
        <li>confirmação de que tratamos seus dados;</li>
        <li>acesso aos dados;</li>
        <li>correção de dados incompletos ou desatualizados;</li>
        <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>portabilidade dos dados a outro fornecedor;</li>
        <li>eliminação dos dados tratados com base no seu consentimento;</li>
        <li>informação sobre com quem compartilhamos seus dados;</li>
        <li>revogação do consentimento, quando aplicável.</li>
      </ul>
      <p className="mt-2">Responderemos dentro do prazo previsto na LGPD.</p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">8. Segurança</h2>
      <p>
        Usamos práticas técnicas razoáveis para proteger seus dados (controle de acesso, criptografia
        em trânsito, isolamento de dados por usuário no banco de dados). Nenhum sistema é 100% livre de
        risco; se houver um incidente de segurança relevante, avisaremos conforme exigido por lei.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">9. Cookies</h2>
      <p>
        Usamos apenas o cookie de sessão estritamente necessário para manter você autenticado (via
        Supabase Auth). Não usamos cookies de rastreamento, analytics ou publicidade de terceiros.
      </p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">10. Encarregado de dados (DPO)</h2>
      <p>Contato do encarregado: [E-MAIL DE CONTATO].</p>
    </section>

    <section>
      <h2 className="text-lg font-bold text-neutral-100 mb-2">11. Alterações nesta Política</h2>
      <p>Podemos atualizar esta Política. Mudanças relevantes serão comunicadas por e-mail ou aviso no serviço.</p>
    </section>
  </LegalPageLayout>
);
```

- [ ] **Step 4: Ligar as páginas em `src/App.tsx`**

Adicionar o import junto aos outros componentes (perto da linha 19-21, onde `LandingPage`/`CheckoutModal` são importados):

```ts
import { TermsOfService } from './components/legal/TermsOfService';
import { PrivacyPolicy } from './components/legal/PrivacyPolicy';
```

Adicionar o estado logo após a declaração de `currentView` (perto da linha 135, mesmo bloco "View Routing & Access Control"):

```ts
const [legalPage] = useState<'termos' | 'privacidade' | null>(() => {
  if (window.location.pathname === '/termos') return 'termos';
  if (window.location.pathname === '/privacidade') return 'privacidade';
  return null;
});
```

Adicionar o retorno antecipado **imediatamente antes** do comentário `// 1. Landing Page View` (antes de `if (currentView === 'landing')`, perto da linha 748) — precisa vir antes de qualquer checagem de `isAuthenticated`/assinatura, já que a página legal é pública:

```tsx
// 0. Legal Pages (públicas, sem gate de autenticação/assinatura)
if (legalPage === 'termos') return <TermsOfService />;
if (legalPage === 'privacidade') return <PrivacyPolicy />;

// 1. Landing Page View
if (currentView === 'landing') {
  // ... (resto do código existente, sem mudança)
```

- [ ] **Step 5: Trocar os links mortos no rodapé de `src/components/LandingPage.tsx`**

Estado atual (linhas 753-755):
```tsx
<span>TERMOS DE USO</span>
<span>PRIVACIDADE</span>
<span>SEGURANÇA</span>
```

Novo (só os dois primeiros viram link — `SEGURANÇA` fica como está, fora de escopo deste spec):
```tsx
<a href="/termos" className="hover:text-amber-400 transition-colors">TERMOS DE USO</a>
<a href="/privacidade" className="hover:text-amber-400 transition-colors">PRIVACIDADE</a>
<span>SEGURANÇA</span>
```

- [ ] **Step 6: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros (o projeto não roda `vite build` neste plano — só typecheck; `npm run build` fica pra verificação manual na Task 2 se quiser rodar o app local).

- [ ] **Step 7: Commit**

```bash
git add src/components/legal/LegalPageLayout.tsx src/components/legal/TermsOfService.tsx \
  src/components/legal/PrivacyPolicy.tsx src/App.tsx src/components/LandingPage.tsx
git commit -m "$(cat <<'EOF'
feat: publish Terms of Service and Privacy Policy pages

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Verificação manual

**Files:** nenhum arquivo do repositório — verificação ao vivo após o deploy.

**Interfaces:** nenhuma — task de verificação, não produz interface para outras tasks.

- [ ] **Step 1: Deploy via o fluxo protegido**

Seguir `docs/superpowers/runbooks/2026-09-22-deploy-workflow.md`: branch → push → PR → check da Vercel verde → merge.

- [ ] **Step 2: Refresh direto nas URLs (não só clique)**

Abrir `https://.../termos` e `https://.../privacidade` digitando a URL direto (ou dando F5 numa aba já nelas) — não só navegando por link, pra garantir que a checagem de `pathname` roda antes de qualquer outro retorno condicional em `App.tsx`. Confirmar que renderiza a página legal certa, não o app principal nem uma tela em branco.

- [ ] **Step 3: Confirmar acesso sem sessão**

Repetir o Step 2 numa aba anônima/deslogada. As páginas legais devem renderizar normalmente sem pedir login.

- [ ] **Step 4: Conferir os links do rodapé**

Na landing page (`/`), clicar em "TERMOS DE USO" e "PRIVACIDADE" no rodapé e confirmar que abrem as páginas certas.

- [ ] **Step 5: Revisão de leitura**

Ler as duas páginas publicadas de ponta a ponta. Confirmar que os únicos placeholders visíveis são `[RAZÃO SOCIAL]`, `[CNPJ/CPF]` e `[E-MAIL DE CONTATO]`, sempre entre colchetes — nenhum outro dado inventado. Anotar em algum lugar visível (ex.: próxima mensagem pro usuário) que esses 3 placeholders precisam ser preenchidos com os dados reais antes do documento valer juridicamente.
