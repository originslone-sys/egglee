<?php
declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;

/**
 * Registra falhas de geração automática para que conceitos problemáticos sejam
 * pulados após algumas tentativas (sem travar a fila). O que já foi gerado é
 * detectado pela própria tabela `symbols`; aqui só rastreamos erros.
 */
final class AutoStatus
{
    public static function ensureTable(): void
    {
        Database::pdo()->exec(
            'CREATE TABLE IF NOT EXISTS auto_status (
                concept_id VARCHAR(64) NOT NULL,
                status ENUM("error") NOT NULL DEFAULT "error",
                attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
                error TEXT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (concept_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    /** Conceitos a pular: erro persistente (attempts >= max). */
    public static function skipIds(int $maxAttempts): array
    {
        self::ensureTable();
        $stmt = Database::pdo()->prepare(
            'SELECT concept_id FROM auto_status WHERE attempts >= ?'
        );
        $stmt->execute([$maxAttempts]);
        return array_map(fn($r) => $r['concept_id'], $stmt->fetchAll());
    }

    /** Registra uma falha (incrementa tentativas). */
    public static function recordError(string $conceptId, string $error): void
    {
        self::ensureTable();
        Database::pdo()->prepare(
            'INSERT INTO auto_status (concept_id, status, attempts, error)
             VALUES (?, "error", 1, ?)
             ON DUPLICATE KEY UPDATE attempts = attempts + 1, error = VALUES(error)'
        )->execute([$conceptId, mb_substr($error, 0, 1000)]);
    }

    /** Limpa o registro de erro (ao gerar com sucesso, ou ao "tentar de novo"). */
    public static function clear(string $conceptId): void
    {
        self::ensureTable();
        Database::pdo()->prepare('DELETE FROM auto_status WHERE concept_id = ?')->execute([$conceptId]);
    }

    /** Zera todas as falhas (botão "tentar novamente as que falharam"). */
    public static function clearAll(): void
    {
        self::ensureTable();
        Database::pdo()->exec('DELETE FROM auto_status');
    }

    public static function failures(int $limit = 20): array
    {
        self::ensureTable();
        $stmt = Database::pdo()->prepare(
            'SELECT concept_id, attempts, error FROM auto_status ORDER BY updated_at DESC LIMIT ' . max(1, $limit)
        );
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public static function countPermanent(int $maxAttempts): int
    {
        self::ensureTable();
        $stmt = Database::pdo()->prepare('SELECT COUNT(*) FROM auto_status WHERE attempts >= ?');
        $stmt->execute([$maxAttempts]);
        return (int) $stmt->fetchColumn();
    }
}
