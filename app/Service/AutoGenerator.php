<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\Database;
use App\Core\Env;
use App\Core\Migrate;
use App\Repository\AutoStatus;
use App\Repository\SymbolRepository;
use App\Support\Dictionary;
use App\Support\Lang;
use App\Support\Variations;

/**
 * Piloto automático: percorre o dicionário em ordem, pula o que já foi gerado
 * (tabela symbols) e o que falhou demais (auto_status), gera o próximo conceito
 * nos 3 idiomas e, se der erro, ignora e passa para o próximo.
 */
final class AutoGenerator
{
    public const MAX_ATTEMPTS = 3;

    /** @var array<int, array{concept:string, lang:string, ok:bool, error:?string, elapsed:float}> */
    private array $log = [];

    public function __construct(private SymbolRepository $repo = new SymbolRepository()) {}

    public function lastLog(): array
    {
        return $this->log;
    }

    /**
     * Gera até $maxArticles artigos com sucesso por execução, pulando falhas.
     * @return array{ok:int, failed:int, remaining:int, generated:int, total:int}
     */
    /** Lista completa de conceitos: base (parent=null) + variações (com parent). */
    public static function concepts(): array
    {
        $base = array_map(
            fn($i) => $i + ['parent' => null],
            Dictionary::all()
        );
        return array_merge($base, Variations::all());
    }

    public function tick(int $maxArticles = 1): array
    {
        $this->log = [];
        Migrate::ensure(); // garante parent_id e demais colunas
        $done  = array_flip($this->repo->generatedIds());
        $skip  = array_flip(AutoStatus::skipIds(self::MAX_ATTEMPTS));
        $tried = [];

        $ok = 0;
        $failed = 0;
        $cap = $maxArticles + 3; // evita loop longo: no máx. algumas tentativas por execução

        while ($ok < $maxArticles && ($ok + $failed) < $cap) {
            $concept = $this->next($done, $skip, $tried);
            if ($concept === null) {
                break; // nada mais a gerar
            }
            $tried[$concept['id']] = true;

            if ($this->generateOne($concept)) {
                AutoStatus::clear($concept['id']);
                $done[$concept['id']] = true;
                $ok++;
            } else {
                AutoStatus::recordError($concept['id'], 'Falha ao gerar (todos os idiomas).');
                $failed++;
            }
        }

        $result = array_merge(['ok' => $ok, 'failedRun' => $failed], $this->progress());

        // Heartbeat: registra a última execução (o painel mostra; revela se o cron roda).
        try {
            $hb = $result + ['time' => date('c'), 'sapi' => PHP_SAPI];
            @file_put_contents(dirname(__DIR__, 2) . '/database/last-run.json', json_encode($hb));
        } catch (\Throwable) {
        }

        return $result;
    }

    /** Próximo conceito (base ou variação) ainda não gerado nem pulado. */
    private function next(array $done, array $skip, array $tried): ?array
    {
        foreach (self::concepts() as $item) {
            $id = $item['id'];
            if (isset($done[$id]) || isset($skip[$id]) || isset($tried[$id])) {
                continue;
            }
            return $item;
        }
        return null;
    }

    /** Gera um conceito nos 3 idiomas (best-effort por idioma). true = pelo menos 1 ok. */
    public function generateOne(array $item): bool
    {
        $model = Env::get('DEEPSEEK_MODEL', 'deepseek-v4-flash');
        $parent = $item['parent'] ?? null;
        // Variação: relaciona à mãe + alguns irmãos da categoria da mãe.
        $related = $parent
            ? array_merge([$parent], Dictionary::siblings($parent, 2))
            : Dictionary::siblings($item['id'], 3);
        $success = 0;

        foreach (Lang::LANGS as $lang) {
            $t0 = microtime(true);
            try {
                $content = DeepSeek::generate($item['id'], $item['category'], $item['en'], $lang, $related);
                Database::reconnect(); // conexão pode ter caído durante a IA
                $this->repo->ensureSymbol($item['id'], $item['category'], $related, $model, $parent);
                $this->repo->saveLanguage($item['id'], $lang, $content);
                $success++;
                $this->log[] = ['concept' => $item['id'], 'lang' => $lang, 'ok' => true, 'error' => null, 'elapsed' => microtime(true) - $t0];
                if (PHP_SAPI === 'cli') {
                    fwrite(STDOUT, "  ok {$item['id']} [$lang]\n");
                }
            } catch (\Throwable $e) {
                $this->log[] = ['concept' => $item['id'], 'lang' => $lang, 'ok' => false, 'error' => $e->getMessage(), 'elapsed' => microtime(true) - $t0];
                if (PHP_SAPI === 'cli') {
                    fwrite(STDOUT, "  erro {$item['id']} [$lang]: {$e->getMessage()}\n");
                }
            }
        }

        if ($success === 0) {
            return false;
        }

        // Auto-publicar (ou deixar como rascunho para revisão).
        if (Env::get('AUTO_PUBLISH', '1') !== '0') {
            $this->repo->setStatus($item['id'], 'published');
        }

        // Imagem (best-effort) se ainda não tiver.
        try {
            if (Pexels::enabled() && !$this->repo->imageUrl($item['id'])) {
                $img = Pexels::search($item['en']) ?? Pexels::search($item['category']);
                if ($img) {
                    $this->repo->setImage($item['id'], $img);
                }
            }
        } catch (\Throwable) {
        }

        return true;
    }

    /** Números para o painel. */
    public function progress(): array
    {
        $total = count(self::concepts());
        $generated = count($this->repo->generatedIds());
        $failedPerma = AutoStatus::countPermanent(self::MAX_ATTEMPTS);
        return [
            'total'     => $total,
            'generated' => $generated,
            'failed'    => $failedPerma,
            'remaining' => max(0, $total - $generated - $failedPerma),
        ];
    }
}
