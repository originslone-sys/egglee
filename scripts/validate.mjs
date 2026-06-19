/**
 * Validação rápida dos dados gerados (rode antes de revisar/publicar).
 * Confere campos mínimos e sinaliza possíveis sinais de baixa qualidade —
 * mas NÃO substitui a leitura humana. Saída: contagem por status.
 */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, '..', 'src', 'data', 'symbols');
const LANGS = ['pt', 'es', 'en'];

let problems = 0;
const status = { draft: 0, reviewed: 0, published: 0 };

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const data = JSON.parse(await readFile(join(DIR, file), 'utf8'));
  status[data.status] = (status[data.status] || 0) + 1;

  for (const lang of LANGS) {
    const c = data.languages?.[lang];
    const where = `${file} [${lang}]`;
    if (!c) {
      console.error(`✗ ${where}: idioma ausente`);
      problems++;
      continue;
    }
    if (c.title && (c.title.length < 30 || c.title.length > 65))
      console.warn(`! ${where}: title fora de 30-65 chars (${c.title.length})`);
    if (c.metaDescription && (c.metaDescription.length < 110 || c.metaDescription.length > 160))
      console.warn(`! ${where}: metaDescription fora de 110-160 (${c.metaDescription.length})`);
    if ((c.sections?.length ?? 0) < 4)
      console.warn(`! ${where}: menos de 4 seções`);
    // Heurística anti-duplicação: headings repetidos entre idiomas idênticos.
    if (/[áàâãéêíóôõúç]/i.test(c.slug || ''))
      console.warn(`! ${where}: slug com acentos (deveria ser ASCII)`);
  }
}

console.log('\nStatus:', status);
if (problems) {
  console.error(`\n${problems} problema(s) bloqueante(s).`);
  process.exit(1);
}
console.log('Validação OK (avisos não bloqueiam).');
