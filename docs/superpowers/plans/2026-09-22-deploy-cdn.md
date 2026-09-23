# Pilar 4: Deploy de Produção Formal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar impossível um deploy de produção quebrado chegar à `main` sem passar por uma Vercel Preview verde, e deixar documentado como reverter um deploy ruim (o plano Hobby não tem Instant Rollback).

**Architecture:** Não há código de produto neste plano — é 100% configuração do GitHub (branch protection na `main`) e um runbook novo (`docs/superpowers/runbooks/2026-09-22-deploy-workflow.md`) documentando o fluxo de deploy e de rollback. A primeira tarefa já usa o fluxo alvo (branch → PR → merge) para nascer dogfooding o próprio processo e, de quebra, revelar o nome exato do check que a integração Vercel posta nos PRs — nome que a segunda tarefa precisa para configurar a proteção.

**Tech Stack:** Git, GitHub (web UI — `gh` CLI não está instalado nesta máquina e o MCP do GitHub está com erro de auth nesta sessão), Vercel (integração Git já existente, nenhuma mudança de configuração da Vercel neste plano).

**Spec:** `docs/superpowers/specs/2026-09-22-deploy-cdn-design.md`

## Global Constraints

- Repositório: `github.com/photografereth/promptforge`, branch principal `main`.
- Plano Vercel é **Hobby** — sem Instant Rollback; todo rollback é `git revert` + novo deploy.
- Squash merge é a única estratégia de merge permitida no repositório (histórico linear).
- A proteção de branch deve valer também para o dono do repositório (nenhuma exceção de admin) — é o próprio ponto de existir, senão a regra não impede nada num repo solo.
- Nenhuma mudança de `MP_NOTIFICATION_URL_OVERRIDE`, `APP_URL` ou domínio neste plano — já resolvido em 2026-09-22, fora de escopo aqui.

## Review Focus

- Nome do check da Vercel adivinhado ou digitado de cabeça em vez de lido de um PR real — a regra de proteção referenciaria um check que nunca roda, e nenhum PR conseguiria mergear nunca mais. Mitigado pela ordem das tarefas (Task 1 gera o PR real antes da Task 2 configurar a regra) e pela Task 2 exigir escolher o check pelo autocomplete do GitHub, nunca digitar o nome à mão.
- "Require a pull request" configurado mas "Allow merge commits"/"Allow rebase merging" continuarem habilitados no repositório — squash deixaria de ser realmente a única opção, mesmo com a proteção de branch ativa. A Task 2 desliga os outros dois modos explicitamente em Settings → General.
- Proteção configurada só "para colaboradores", com bypass de admin ligado — o dono do repo continuaria conseguindo dar push direto na `main`, e a trava vira decoração. A Task 2 confirma explicitamente que o bypass de administrador está desligado.
- Rollback de código sem checar env vars associadas ao mesmo deploy ruim — o revert parece ter "consertado" produção mas uma env var errada continua lá. O runbook (Task 1) documenta esse aviso explicitamente, e a Task 3 exercita o fluxo completo de revert pra deixar o hábito claro.
- Uma rota nova em `api/` estourando o limite de 12 functions do Hobby só seria descoberta no deploy de produção (falha silenciosa pro usuário final) se não houvesse Preview obrigatória antes — com a Task 2 em vigor, esse erro já aparece como Preview falhando no PR, antes de chegar em `main`. Documentado no runbook (Task 1) como checklist manual, já que não há como automatizar a contagem sem código novo.

---

### Task 1: Runbook de deploy/rollback, publicado usando o próprio fluxo alvo

**Files:**
- Create: `docs/superpowers/runbooks/2026-09-22-deploy-workflow.md`

**Interfaces:**
- Produces: o nome exato do check de status que a integração Git da Vercel posta em um Pull Request deste repositório (string literal, obtida na Step 4) — consumido pela Task 2 ao configurar a branch protection.

- [ ] **Step 1: Criar a branch e o arquivo do runbook**

```bash
cd /Users/macos/Development/promptforge-main
git checkout main
git pull origin main
git checkout -b docs/deploy-workflow-runbook
```

Criar `docs/superpowers/runbooks/2026-09-22-deploy-workflow.md` com este conteúdo exato:

