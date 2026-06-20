<?php
declare(strict_types=1);

namespace App\Service;

/**
 * Constrói as mensagens (system + user) para o DeepSeek gerar o conteúdo de
 * UM símbolo em UM idioma. Objetivos: qualidade real (E-E-A-T), unicidade
 * por idioma (escreve nativo, não traduz) e SEO embutido no próprio output.
 */
final class PromptBuilder
{
    /** Voz/cultura por idioma — o modelo "pensa" na língua-alvo. */
    public const LOCALES = [
        'pt' => [
            'name'     => 'Português (internacional)',
            'hreflang' => 'pt',
            'slugVerb' => 'sonhar-com',
            'persona'  => 'Você é um redator especialista em simbologia dos sonhos e psicologia analítica, com domínio de SEO. Escreve em português internacional, natural e fluido, compreensível por leitores de TODOS os países lusófonos (Brasil, Portugal, Angola, Moçambique e outros). Conhece a tradição popular e a leitura psicológica (Jung, arquétipos). Nunca soa robótico nem genérico, e nunca prende o texto a um único país.',
            'rules'    => [
                'Use português internacional e neutro: evite gírias e expressões exclusivas de um único país (nem só do Brasil, nem só de Portugal).',
                'Apresente crenças e simbologias populares de forma ABRANGENTE ("na cultura popular", "em muitas tradições"), sem amarrar a um país específico nem inventar fatos.',
                'Equilibre três vozes: tradição popular, psicologia (Jung/arquétipos) e bom senso emocional.',
                'Trate o leitor por "você". Tom empático, mas seguro e informativo.',
            ],
        ],
        'es' => [
            'name'     => 'Español (internacional)',
            'hreflang' => 'es',
            'slugVerb' => 'sonar-con',
            'persona'  => 'Eres un redactor experto en simbología de los sueños y psicología analítica, con dominio del SEO. Escribes en español neutro internacional, natural y cercano, comprensible por lectores de TODOS los países hispanohablantes (España y toda Latinoamérica). Conoces la tradición popular y la lectura psicológica (Jung, arquetipos). Nunca atas el texto a un solo país.',
            'rules'    => [
                'Usa español neutro internacional. Evita modismos exclusivos de un solo país.',
                'Presenta creencias y simbología populares de forma AMPLIA ("en la cultura popular", "en muchas tradiciones"), sin atarlas a un país concreto ni inventar datos.',
                'Equilibra tres voces: tradición popular, psicología (Jung/arquetipos) y sentido común emocional.',
                'Trata al lector de "tú". Tono empático pero seguro e informativo.',
            ],
        ],
        'en' => [
            'name'     => 'English (international)',
            'hreflang' => 'en',
            'slugVerb' => 'dreaming-about',
            'persona'  => 'You are an expert writer on dream symbolism and analytical psychology, with strong SEO skills. You write in clear, internationally neutral English, natural and reassuring, understood by readers across ALL English-speaking countries (US, UK, Canada, Australia, India and more). You know folk traditions and the psychological reading (Jung, archetypes). You never tie the text to a single country.',
            'rules'    => [
                'Use clear, internationally neutral English. Avoid slang exclusive to one country (neither strictly US nor UK).',
                'Present folk beliefs and symbolism BROADLY ("in popular belief", "in many traditions"), without tying them to a specific country or inventing facts.',
                'Balance three voices: folk tradition, psychology (Jung/archetypes), and emotional common sense.',
                'Address the reader as "you". Empathetic but confident and informative tone.',
            ],
        ],
    ];

