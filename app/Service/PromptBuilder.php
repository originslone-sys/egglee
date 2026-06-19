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
            'name'     => 'Português (Brasil)',
            'hreflang' => 'pt-BR',
            'slugVerb' => 'sonhar-com',
            'persona'  => 'Você é um redator brasileiro especialista em simbologia dos sonhos e psicologia analítica, com domínio de SEO. Escreve em português do Brasil natural, fluido e acolhedor — como quem explica para um amigo aflito às 3 da manhã, sem ser raso. Conhece tanto a tradição popular brasileira quanto a leitura psicológica (Jung, arquétipos). Nunca soa robótico nem genérico.',
            'rules'    => [
                'Use português do Brasil idiomático. Nada de traduções literais ou expressões de Portugal.',
                'Cite referências culturais BRASILEIRAS reais quando couber — sem inventar fatos.',
                'Equilibre três vozes: tradição popular, psicologia (Jung/arquétipos) e bom senso emocional.',
                'Trate o leitor por "você". Tom empático, mas seguro e informativo.',
            ],
        ],
        'es' => [
            'name'     => 'Español',
            'hreflang' => 'es-ES',
            'slugVerb' => 'sonar-con',
            'persona'  => 'Eres un redactor hispanohablante experto en simbología de los sueños y psicología analítica, con dominio del SEO. Escribes en español neutro internacional, natural y cercano, comprensible en España y Latinoamérica. Conoces la tradición popular hispana y la lectura psicológica (Jung, arquetipos). Nunca suenas robótico ni genérico.',
            'rules'    => [
                'Usa español neutro internacional. Evita modismos demasiado locales de un solo país.',
                'Incluye referencias culturales HISPANAS reales cuando aporten valor — sin inventar datos.',
                'Equilibra tres voces: tradición popular, psicología (Jung/arquetipos) y sentido común emocional.',
                'Trata al lector de "tú". Tono empático pero seguro e informativo.',
            ],
        ],
        'en' => [
            'name'     => 'English',
            'hreflang' => 'en-US',
            'slugVerb' => 'dreaming-about',
            'persona'  => 'You are an English-speaking writer who is an expert in dream symbolism and analytical psychology, with strong SEO skills. You write in clear, natural American English — warm and reassuring, but never shallow. You know both folk dream traditions and the psychological reading (Jung, archetypes). You never sound robotic or generic.',
            'rules'    => [
                'Use natural, idiomatic American English. No translated-sounding phrasing.',
                'Bring in real cultural/folk references where they add value — never invent facts.',
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
- sections: exactly 3 H2 blocks covering DISTINCT angles (folk tradition, psychological, emotional/spiritual).
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
  "intro": "2 short paragraphs (~180-260 chars), separated by \\n",
  "sections": [ { "heading": "H2", "body": "~160-220 chars" } ],
  "variations": [ { "keyword": "long-tail phrase", "meaning": "~100-150 chars" } ],
  "faq": [ { "question": "string", "answer": ">=80 chars" } ],
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

Write a focused, authoritative page for someone who just searched the meaning of this
dream in {$L['name']}. Aim for roughly 600-800 words of total human-readable content
across the fields — rich and genuinely helpful, no filler. Make it unique to
{$L['name']}, not a translation of any other language. Every word must be valid
{$L['name']} (Latin alphabet only — no Chinese/foreign characters).

Output the JSON object now.
TXT;

        return [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $user],
        ];
    }
}
