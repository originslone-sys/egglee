<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\Database;
use App\Core\Env;
use App\Repository\GenerationQueue;
use App\Repository\SymbolRepository;
use App\Support\Dictionary;
use App\Support\Lang;

/**
 * Processa a fila de forma INCREMENTAL: cada passo gera apenas UM idioma.
 *
 * Isso mantém cada execução curta (1 chamada à IA), cabendo no tempo limite
 * do cron e do PHP. Um símbolo completo leva 3 passos (pt, es, en); o item
 * volta para "pending" entre os passos e só vira "done" quando os 3 existem.
 */
final class Generator
{
    public function __construct(private SymbolRepository $repo = new SymbolRepository()) {}

    /** Executa até $maxSteps passos (idiomas). Retorna [passos_ok, erros]. */
    public function processPending(int $maxSteps = 1): array
    {
        GenerationQueue::reclaimStale(); // recupera itens travados em "processing"
        $ok = 0;
        $err = 0;
        for ($i = 0; $i < $maxSteps; $i++) {
            $rows = GenerationQueue::pending(1);
            if (!$rows) {
                break;
            }
            $this->processStep($rows[0]) ? $ok++ : $err++;
        }
        return [$ok, $err];
    }

    /** Um passo = gerar o próximo idioma faltante de um item. */
    public function processStep(array $row): bool
    {
        $id = (int) $row['id'];
        $concept = $row['concept_id'];
        GenerationQueue::markProcessing($id);

        $model = Env::get('DEEPSEEK_MODEL', 'deepseek-reasoner');
        $related = Dictionary::siblings($concept, 3);

        // Próximo idioma ainda não gerado (na ordem pt, es, en).
        $done = $this->repo->langsFor($concept);
        $next = null;
        foreach (Lang::LANGS as $lang) {
            if (!in_array($lang, $done, true)) {
                $next = $lang;
                break;
            }
        }

        // Já completo? Finaliza.
        if ($next === null) {
            GenerationQueue::markDone($id);
            return true;
        }

        try {
            // Gera PRIMEIRO; só cria o símbolo se a IA respondeu (sem drafts vazios).
            $t0 = microtime(true);
            $content = DeepSeek::generate($concept, $row['category'], $row['en'], $next, $related);
            $elapsed = microtime(true) - $t0;
            if (PHP_SAPI === 'cli') {
                fwrite(STDOUT, sprintf("  %s [%s] gerado em %.1fs\n", $concept, $next, $elapsed));
            }
            $this->repo->ensureSymbol($concept, $row['category'], $related, $model);
            $this->repo->saveLanguage($concept, $next, $content);
            $this->log($concept, $next, $model, true, null);

            // Completou os 3 idiomas?
            if (count($this->repo->langsFor($concept)) >= count(Lang::LANGS)) {
                GenerationQueue::markDone($id);
            } else {
                GenerationQueue::markPending($id); // volta para gerar o próximo idioma
            }
            return true;
        } catch (\Throwable $e) {
            $this->log($concept, $next, $model, false, $e->getMessage());
            GenerationQueue::markError($id, $e->getMessage());
            return false;
        }
    }

    private function log(?string $symbolId, ?string $lang, ?string $model, bool $ok, ?string $error): void
    {
        try {
            Database::pdo()->prepare(
                'INSERT INTO generation_log (symbol_id, lang, model, ok, error) VALUES (?,?,?,?,?)'
            )->execute([$symbolId, $lang, $model, $ok ? 1 : 0, $error]);
        } catch (\Throwable) {
            // best-effort
        }
    }
}
