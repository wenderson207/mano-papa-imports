# BStyle ERP — GitHub Pages + Firebase

Sistema reconstruído sem Google Apps Script: o código (HTML/CSS/JS) mora 100% neste repositório GitHub, publicado via GitHub Pages. Login e dados ficam no Firebase (Authentication + Firestore).

## Por que essa arquitetura

- **Sem "motor" no meio** → sem cold start, sem delay de Apps Script.
- **Firestore é um banco de verdade** → leituras rápidas, tipos corretos (número é número, booleano é booleano — chega de bug de "TRUE" virar texto).
- **Firebase Authentication** cuida de login, sessão persistente entre recarregamentos e recuperação de senha — tudo pronto, testado por milhões de apps, sem eu precisar reinventar token/sessão à mão.
- **Segurança de verdade**: as regras em `firestore.rules` são aplicadas pelo próprio Firestore — não dá pra burlar só chamando a API por fora.

## Estrutura do repositório

```
index.html                 → login + shell do sistema (uma página só)
seed.html                  → configuração inicial (rodar 1 vez)
firestore.rules            → regras de segurança (colar no Console do Firebase)
assets/js/firebase-init.js → configuração do Firebase
assets/js/db.js            → acesso a dados (Firestore)
assets/js/auth.js          → login, logout, permissões
assets/js/app.js           → navegação do painel
modules/dashboard.html     → ✅ pronto
modules/clientes.html      → ✅ pronto
modules/produtos.html      → ⏳ próximo
modules/*.html             → ⏳ demais módulos (mesmo padrão do Clientes)
```

## Passo a passo

### 1) Publicar no GitHub Pages
1. Crie um repositório no GitHub (pode ser público ou privado — Pages funciona nos dois em contas Pro; em conta grátis precisa ser público).
2. Suba todos estes arquivos mantendo a estrutura de pastas.
3. Settings → Pages → Source: **branch `main`, pasta `/ (root)`** → Save.
4. Espere 1-2 minutos, o link aparece ali mesmo (algo como `https://seu-usuario.github.io/nome-do-repo/`).

### 2) Configurar o Firebase
1. Console do Firebase → **Authentication** → Sign-in method → ative **Email/senha**.
2. Console do Firebase → **Firestore Database** → confirme que já está criado (você disse que sim).
3. Firestore Database → **Regras** → apague o conteúdo e cole o `firestore.rules` deste repositório → **Publicar**.

### 3) Rodar a configuração inicial (uma vez só)
Abra `https://seu-usuario.github.io/nome-do-repo/seed.html`, preencha seu nome/email/senha, clique em **Rodar configuração inicial**. Isso cria:
- Os 6 perfis padrão (Administrador, Gerente, Financeiro, Vendedor, Técnico, Estoquista)
- Permissão total do Administrador em todos os módulos
- O seu usuário administrador

### 4) Login
Vá para `index.html` (a raiz do site) e entre com o email/senha que você definiu no seed.

## O que já está funcionando

- ✅ Login / logout / recuperação de senha (Firebase Authentication)
- ✅ Shell completo (menu, navbar, tema claro/escuro, toast)
- ✅ Dashboard (KPIs reais consultando o Firestore)
- ✅ Clientes (CRUD completo)

## O que falta (mesmo padrão, módulo por módulo)

Produtos, Fornecedores, Funcionários, Empresas, Vendas (PDV), Orçamentos, Compras, Estoque, Assistência Técnica, Garantias, Financeiro, Relatórios, Configurações.

Cada um segue exatamente o molde de `modules/clientes.html`: HTML + `<script>` que chama `dbGetAll`/`dbInsert`/`dbUpdate`/`dbExcluirLogico` (todos em `assets/js/db.js`) e `checarPermissao` (em `assets/js/auth.js`) antes de qualquer ação.

## Observações importantes

- **A "senha inicial" de um novo funcionário**: como não existe mais servidor, criar um funcionário com login usa um truque com uma segunda instância temporária do Firebase (já implementado em `auth.js` → `criarFuncionarioComLogin`), pra não deslogar o administrador durante o cadastro.
- **Geração de PDF (garantias) e envio de e-mail**: dependiam do Apps Script (DocumentApp, MailApp). Nessa arquitetura nova, isso precisa de uma função de nuvem (Firebase Cloud Functions) ou de um serviço externo — ainda não migrado. Aviso já para não pegar de surpresa.
- **Backup**: o Firestore já tem durabilidade/redundância própria da Google Cloud. Se quiser um backup exportável, dá pra fazer via `gcloud firestore export` (linha de comando) ou construir uma tela que baixa um JSON de tudo — posso montar isso se quiser.
