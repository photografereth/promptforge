# Pilar 4: Deploy de Produção Formal, CDN, Domínio — Design

Status: Approved
Date: 2026-09-22
Depends on: Pilar 1 (fundação), Pilar 2 (billing, já em produção)
Unblocks: nada diretamente — reduz risco operacional para todos os pilares

## Contexto

Hoje o fluxo de deploy do `promptforge` é: commit direto na branch `main`,
push, e a integração Git da Vercel builda produção automaticamente. Não há
pull request, não há revisão, e não há um jeito documentado de reverter um
deploy ruim. Isso funcionou até aqui porque o projeto estava em fase de
construção dos Pilares 1 e 2, mas agora que o Pilar 2 (cobrança real via
Mercado Pago) está em produção, um deploy quebrado pode afetar cobrança de
usuários reais.

O spec original do Pilar 1 definiu o Pilar 4 como "Deploy de produção
formal, CDN, domínio" — herdado de um relatório anterior pensado para GCP
(Cloud Run atrás de load balancer + CDN). Nesse stack (Vercel + Supabase),
a CDN já vem de graça: todo deploy da Vercel é servido pela Edge Network
deles automaticamente, sem configuração adicional. O que sobra de real
trabalho é o processo de deploy em si.

Domínio próprio definitivo (ex.: `promptforge.com`) fica para mais perto do
lançamento — o usuário decidiu comprá-lo só então. Até lá, a produção
continua na URL estável da Vercel (`APP_URL=https://promptforge-taupe-tau.vercel.app`).
O domínio `3dco.com.br`, anexado ao projeto em 2026-09-22, é temporário e
serve só para validar o Resend e resolver o bypass de Deployment Protection
do webhook do Mercado Pago (ver [[project_pilar2_billing_status]]) — não é
o domínio de lançamento e não faz parte deste pilar.

### Descoberta que reduziu o escopo

Durante a investigação deste spec, testes diretos (`curl`) contra o projeto
confirmaram que a **Vercel Authentication (Deployment Protection) não
protege a URL estável de produção** (`promptforge-taupe-tau.vercel.app`) —
ela responde normalmente sem desafio de SSO. A proteção só se aplica às
URLs efêmeras de cada deploy (`promptforge-<hash>-...vercel.app`) e à URL
"org-scoped" (`promptforge-felipe-mirandas-projects-...vercel.app`), ambas
retornando `302` para o SSO da Vercel. Ou seja, o bypass do
`MP_NOTIFICATION_URL_OVERRIDE` só era necessário para testar via **Preview**
(Task 18) — a produção nunca precisou de domínio próprio para o webhook
funcionar.

A documentação oficial da Vercel também confirmou que **Instant Rollback é
recurso exclusivo dos planos Pro/Enterprise** — o projeto está no plano
**Hobby**, então essa ferramenta não está disponível. O rollback de um
deploy ruim precisa ser feito via `git revert` + push.

## Objetivo

Formalizar o processo de deploy da `main` para reduzir o risco de um deploy
quebrado chegar à produção sem passar por uma Preview, e documentar como
reverter um deploy ruim já que Instant Rollback não existe no plano atual.

## Não-objetivos (fora de escopo deste pilar, por enquanto)

- Domínio de produção definitivo — comprado e configurado só perto do
  lançamento, como uma extensão futura deste mesmo pilar.
- CDN customizada — a Edge Network da Vercel já cobre isso sem configuração.
- Ambiente de staging separado do Preview automático da Vercel.
- Qualquer mudança em `MP_NOTIFICATION_URL_OVERRIDE`/`APP_URL` além do que já
  foi feito em 2026-09-22 (ver [[project_pilar2_billing_status]]).
- Migrar de plano Hobby para Pro (não descartado, mas não é decisão deste
  spec).

## Design

### 1. Branch protection na `main` (GitHub)

Regras a aplicar via GitHub (Settings → Branches → `main`):

- **Require a pull request before merging** — sem exigir aprovação de
  terceiro (projeto solo, exigir review de outra pessoa travaria o fluxo
  sem ganho real).
- **Require status checks to pass before merging** — o check que a
  integração Git da Vercel posta em cada PR quando a Preview termina de
  buildar. O nome exato do contexto desse check precisa ser lido de um PR
  real antes de marcar como obrigatório (não adivinhar); se a regra
  referenciar um nome de check que nunca aparece, nenhum PR consegue
  mergear.
- **Do not allow force pushes** e **do not allow deletions** na `main`.
- Squash merge como estratégia padrão (histórico linear, um commit por
  mudança) — configurar em Settings → General → "Allow squash merging" como
  única opção habilitada para este repositório.

### 2. Fluxo de deploy documentado

```
1. git checkout -b <branch>            # nunca commitar direto em main
2. push da branch                       # Vercel builda Preview automático
3. validar manualmente na Preview       # (ou testes automatizados, se existirem)
4. abrir PR (branch → main)
5. merge só libera com PR aberto + check da Vercel verde
6. squash merge
7. push do merge → Vercel builda e promove produção automaticamente
```

Este fluxo vira um novo arquivo `docs/superpowers/runbooks/2026-09-22-deploy-workflow.md`
(sem segredos, só processo).

### 3. Rollback de um deploy ruim

Sem Instant Rollback (Hobby), o caminho é reverter o código e deixar o
Vercel rebuildar:

```bash
git log --oneline                    # achar o(s) commit(s) do deploy ruim
git revert <sha> --no-edit           # ou revert de um range de commits
git push origin main                 # Vercel builda e promove automaticamente
```

**Aviso a documentar no runbook:** isso reverte código, não variáveis de
ambiente. Se o deploy ruim veio acompanhado de uma mudança de env var na
Vercel, `git revert` não desfaz essa mudança — precisa ser conferida e
revertida manualmente no painel/API da Vercel.

### 4. Headroom de funções serverless (plano Hobby)

Hoje: 8 funções em `api/*.ts` (fora `_lib/`), limite do Hobby é 12 — 4 de
folga. Isso já é levado em conta hoje pelo catch-all
`api/billing/[action].ts`, que agrupa várias operações de billing numa
única function em vez de uma por operação. Registro no runbook como
checklist a conferir antes de adicionar uma rota nova em `api/`, sem
automação — se o headroom apertar, a opção é agrupar rotas num catch-all
igual ao billing, ou migrar para o plano Pro.

## Testes / verificação

Não há código de produto para testar aqui — a verificação é do processo:

1. Após configurar a branch protection: tentar `git push` direto na `main`
   e confirmar que o GitHub rejeita.
2. Abrir um PR de teste (branch trivial) e confirmar que o merge fica
   bloqueado até o check da Vercel aparecer verde.
3. Fazer um revert de teste (`git revert` de um commit inofensivo, ex. um
   commit de docs) e confirmar que o Vercel builda e promove a versão
   revertida em produção.

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Nome do check da Vercel mal identificado trava todo merge | Ler o nome exato de um PR real antes de marcar como obrigatório; testar com um PR trivial antes de depender do fluxo para mudanças reais. |
| Revert de código não desfaz env var associada | Documentar explicitamente no runbook; checklist manual de "o que mais mudou junto com este deploy" antes de declarar o rollback completo. |
| `gh` CLI e o MCP do GitHub indisponíveis nesta sessão (erro de auth) | Aplicar a branch protection manualmente pela UI do GitHub se a conexão não for restabelecida antes da implementação. |
