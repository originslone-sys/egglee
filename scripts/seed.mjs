/**
 * Sementes: a lista de símbolos a gerar.
 *
 * ESTRATÉGIA DE ESCALA (importante): comece pelos termos campeões de volume,
 * gere poucos por dia e revise cada um. NÃO floode 2.000 páginas/dia — isso é
 * o gatilho do "scaled content abuse" do Google. Cresça com confiança ganha.
 *
 * `term` é o termo nativo em cada idioma (a IA escreve sobre ele).
 * `id` é a chave neutra (inglês) usada para cruzar idiomas e relacionar páginas.
 */
export const SEED = [
  {
    id: 'snake',
    category: 'animals',
    related: ['spider', 'rat', 'dog'],
    terms: { pt: 'cobra', es: 'serpiente', en: 'snakes' },
  },
  {
    id: 'tooth-falling',
    category: 'body',
    related: ['hair', 'blood', 'mirror'],
    terms: { pt: 'dente caindo', es: 'que se caen los dientes', en: 'teeth falling out' },
  },
  {
    id: 'water',
    category: 'nature',
    related: ['sea', 'flood', 'rain'],
    terms: { pt: 'água', es: 'agua', en: 'water' },
  },
  {
    id: 'ex-partner',
    category: 'people',
    related: ['wedding', 'kiss', 'pregnancy'],
    terms: { pt: 'ex-namorado(a)', es: 'tu ex', en: 'your ex' },
  },
  {
    id: 'falling',
    category: 'actions',
    related: ['flying', 'running', 'stairs'],
    terms: { pt: 'cair', es: 'caer', en: 'falling' },
  },
];
