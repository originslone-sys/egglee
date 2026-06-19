<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\Database;
use App\Core\Env;
use App\Repository\GenerationQueue;
use App\Repository\SymbolRepository;
use App\Support\Dictionary;
use App\Support\Lang;

/** Processa itens da fila: gera os 3 idiomas e salva como rascunho. */
final class Generator
{
    public function __construct(private SymbolRepository $repo = new SymbolRepository()) {}

    /** Processa até $max itens pendentes. Retorna [done, error]. */
    public function processPending(int $max = 5): array
    {
        $done = 0;
        $error = 0;
        foreach (GenerationQueue::pending($max) as $row) {
            $this->processRow($row) ? $done++ : $error++;
        }
        return [$done, $error];
    }

    /** Processa uma linha da fila. true = sucesso. */
    public function processRow(array $row): bool
    {
        $id = (int) $row['id'];
        GenerationQueue::markProcessing($id);
        $model = Env::get('DEEPSEEK_MODEL', 'deepseek-reasoner');
        $related = Dictionary::siblings($row['concept_id'], 3);

        try {
            $languages = [];
            foreach (Lang::LANGS as $lang) {
                $languages[$lang] = DeepSeek::generate(
                    $row['concept_id'], $row['category'], $row['en'], $lang, $related
                );
                $this->log($row['concept_id'], $lang, $model, true, null);
            }
            $this->repo->save($row['concept_id'], $row['category'], $related, $languages, $model);
            GenerationQueue::markDone($id);
            return true;
        } catch (\Throwable $e) {
            $this->log($row['concept_id'], null, $model, false, $e->getMessage());
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
