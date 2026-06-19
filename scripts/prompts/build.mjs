import { LOCALES } from './locales.mjs';

/**
 * Constrói as mensagens (system + user) para o DeepSeek gerar o conteúdo de
 * UM símbolo em UM idioma.
 *
 * O prompt foi desenhado com três objetivos simultâneos:
 *   1. Qualidade real (E-E-A-T) — profundidade que sobrevive aos updates de spam.
 *   2. Unicidade — instruções explícitas anti-template e anti-repetição.
 *   3. SEO embutido — o próprio output já traz title, meta, headings, FAQ e
 *      quick answer otimizados. Nada é "colado" depois.
 */

// Regras universais de qualidade/SEO, independentes de idioma.
const QUALITY_CONTRACT = `
WRITING QUALITY (non-negotiable — this is what keeps the site indexed):
- Write GENUINELY USEFUL, specific content. Never pad with filler, never repeat the same idea reworded.
- Each section must say something DIFFERENT and concrete. No two paragraphs may be interchangeable.
- Avoid generic openers like "Dreams have fascinated humanity for centuries". Start with substance.
- No hallucinated "scientific studies", fake statistics, or invented quotes. Cultural beliefs must be framed as beliefs, not facts.
- Vary sentence length and rhythm. Sound human, not like a template.

SEO REQUIREMENTS (bake these into the fields, do not add them separately):
- title: compelling, includes the primary keyword near the front, 30-65 chars, no clickbait lies.
- metaDescription: 110-160 chars, includes the keyword, promises a clear answer, invites the click.
- h1: keyword-forward, natural, distinct from the title.
- quickAnswer: 120-360 chars, directly answers "what does it mean" in the first sentence (featured-snippet bait).
- sections: 4+ H2 blocks covering DISTINCT angles (popular tradition, psychological reading, emotional context, spiritual/cultural reading). Headings should naturally fold in long-tail variants.
- variations: 3+ real long-tail sub-meanings (e.g. big/dead/in water/attacking). Each "keyword" must be a phrase a person would actually type.
- faq: 3+ real questions people ask, each answered in 2-4 sentences. These become FAQ rich results.
- semanticKeywords: 5+ related entities/terms for topical depth (NOT exhibited raw to the user).
`;

// Esquema EXATO que o modelo deve devolver. Casa 1:1 com src/content/config.ts.
const JSON_SCHEMA = `
Return ONLY a valid JSON object (no markdown, no comments, no text before or after) with EXACTLY this shape:
{
  "slug": "string — URL slug in the target language, lowercase, hyphenated, ASCII-folded (no accents)",
  "title": "string 30-65 chars",
  "metaDescription": "string 110-160 chars",
  "h1": "string",
  "quickAnswer": "string 120-360 chars",
  "intro": "string, 2-3 rich paragraphs (>=280 chars)",
  "sections": [
    { "heading": "string H2", "body": "string >=220 chars, may contain multiple sentences" }
  ],
  "variations": [
    { "keyword": "long-tail phrase a user would type", "meaning": "string >=120 chars" }
  ],
  "faq": [
    { "question": "string", "answer": "string >=80 chars" }
  ],
  "closing": "string >=120 chars",
  "semanticKeywords": ["string", "string", "string", "string", "string"]
}
Use the target language for ALL human-readable text. Slugs must be ASCII (fold accents: ç->c, ñ->n, á->a).`;

export function buildMessages({ id, category, term, related = [] }, lang) {
  const L = LOCALES[lang];
  if (!L) throw new Error(`Idioma não suportado: ${lang}`);

  const system = [
    L.persona,
    '',
    L.rules.map((r, i) => `${i + 1}. ${r}`).join('\n'),
    '',
    QUALITY_CONTRACT,
    '',
    JSON_SCHEMA,
  ].join('\n');

  const relatedHint = related.length
    ? `\nRelated symbols (for context only, do not link explicitly): ${related.join(', ')}.`
    : '';

  const user = `
Target language: ${L.name} (${L.hreflang})
Dream symbol to write about: "${term}"  (internal id: ${id}, category: ${category})
URL pattern hint for the slug: "${L.slugVerb}-${'<' + 'term' + '>'}" — adapt naturally to grammar.${relatedHint}

Write the complete, in-depth page for someone who just searched the meaning of dreaming about "${term}" in ${L.name}.
Aim for roughly 700-1100 words of total human-readable content spread across the fields.
Make it the single best, most useful page on the internet for this query — and unique to ${L.name}, not a translation of any other language.

Output the JSON object now.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
