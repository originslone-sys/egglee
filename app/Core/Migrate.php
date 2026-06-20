<?php
declare(strict_types=1);

namespace App\Core;

/** Migrações leves e idempotentes para bancos já instalados. */
final class Migrate
{
    public static function ensure(): void
    {
        self::addColumnIfMissing('symbol_content', 'table_data', 'JSON NULL AFTER `closing`');
        self::addColumnIfMissing('symbols', 'image_url', 'VARCHAR(500) NULL');
        self::addColumnIfMissing('symbols', 'image_photographer', 'VARCHAR(190) NULL');
        self::addColumnIfMissing('symbols', 'image_photographer_url', 'VARCHAR(500) NULL');
        self::addColumnIfMissing('symbols', 'image_page', 'VARCHAR(500) NULL');
        self::addColumnIfMissing('symbols', 'parent_id', 'VARCHAR(64) NULL');
    }

    private static function addColumnIfMissing(string $table, string $column, string $definition): void
    {
        try {
            $pdo = Database::pdo();
            $stmt = $pdo->prepare(
                'SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
            );
            $stmt->execute([$table, $column]);
            if ((int) $stmt->fetchColumn() === 0) {
                $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
            }
        } catch (\Throwable) {
            // best-effort: se falhar, o app segue (campo é opcional)
        }
    }
}
