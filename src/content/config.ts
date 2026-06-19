import { defineCollection, z } from 'astro:content';

/**
 * Contrato de dados de um símbolo de sonho.
 *
 * Este é o "molde" que a IA precisa preencher por idioma. Tudo que o
 * DeepSeek retorna é validado contra este schema antes de virar página —
 * se faltar campo ou vier curto demais, a build falha (qualidade gate).
 */

// Bloco de conteúdo gerado para UM idioma.
const localizedContent = z.object({
  // ---- SEO core ----
  slug: z.string(), // ex: "sonhar-com-cobra" | "sonar-con-serpiente" | "dreaming-about-snakes"
  title: z.string().min(30).max(65), // <title> alvo de SERP
  metaDescription: z.string().min(110).max(160),
  h1: z.string().min(10),

  // Resposta curta e objetiva — alvo de featured snippet / "posição zero".
  quickAnswer: z.string().min(120).max(360),

  // Parágrafo de abertura (lead) que prende o leitor e contextualiza.
  intro: z.string().min(280),

  // ---- Corpo aprofundado (E-E-A-T) ----
  // Cada seção é um ângulo real, não sinônimo reembaralhado.
  sections: z
    .array(
      z.object({
        heading: z.string().min(8), // H2 com variação de cauda longa
        body: z.string().min(220),
      }),
    )
    .min(4), // contexto popular, psicológico, cultural, variações...

  // Variações de cauda longa cobertas DENTRO da página (cobra grande, morta...).
  variations: z
    .array(
      z.object({
        keyword: z.string(), // ex: "sonhar com cobra grande"
        meaning: z.string().min(120),
      }),
    )
    .min(3),

  // FAQ → vira FAQPage Schema.org (rich result no Google).
  faq: z
    .array(
      z.object({
        question: z.string().min(8),
        answer: z.string().min(80),
      }),
    )
    .min(3),

  // Frase de fechamento / reflexão (evita o efeito "texto que termina seco").
  closing: z.string().min(120),

  // Termos para reforço semântico interno (não exibidos cruamente).
  semanticKeywords: z.array(z.string()).min(5),
});

const symbols = defineCollection({
  type: 'data',
  schema: z.object({
    // Identidade neutra (en) usada para cruzar idiomas e relações.
    id: z.string(), // ex: "snake"
    category: z.enum([
      'animals',
      'people',
      'actions',
      'objects',
      'places',
      'feelings',
      'events',
      'body',
      'nature',
      'spiritual',
    ]),
    // IDs de símbolos relacionados → links internos contextuais.
    related: z.array(z.string()).default([]),

    // Status editorial: 'draft' = gerado pela IA, ainda não revisado.
    // SÓ entra na build quem está 'reviewed'. Este é o anti-spam gate.
    status: z.enum(['draft', 'reviewed', 'published']).default('draft'),

    // Metadados de geração (auditoria).
    generatedAt: z.string().optional(),
    model: z.string().optional(),

    // Conteúdo por idioma.
    languages: z.object({
      pt: localizedContent,
      es: localizedContent,
      en: localizedContent,
    }),
  }),
});

export const collections = { symbols };