```markdown
# Fluxo de Deploy e Rollback — promptforge

A partir de 2026-09-22, a `main` é protegida no GitHub (Pilar 4). Ninguém —
nem o dono do repositório — consegue mais dar push direto nela; toda
mudança passa por PR + Preview da Vercel verde.

## Fluxo normal de deploy

1. `git checkout -b <nome-da-branch>` a partir de uma `main` atualizada.
2. Fazer a mudança, commitar.
3. `git push -u origin <nome-da-branch>` — a Vercel builda uma Preview
   automaticamente.
4. Validar a Preview manualmente (a URL aparece nos comentários/checks do
   PR).
5. Abrir PR no GitHub (`<branch>` → `main`).
6. Esperar o check da Vercel ficar verde no PR.
7. Merge via squash (única opção habilitada neste repositório).
8. O push do merge na `main` dispara o build de produção automaticamente.

## Rollback de um deploy ruim

Sem Instant Rollback (recurso Pro/Enterprise — este projeto está no plano
Hobby), o rollback também passa pelo fluxo normal. A branch protegida não
abre exceção nem para o dono do repositório:

1. `git log --oneline main` — achar o SHA do commit (ou do merge) que
   causou o problema.
2. `git checkout -b revert-<descrição-curta>`
3. `git revert <sha> --no-edit` (ou um intervalo de commits, se for mais
   de um)
4. `git push -u origin revert-<descrição-curta>`
5. Abrir PR, esperar o check da Vercel, merge via squash — igual a
   qualquer outra mudança.
6. Confirmar em Vercel → Deployments que uma nova build de produção ficou
   `READY` com o revert aplicado.

**Atenção:** isso reverte só código. Se o deploy ruim veio junto com uma
mudança de variável de ambiente na Vercel, o revert de código **não**
desfaz a env var — checar `Vercel → Settings → Environment Variables`
manualmente depois de qualquer rollback.

## Headroom de funções serverless (plano Hobby)

Limite do Hobby: 12 funções serverless por projeto. Hoje (2026-09-22): 8
em uso (`api/*.ts`, fora `_lib/`) — 4 de folga. Antes de criar uma rota
nova em `api/`, contar quantas existem; se estourar o limite, agrupar
operações relacionadas num único arquivo com roteamento interno (o padrão
já usado em `api/billing/[action].ts`) em vez de um arquivo por operação.
Com a branch protection da Task 2 deste plano em vigor, estourar o limite
já aparece como Preview falhando no PR — antes de chegar em produção.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/2026-09-22-deploy-workflow.md
git commit -m "$(cat <<'EOF'
docs: add deploy/rollback workflow runbook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push e abrir o PR**

```bash
git push -u origin docs/deploy-workflow-runbook
```

No GitHub, abrir `https://github.com/photografereth/promptforge/pulls`,
clicar em "Compare & pull request" para a branch `docs/deploy-workflow-runbook`,
título livre (ex.: "docs: deploy/rollback workflow runbook"), criar o PR.

- [ ] **Step 4: Ler o nome exato do check da Vercel no PR**

Esperar a Vercel comentar/postar o status de build no PR (leva menos de um
minuto). Na página do PR, abrir a aba "Checks" (ou rolar até a seção de
checks no rodapé da conversa) e copiar o **nome exato** exibido para o
check da Vercel (ex.: algo como `Vercel` ou `Vercel – promptforge` —
**não adivinhar, copiar literalmente o que aparece na tela**). Guardar
essa string — a Task 2 precisa dela.

Esperar o check ficar verde (deployment da Preview concluído com sucesso).

- [ ] **Step 5: Merge do PR**

Na página do PR, usar o botão de merge com a opção **Squash and merge**
(neste momento a proteção de branch ainda não existe, então o merge é
liberado normalmente).

- [ ] **Step 6: Verificar que produção rebuildou**

```bash
git checkout main
git pull origin main
cat docs/superpowers/runbooks/2026-09-22-deploy-workflow.md | head -5
```

Confirmar que o arquivo está presente na `main` local. Na Vercel
(Deployments, filtro Production), confirmar que existe um deployment novo
com estado `READY` para o commit do squash-merge.

---

### Task 2: Configurar branch protection na `main`

**Files:** nenhum arquivo do repositório — mudança feita inteiramente na configuração do GitHub (Settings).

**Interfaces:**
- Consumes: o nome exato do check da Vercel obtido na Task 1, Step 4.

- [ ] **Step 1: Restringir a estratégia de merge do repositório**

No GitHub: `Settings` → `General` → seção "Pull Requests".
Desmarcar **"Allow merge commits"** e **"Allow rebase merging"**, deixando
marcado apenas **"Allow squash merging"**.

- [ ] **Step 2: Criar a regra de proteção da `main`**

No GitHub: `Settings` → `Branches` → `Add branch protection rule` (ou
`Add rule`, dependendo da versão da UI).
- Branch name pattern: `main`
- Marcar **"Require a pull request before merging"**. Deixar "Require
  approvals" com **0** (projeto solo — exigir aprovação de terceiro
  travaria todo merge).
- Marcar **"Require status checks to pass before merging"**. No campo de
  busca, digitar parte do nome do check da Vercel (o texto exato anotado
  na Task 1, Step 4) e **selecionar da lista de sugestões** — nunca
  digitar o nome inteiro à mão sem ele aparecer na lista, porque isso
  indicaria que o GitHub nunca viu esse check rodar e a regra ficaria
  presa esperando um check que nunca chega.
- Confirmar que **não** há nenhuma opção de bypass para administradores
  marcada (em UIs recentes do GitHub isso aparece como "Do not allow
  bypassing the above settings" — deixar **marcado**; em UIs mais antigas,
  é o checkbox "Include administrators" — deixar **marcado**). Sem isso,
  o dono do repositório continua conseguindo dar push direto na `main` e
  a proteção não vale de fato.
- Em "Rules applied to everyone including administrators" (ou seção
  equivalente): garantir que **"Allow force pushes"** está desmarcado e
  **"Allow deletions"** está desmarcado.
- Salvar a regra.

- [ ] **Step 3: Verificar que push direto na `main` é rejeitado**

```bash
cd /Users/macos/Development/promptforge-main
git checkout -b test/branch-protection
echo "<!-- teste de branch protection $(date -u +%Y-%m-%dT%H:%M:%SZ) -->" >> docs/superpowers/runbooks/2026-09-22-deploy-workflow.md
git add docs/superpowers/runbooks/2026-09-22-deploy-workflow.md
git commit -m "test: verify branch protection rejects direct push to main"
git push origin test/branch-protection:main
```

Resultado esperado: o GitHub **rejeita** o push com uma mensagem citando a
regra de proteção (algo como `protected branch hook declined` ou
`required status check`). Isso confirma que a regra está ativa.

- [ ] **Step 4: Limpar a branch de teste**

```bash
git checkout main
git branch -D test/branch-protection
git push origin --delete test/branch-protection
```

(O push de teste do Step 3 falhou, então `main` local e remota não foram
alteradas — só a branch de teste local e a referência remota criada por
ela precisam ser removidas.)

---

### Task 3: Exercitar o fluxo de rollback ponta a ponta sob a proteção nova

**Files:**
- Modify: `docs/superpowers/runbooks/2026-09-22-deploy-workflow.md` (edição trivial e reversível, só para o drill)

**Interfaces:** nenhuma — task de verificação, não produz interface para outras tasks.

- [ ] **Step 1: Criar uma mudança trivial via o fluxo protegido**

```bash
git checkout main
git pull origin main
git checkout -b docs/rollback-drill
```

Adicionar ao final de `docs/superpowers/runbooks/2026-09-22-deploy-workflow.md`:

```markdown

## Histórico de drills

- 2026-09-22: drill de rollback executado com sucesso (Task 3 do plano do Pilar 4).
```

```bash
git add docs/superpowers/runbooks/2026-09-22-deploy-workflow.md
git commit -m "$(cat <<'EOF'
docs: record rollback drill entry

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push -u origin docs/rollback-drill
```

Abrir PR (`docs/rollback-drill` → `main`), esperar o check da Vercel
ficar verde, fazer squash merge.

- [ ] **Step 2: Confirmar que produção recebeu a mudança**

Na Vercel (Deployments, filtro Production), confirmar um novo deployment
`READY` para o commit do squash-merge do Step 1.

```bash
git checkout main
git pull origin main
tail -5 docs/superpowers/runbooks/2026-09-22-deploy-workflow.md
```

Confirmar que a linha "drill de rollback executado" está presente.

- [ ] **Step 3: Executar o drill de rollback (revert via PR)**

```bash
git log --oneline -3
```

Copiar o SHA do commit de squash-merge do Step 1 (o que adicionou o
histórico de drills).

```bash
git checkout -b revert/rollback-drill
git revert <sha-do-squash-merge> --no-edit
git push -u origin revert/rollback-drill
```

Abrir PR (`revert/rollback-drill` → `main`), esperar o check da Vercel
ficar verde, fazer squash merge.

- [ ] **Step 4: Confirmar que o revert chegou em produção**

```bash
git checkout main
git pull origin main
tail -5 docs/superpowers/runbooks/2026-09-22-deploy-workflow.md
```

Confirmar que a linha "drill de rollback executado" **não** está mais
presente (o revert removeu a seção "Histórico de drills"). Na Vercel,
confirmar um novo deployment `READY` de produção para o commit do
squash-merge do revert.

Isso comprova, de ponta a ponta, que: (a) o fluxo protegido funciona pra
mudanças normais, (b) o fluxo de rollback documentado no runbook funciona
de verdade sob a proteção de branch, e (c) nenhum passo exigiu bypass de
administrador.
