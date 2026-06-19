# egglee — Significado dos Sonhos (multilíngue)

Site estático multilíngue (pt-BR / es / en) de interpretação de sonhos.
Conteúdo estruturado como dados, gerado com IA (DeepSeek) **com revisão humana
obrigatória**, e renderizado em HTML estático com SEO técnico embutido.

## Por que esta arquitetura (e não um gerador de spam)

A versão "2.000 páginas/dia automáticas" cai na política de **scaled content
abuse** do Google (mar/2024) e queima conta de AdSense. Aqui a aposta é
**profundidade + autoridade com escala controlada**, que sobrevive aos updates:

- Cada símbolo é um **registro de dados** (`src/content/symbols/*.json`), não string concatenada.
- A IA **escreve nativo** em cada idioma (não traduz) — ver `scripts/prompts/`.
- **Qualidade gate:** todo conteúdo nasce `status: "draft"` e **não vai ao ar**
  até um humano revisar e marcar `reviewed`. Só `reviewed`/`published` viram página.
- SEO (title, meta, H1, FAQ, quick answer, Schema.org, hreflang) já sai do pipeline.

## Stack

- **Astro** (`output: static`) + `@astrojs/sitemap`, i18n nativo.
- Sem banco, sem servidor: HTML em CDN → rápido e barato.

## Setup

```bash
npm install
cp .env.example .env   # preencha DEEPSEEK_API_KEY
```

## Pipeline de conteúdo

```bash
# 1. Gerar (status: draft). Edite a lista em scripts/seed.mjs.
npm run generate                 # todos os seeds faltantes
npm run generate -- --only snake # apenas um
npm run generate -- --force      # regerar existentes

# 2. Validar campos/SEO básicos
npm run validate

# 3. REVISAR à mão o JSON em src/content/symbols/<id>.json
#    Corrija o que precisar e troque "status": "draft" -> "reviewed".

# 4. Build (só conteúdo reviewed/published entra)
npm run build
npm run preview
```

## Estrutura de URLs

```
/pt/sonhar-com-cobra
/es/sonar-con-serpiente
/en/dreaming-about-snakes
```

Cada símbolo é o mesmo registro nos 3 idiomas, com `hreflang` cruzando as versões.

## Estratégia de escala (importante)

1. Comece pelos **termos campeões** de volume (cobra, dente caindo, água, ex...).
2. Gere **poucos por dia**, revise cada um, publique aos poucos.
3. Conquiste indexação e confiança antes de expandir a cauda longa.
4. Monetização em estágios: AdSense → Ezoic (~10k sessões/mês) → Mediavine/Raptive (~50k/mês).

NÃO floode o índice. O crescimento lento e revisado é o que mantém o site vivo.

## Onde mexer

| Quero... | Arquivo |
|---|---|
| Adicionar símbolos a gerar | `scripts/seed.mjs` |
| Ajustar o prompt / voz por idioma | `scripts/prompts/locales.mjs`, `scripts/prompts/build.mjs` |
| Mudar o schema dos dados | `src/content/config.ts` |
| Layout / Schema.org da página | `src/pages/[lang]/[...slug].astro` |
| Estilos | `public/styles.css` |
