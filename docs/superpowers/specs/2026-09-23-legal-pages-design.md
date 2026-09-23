# Pilar 5 (parte 1): Termos de Uso e Política de Privacidade — Design

Status: Approved
Date: 2026-09-23
Depends on: Pilar 1 (auth/dados), Pilar 2 (billing, cujas regras de reembolso/cancelamento os Termos precisam refletir), Pilar 3 (quota de IA, mencionada na Política)
Unblocks: nada diretamente

## Contexto

O Pilar 5 do roadmap original ("Rate limiting, logging centralizado,
Termos/LGPD") embala três subsistemas independentes. Este spec cobre só o
primeiro: publicar Termos de Uso e Política de Privacidade reais. Rate
limiting e logging centralizado ficam para specs futuros e separados.

Hoje o rodapé da landing page (`src/components/LandingPage.tsx:753-755`)
tem `<span>TERMOS DE USO</span>` e `<span>PRIVACIDADE</span>` — texto sem
link, sem página por trás. O produto já cobra assinantes reais via
Mercado Pago (Pilar 2) e processa dados pessoais (e-mail, nome,
contagem de uso de IA) sem nenhum termo publicado — risco jurídico ativo,
não hipotético.

Levantamento feito no código antes de escrever este spec, pra não gerar
um documento genérico:
- Nenhum tracking/analytics de terceiros (`gtag`, `posthog`, etc.) — sem
  cookie não-essencial, então sem necessidade de banner de consentimento
  de cookies.
- Imagens de produto/referência enviadas ao endpoint do Gemini como
  base64 direto no corpo da requisição (`ReferenceUploadSection.tsx`) —
  nunca persistidas em storage do backend.
- Dados de pagamento (cartão) nunca passam pelo backend do PromptForge —
  ficam inteiramente com o Mercado Pago (Card Payment Brick tokeniza no
  cliente).
- Dados coletados no cadastro: e-mail e nome de exibição opcional
  (`CheckoutModal.tsx`, via `supabase.auth.signUp`).
- Terceiros que processam dados pessoais: Supabase (auth + banco),
  Mercado Pago (pagamento), Google (API do Gemini, para os prompts e
  imagens enviados).

A entidade legal (razão social/CNPJ ou CPF/MEI) e o e-mail de contato
ainda não estão definidos — o documento usa placeholders explícitos
(`[RAZÃO SOCIAL]`, `[CNPJ/CPF]`, `[E-MAIL DE CONTATO]`) que precisam ser
preenchidos antes da publicação real valer juridicamente.

## Objetivo

Publicar Termos de Uso e Política de Privacidade acessíveis via URL
própria (`/termos`, `/privacidade`), linkados de verdade no rodapé, com
conteúdo específico deste produto (não boilerplate genérico) — cobrindo
o que a LGPD exige estar comunicado ao titular dos dados.

## Não-objetivos (fora de escopo desta parte do Pilar 5)

- Rate limiting genérico e logging centralizado — specs futuros e
  separados.
- Qualquer fluxo self-service de exclusão/exportação de dados — os
  direitos do titular (acesso, correção, exclusão, portabilidade,
  revogação de consentimento) ficam documentados como processo manual
  via e-mail de contato, não automatizado.
- Banner de consentimento de cookies — não há cookie não-essencial hoje;
  se isso mudar (ex.: analytics futuro), revisitar.
- Revisão jurídica do texto por um advogado — o texto é escrito com
  cuidado e específico ao produto, mas não substitui revisão profissional
  antes de valer como documento legal definitivo.
- Preencher os dados legais reais (CNPJ/CPF, e-mail) — ficam como
  placeholder, a preencher pelo usuário.

## Design

### Roteamento

Sem router (o projeto não usa `react-router` — `vercel.json` reescreve
tudo pra `index.html` e o app decide o que renderizar lendo
`window.location.pathname`, padrão já usado pra `/subscription/confirm`
em `App.tsx:143`). `/termos` e `/privacidade` seguem o mesmo padrão: uma
checagem de pathname em `App.tsx` que renderiza a página legal
correspondente em vez do app principal, antes de qualquer lógica de
autenticação/assinatura rodar (a página legal é pública, sem gate).

### Componentes

- `src/components/legal/TermsOfService.tsx` — Termos de Uso.
- `src/components/legal/PrivacyPolicy.tsx` — Política de Privacidade.

Cada um é uma página standalone (não um modal): título, texto corrido em
seções numeradas, data de "última atualização", e um link de volta pra
`/`. Sem dependência de estado do app (não precisa estar logado pra ler).

### Conteúdo — Termos de Uso

Seções obrigatórias: identificação da empresa (placeholder), descrição
do serviço (geração de prompts para Google Flow via TikTok Shop), regras
de cadastro e conta, planos e cobrança (mensal/anual, referenciando o
Mercado Pago como processador, renovação automática), **direito de
arrependimento de 7 dias** (Pilar 2, CDC art. 49 — já implementado como
`withdraw`, o texto só documenta o que o código já faz), cancelamento e
efeitos, **limite diário de uso de IA** (Pilar 3, 50 gerações/dia,
reset à meia-noite em São Paulo), uso aceitável (proibições: abuso,
engenharia reversa, revenda), propriedade intelectual dos prompts
gerados (usuário é dono do output), limitação de responsabilidade,
alterações nos termos, foro/legislação aplicável (Brasil).

### Conteúdo — Política de Privacidade

Seções obrigatórias (mapeadas aos artigos da LGPD que fundamentam cada
uma): controlador dos dados (placeholder), quais dados são coletados e
por quê (e-mail, nome, dados de uso/quota — nunca dados de cartão),
base legal do tratamento (execução de contrato para a maior parte,
consentimento onde aplicável), com quem os dados são compartilhados e
por quê (Supabase, Mercado Pago, Google Gemini API — nomeados
especificamente, não "parceiros" genérico), transferência internacional
(a API do Gemini pode processar dados fora do Brasil), retenção de
dados, **direitos do titular** (art. 18 LGPD: confirmação, acesso,
correção, anonimização/eliminação, portabilidade, revogação de
consentimento — todos exercidos por e-mail, sem prazo de resposta
inventado além do que a lei já prevê), segurança dos dados, cookies
(só os estritamente necessários — sessão do Supabase Auth), contato do
encarregado/DPO (placeholder), alterações na política.

### Rodapé

`src/components/LandingPage.tsx:753-755`: trocar os `<span>` por
`<a href="/termos">TERMOS DE USO</a>` e `<a href="/privacidade">PRIVACIDADE</a>`.
O terceiro item (`SEGURANÇA`) e o quarto (`STATUS: 99.9% UPTIME`) não
fazem parte deste spec — `STATUS: 99.9% UPTIME` é texto decorativo sem
sistema de monitoramento real por trás (nota para quando o Pilar 5
tratar de logging/monitoramento; não removido nem alterado aqui pra não
expandir escopo).

## Testes / verificação

Sem lógica de negócio — verificação é manual:
1. Navegar direto pra `https://.../termos` e `.../privacidade` (refresh
   da página, não só client-side nav) e confirmar que renderiza o
   conteúdo certo, não o app principal nem um 404.
2. Confirmar que os links do rodapé da landing page apontam pros paths
   certos e abrem a página (não precisa estar logado).
3. Revisão de leitura: nenhum placeholder tipo `[RAZÃO SOCIAL]` deve
   aparecer sem estar claramente marcado como algo a preencher.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Texto genérico demais, não reflete o produto de verdade | Escrito a partir do levantamento real do código (quota, reembolso, terceiros que processam dados), não de um template solto. |
| Placeholders esquecidos e o documento vai ao ar sem validade jurídica real | Marcados de forma óbvia (`[RAZÃO SOCIAL]` etc.), listados explicitamente neste spec e no plano como pendência do usuário antes de considerar "publicado" de verdade. |
| Página legal exige login ou quebra em refresh direto (por causa do rewrite genérico) | Checagem de pathname roda antes de qualquer verificação de sessão/assinatura em `App.tsx`; testado com refresh direto na Task de verificação. |
