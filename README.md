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
public/        index.php (.htaccess), styles.css, admin.css, logo.svg, favicon.svg  <- DOCUMENT ROOT
database/      schema.sql, setup.sh, seed/, create-admin.md
scripts/       import_seed.php, create_admin.php
```

## Instalação local / dev

```bash
cp .env.example .env          # preencha DB_* e DEEPSEEK_API_KEY
bash database/setup.sh        # cria as tabelas
php scripts/import_seed.php   # carrega o exemplo (cobra/serpiente/snake)
php scripts/create_admin.php admin "uma-senha-forte"
php -S 127.0.0.1:8000 -t public public/index.php
# site:  http://127.0.0.1:8000/pt
# admin: http://127.0.0.1:8000/admin
```

## Deploy na Hostinger

1. **hPanel → Bancos de dados MySQL:** o banco e o usuário já existem
   (`u740938289_egg` / `u740938289_egg_user`).
2. Suba os arquivos. Defina o **document root** para a pasta `public/`
   (ou, se o root for fixo em `public_html`, mova o conteúdo de `public/`
   para lá e ajuste o `require` para apontar a `app/` fora da web).
3. Crie um `.env` no servidor (fora do `public/`) com as credenciais MySQL e a
   `DEEPSEEK_API_KEY`. **Nunca** versione o `.env`.
4. Importe `database/schema.sql` pelo **phpMyAdmin** (ou `bash database/setup.sh` via SSH).
5. Crie o usuário admin: `php scripts/create_admin.php seu_user senha_forte`
   (ou siga `database/create-admin.md` no phpMyAdmin).

## Fluxo de conteúdo (painel admin)

1. `/admin` → **+ Novo símbolo**: informe id, categoria, relacionados e os
   termos nos 3 idiomas → **Gerar rascunho**. A IA gera os 3 idiomas (status `draft`).
2. **Editar**: revise/ajuste cada idioma (textos e campos JSON de seções/FAQ).
3. **Publicar**: mude o status para `published`. Só então a página entra no ar
   e no sitemap.

## Segurança

- `.env` fora do versionamento e do web root; `.htaccess` bloqueia acesso direto.
- Admin com sessão, CSRF nos formulários e senha em hash (bcrypt).
- Páginas do admin com `noindex`.
- Recomendado: trocar a senha do MySQL no hPanel caso já tenha trafegado por
  canais não seguros.
