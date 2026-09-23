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
2. `git checkout -b revert/<descrição-curta>`
3. `git revert <sha> --no-edit` para um único commit. Para um intervalo
   (do mais antigo ao mais novo, ambos inclusos):
   `git revert --no-edit <mais-antigo>^..<mais-novo>`
4. `git push -u origin revert/<descrição-curta>`
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
Com a branch protection da `main` em vigor (ver seção acima), estourar o
limite já aparece como Preview falhando no PR — antes de chegar em
produção.