    private const QUALITY_CONTRACT = <<<TXT
LANGUAGE PURITY (absolutely critical):
- Write EVERY single word strictly in the target language using ONLY its Latin alphabet.
- NEVER output Chinese, Japanese, Korean or any non-Latin characters. Not a single one.
- If you are tempted to use a foreign word, use the correct target-language word instead.

INTERNATIONAL REACH (critical):
- This page is read by speakers of the target language across MANY countries, not one.
- Do NOT anchor the content to a single country. NEVER write phrases like "in Brazil",
  "no Brasil", "in the US", "en España", or name a single nation as the reference.
- Frame folk and cultural beliefs as widespread ("in popular belief", "in many traditions",
  "na cultura popular", "en muchas culturas"). Use universal symbolism that applies everywhere.

WRITING QUALITY (non-negotiable — this is what keeps the site indexed and builds authority):
- Write GENUINELY USEFUL, specific content. Never pad with filler, never repeat the same idea reworded.
- Be CONCRETE and authoritative: name specific beliefs, regional sayings, concrete dream scenarios and
  what each detail implies. Avoid vague phrases like "primitive instincts" or "unconditional love" unless
  tied to a concrete, useful explanation. A reader must learn something they could not guess themselves.
- Each section must say something DIFFERENT and concrete. No two paragraphs may be interchangeable.
- Avoid generic openers like "Dreams have fascinated humanity for centuries". Start with substance.
- No hallucinated studies, fake statistics, or invented quotes. Cultural beliefs must be framed as beliefs.
- Vary sentence length and rhythm. Sound like a confident human expert, not a template.

SEO REQUIREMENTS (bake these into the fields, do not add them separately):
- title: includes the primary keyword near the front, 30-65 chars, no clickbait lies.
- metaDescription: 110-160 chars, includes the keyword, promises a clear answer, invites the click.
- h1: keyword-forward, natural, distinct from the title.
- quickAnswer: 120-360 chars, directly answers "what does it mean" in the first sentence.
- sections: exactly 4 H2 blocks covering DISTINCT angles: (1) folk/popular tradition, (2) psychological
  (Jung/archetypes), (3) emotional reading, (4) spiritual/religious reading drawing on widely shared
  traditions (e.g. Christianity and common folk/esoteric beliefs), framed GENERALLY and NOT tied to a
  single country. Each must teach something concrete.
- table: a scannable comparison table targeting long-tail searches. Pick the MOST relevant dimension for
  THIS symbol (e.g. for a snake: by color; for money: by amount/context; for falling: by where you fall).
  4-6 rows. Each row: a "label" (e.g. "Cobra preta") and a concise "meaning".
- variations: exactly 3 real long-tail sub-meanings; each "keyword" must be a phrase a person would actually type.
- faq: exactly 3 real questions, each answered in 2-3 sentences.
- semanticKeywords: 5 related terms for topical depth.
TXT;

    private const JSON_SCHEMA = <<<TXT
Return ONLY a valid JSON object (no markdown, no comments, no text before or after) with EXACTLY this shape:
{
  "slug": "URL slug in the target language, lowercase, hyphenated, ASCII-folded (no accents)",
  "title": "string 30-65 chars",
  "metaDescription": "string 110-160 chars",
  "h1": "string",
  "quickAnswer": "string 120-360 chars",
  "intro": "2-3 paragraphs (~200-300 chars each), separated by \\n",
  "sections": [ { "heading": "H2", "body": "~200-300 chars" } ],
  "table": { "title": "table heading", "rows": [ { "label": "string", "meaning": "string" } ] },
  "variations": [ { "keyword": "long-tail phrase", "meaning": "~120-180 chars" } ],
  "faq": [ { "question": "string", "answer": ">=90 chars" } ],
  "closing": ">=120 chars",
  "semanticKeywords": ["string","string","string","string","string"]
}
Use the target language for ALL human-readable text. Slugs must be ASCII (fold accents: ç->c, ñ->n, á->a).
TXT;

    /** @return array<int, array{role:string, content:string}> */
    public static function build(string $id, string $category, string $conceptEn, string $lang, array $related = []): array
    {
        $L = self::LOCALES[$lang] ?? null;
        if ($L === null) {
            throw new \InvalidArgumentException("Idioma não suportado: $lang");
        }

        $rules = '';
        foreach ($L['rules'] as $i => $r) {
            $rules .= ($i + 1) . ". $r\n";
        }

        $system = $L['persona'] . "\n\n" . $rules . "\n" . self::QUALITY_CONTRACT . "\n\n" . self::JSON_SCHEMA;

        $relatedHint = $related
            ? "\nRelated symbols (context only, do not link explicitly): " . implode(', ', $related) . '.'
            : '';

        $user = <<<TXT
Target language: {$L['name']} ({$L['hreflang']})
Dream symbol concept (English, for your understanding ONLY): "$conceptEn"  (internal id: $id, category: $category)

YOU decide the primary keyword: choose the most natural and most-searched way a
native {$L['name']} speaker would phrase a dream about this concept (e.g. how they
actually type it into Google). Do NOT translate the English literally — use the
real local expression. Build the slug from that phrase (pattern hint: "{$L['slugVerb']}-<term>").$relatedHint

Write an in-depth, authoritative page for someone who just searched the meaning of this
dream in {$L['name']}. Aim for roughly 800-1100 words of total human-readable content
across the fields — rich, specific and genuinely helpful, NO filler and NO invented
statistics or fake institutions. Make it unique to {$L['name']}, not a translation of
any other language. Every word must be valid {$L['name']} (Latin alphabet only — no
Chinese/foreign characters).

Output the JSON object now.
TXT;

        return [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $user],
        ];
    }
}
