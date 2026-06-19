# egglee — Significado dos Sonhos (PHP + MySQL, multilíngue)

Site multilíngue (pt-BR / es / en) de interpretação de sonhos, com **painel
admin** e geração de conteúdo via **DeepSeek**, rodando em **PHP + MySQL**
(nativo na Hostinger). Conteúdo gerado por IA **com revisão humana
obrigatória** antes de publicar.

## Por que esta arquitetura (e não um gerador de spam)

A versão "2.000 páginas/dia automáticas" cai na política de **scaled content
abuse** do Google (mar/2024) e queima conta de AdSense. Aqui a aposta é
**profundidade + autoridade com escala controlada**:

- Conteúdo é **dado estruturado** no MySQL, não string concatenada.
- A IA **escreve nativo** em cada idioma (não traduz) — ver `app/Service/PromptBuilder.php`.
- **Qualidade gate:** todo conteúdo nasce `draft` e **só vai ao ar** quando um
  humano revisa e muda o status para `reviewed`/`published`.
- SEO server-side: title, meta, H1, FAQ, Schema.org (Article + FAQPage +
  Breadcrumb), hreflang e sitemap saem prontos.

## Stack

- **PHP 8.x** (sem framework, sem Composer) + **MySQL/MariaDB** (PDO, utf8mb4).
- Front controller único (`public/index.php`) + `.htaccess` (Apache/Hostinger).
- Geração de conteúdo via cURL para a API DeepSeek (roda no servidor).

## Estrutura

```
app/
  Core/        Env, Database (PDO), View, Auth
  Support/     Lang (strings UI + vozes de prompt por idioma)
  Repository/  SymbolRepository (leitura/escrita)
  Service/     DeepSeek, PromptBuilder, Slug
  Controller/  PublicController, AdminController
views/
  public/      layout, home, article, 404, partials
  admin/       layout, login, dashboard, edit
index.php      <- FRONT CONTROLLER (raiz do repo = public_html)
.htaccess      roteamento + proteção das pastas internas
install.php    instalador (rodar uma vez após o 1º deploy)
styles.css, admin.css, logo.svg, favicon.svg, site.webmanifest
database/      schema.sql, setup.sh, seed/, create-admin.md
scripts/       import_seed.php, create_admin.php
```

> **A raiz do repositório é o document root.** As pastas `app/`, `views/`,
> `database/` e `scripts/` ficam no web root mas são bloqueadas por `.htaccess`
> (cada uma tem um `Require all denied`, além das regras na `.htaccess` da raiz).

## Instalação local / dev

```bash
php -S 127.0.0.1:8000 index.php
# abra http://127.0.0.1:8000 — será redirecionado ao instalador uma vez
```

## Deploy na Hostinger (Git automático)

O `main` está ligado ao deploy automático da Hostinger: **a cada merge, os
arquivos do repositório vão para `public_html`**. Como o deploy só copia
arquivos (não roda SQL), a configuração inicial é feita **uma vez** pelo
instalador:

1. Faça o merge → a Hostinger publica os arquivos.
2. Acesse **`https://seu-dominio.com/install.php`**. Preencha os dados do MySQL
   (banco/usuário já existem no hPanel) e crie seu login do painel.
   O instalador: testa a conexão, grava o `.env`, cria as tabelas, importa o
   exemplo e cria o admin.
3. **Apague `install.php`** do servidor (ou deixe — o lock
   `database/.installed` impede reexecução).

A partir daí, **todo novo merge só atualiza o código**. O `.env` e o banco
permanecem intactos (são estado do servidor, fora do Git).

> Mudou o schema no futuro? Aí sim é preciso aplicar a alteração no banco
> (phpMyAdmin ou uma migração) — isso não acontece no merge.

## Fluxo de conteúdo (painel admin)

Produção orientada por **dicionário + fila** (eficiente e sem timeout):

1. **Dicionário** (`/admin/dictionary`): ~200 conceitos por categoria. Filtre por
   categoria/busca, marque os que quer e **Enfileirar selecionados**. Você não
   digita termos — a **IA decide** a melhor expressão de busca em cada idioma.
2. **Worker processa a fila** (em segundo plano): gera os 3 idiomas e salva como
   `draft`. Configure um **cron** (recomendado) ou use **Processar 1 agora** no
   painel para hosts sem cron.
3. **Editar**: revise/ajuste cada idioma (textos e campos JSON de seções/FAQ).
4. **Publicar**: mude o status para `published`. Só então a página entra no ar.

### Cron do worker (Hostinger → hPanel → Cron Jobs)

```
*/5 * * * * php /home/USER/domains/SEU_DOMINIO/public_html/scripts/worker.php 1
```

Roda a cada 5 min e processa 1 item por vez (cada item = 3 idiomas no
`deepseek-reasoner`, ~1–2 min). Ajuste a frequência/quantidade conforme o ritmo.

> Adicionar mais conceitos ao dicionário: edite `app/Support/Dictionary.php`.

## Segurança

- `.env` fora do versionamento e do web root; `.htaccess` bloqueia acesso direto.
- Admin com sessão, CSRF nos formulários e senha em hash (bcrypt).
- Páginas do admin com `noindex`.
- Recomendado: trocar a senha do MySQL no hPanel caso já tenha trafegado por
  canais não seguros.
