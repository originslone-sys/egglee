<?php
declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;

/**
 * Fila de geração. O admin enfileira conceitos do dicionário; o worker
 * (cron) processa em segundo plano — sem travar a requisição web.
 *
 * A tabela é auto-criada (CREATE TABLE IF NOT EXISTS), então funciona mesmo
 * num banco já instalado, sem migração manual.
 */
final class GenerationQueue
{
    public static function ensureTable(): void
    {
        Database::pdo()->exec(
            'CREATE TABLE IF NOT EXISTS generation_queue (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                concept_id VARCHAR(64) NOT NULL,
                category VARCHAR(32) NOT NULL,
                en VARCHAR(255) NOT NULL,
                status ENUM("pending","processing","done","error") NOT NULL DEFAULT "pending",
                attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
                error TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY idx_status (status),
                KEY idx_concept (concept_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    /** Enfileira um conceito se ele não estiver pendente/processando. */
    public static function enqueue(string $conceptId, string $category, string $en): bool
    {
        self::ensureTable();
        $stmt = Database::pdo()->prepare(
            'SELECT COUNT(*) FROM generation_queue WHERE concept_id = ? AND status IN ("pending","processing")'
        );
        $stmt->execute([$conceptId]);
        if ((int) $stmt->fetchColumn() > 0) {
            return false; // já na fila
        }
        Database::pdo()->prepare(
            'INSERT INTO generation_queue (concept_id, category, en) VALUES (?,?,?)'
        )->execute([$conceptId, $category, $en]);
        return true;
    }

    /** Próximos itens pendentes (FIFO). */
    public static function pending(int $limit = 1): array
    {
        self::ensureTable();
        $stmt = Database::pdo()->prepare(
            'SELECT * FROM generation_queue WHERE status = "pending" ORDER BY id ASC LIMIT ' . max(1, $limit)
        );
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function markProcessing(int $id): void
    {
        Database::pdo()->prepare(
            'UPDATE generation_queue SET status="processing", attempts=attempts+1 WHERE id=?'
        )->execute([$id]);
    }

    public static function markDone(int $id): void
    {
        Database::pdo()->prepare('UPDATE generation_queue SET status="done", error=NULL WHERE id=?')->execute([$id]);
    }

    public static function markError(int $id, string $msg): void
    {
        Database::pdo()->prepare('UPDATE generation_queue SET status="error", error=? WHERE id=?')
            ->execute([mb_substr($msg, 0, 1000), $id]);
    }

    /** Contagem por status (para o painel). */
    public static function counts(): array
    {
        self::ensureTable();
        $rows = Database::pdo()->query(
            'SELECT status, COUNT(*) c FROM generation_queue GROUP BY status'
        )->fetchAll();
        $out = ['pending' => 0, 'processing' => 0, 'done' => 0, 'error' => 0];
        foreach ($rows as $r) {
            $out[$r['status']] = (int) $r['c'];
        }
        return $out;
    }

    /** Status atual por conceito (para colorir o dicionário). */
    public static function statusByConcept(): array
    {
        self::ensureTable();
        $rows = Database::pdo()->query(
            'SELECT concept_id, status FROM generation_queue WHERE status IN ("pending","processing","error")'
        )->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $out[$r['concept_id']] = $r['status'];
        }
        return $out;
    }

    /** Erros recentes para diagnóstico. */
    public static function recentErrors(int $limit = 10): array
    {
        self::ensureTable();
        $stmt = Database::pdo()->prepare(
            'SELECT concept_id, error, updated_at FROM generation_queue WHERE status="error" ORDER BY updated_at DESC LIMIT ' . max(1, $limit)
        );
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
