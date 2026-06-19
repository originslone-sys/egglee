/**
 * Gerador de conteúdo via DeepSeek (modelo de raciocínio).
 *
 * Uso:
 *   DEEPSEEK_API_KEY=xxx npm run generate            # gera todos os seeds faltantes
 *   DEEPSEEK_API_KEY=xxx npm run generate -- --only snake   # só um id
 *   DEEPSEEK_API_KEY=xxx npm run generate -- --force        # regera mesmo se já existe
 *
 * O conteúdo nasce com status "draft". NADA vai para a build automaticamente:
 * um humano precisa revisar e marcar "reviewed" (ver README — qualidade gate).
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SEED } from './seed.mjs';
import { buildMessages } from './prompts/build.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'src', 'content', 'symbols');
const LANGS = ['pt', 'es', 'en'];

const API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
const API_KEY = process.env.DEEPSEEK_API_KEY;
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-reasoner';

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx !== -1 ? args[onlyIdx + 1] : null;
const FORCE = args.includes('--force');

function log(...a) {
  console.log('[generate]', ...a);
}

/** Extrai JSON mesmo que o modelo embrulhe em ```json ... ``` ou texto. */
function parseJson(raw) {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Sem objeto JSON na resposta');
  return JSON.parse(s.slice(start, end + 1));
}

async function callDeepSeek(messages, { retries = 3 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          // deepseek-reasoner ignora temperature; mantido para deepseek-chat.
          temperature: 0.9,
          max_tokens: 8000,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      if (!msg?.content) throw new Error('Resposta sem content');
      return parseJson(msg.content);
    } catch (err) {
      log(`tentativa ${attempt}/${retries} falhou: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
}

async function generateSymbol(seed) {
  const outPath = join(OUT_DIR, `${seed.id}.json`);
  if (existsSync(outPath) && !FORCE) {
    log(`pulando ${seed.id} (já existe — use --force para regerar)`);
    return;
  }

  const languages = {};
  for (const lang of LANGS) {
    log(`gerando ${seed.id} [${lang}]...`);
    const messages = buildMessages(
      { id: seed.id, category: seed.category, term: seed.terms[lang], related: seed.related },
      lang,
    );
    languages[lang] = await callDeepSeek(messages);
  }

  const record = {
    id: seed.id,
    category: seed.category,
    related: seed.related,
    status: 'draft', // <- revisão humana obrigatória antes de publicar
    generatedAt: new Date().toISOString(),
    model: MODEL,
    languages,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(outPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
  log(`✓ salvo ${seed.id}.json (status: draft — revise antes de publicar)`);
}

async function main() {
  if (!API_KEY) {
    console.error('Erro: defina DEEPSEEK_API_KEY no ambiente (veja .env.example).');
    process.exit(1);
  }
  const targets = ONLY ? SEED.filter((s) => s.id === ONLY) : SEED;
  if (!targets.length) {
    console.error(`Nenhum seed com id "${ONLY}".`);
    process.exit(1);
  }
  log(`modelo: ${MODEL} | alvos: ${targets.map((t) => t.id).join(', ')}`);
  for (const seed of targets) {
    try {
      await generateSymbol(seed);
    } catch (err) {
      log(`✗ erro em ${seed.id}: ${err.message}`);
    }
  }
  log('concluído.');
}

main();
