<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Decide se a aplicação já está instalada — de forma robusta, sem depender
 * só de um arquivo de trava (que pode se perder em deploys automáticos).
 *
 * Ordem: arquivo de trava (rápido) -> senão, verifica se o banco já tem as
 * tabelas. Se o banco estiver pronto, recria a trava para acelerar as
 * próximas checagens.
 */
final class Installed
{
    public static function check(string $root): bool
    {
        $lock = "$root/database/.installed";
        if (is_file($lock)) {
            return true;
        }
        // Fallback: o banco já tem a estrutura?
        try {
            $pdo = Database::pdo();
            $row = $pdo->query("SHOW TABLES LIKE 'admin_users'")->fetch();
            if ($row) {
                @file_put_contents($lock, 'detectado via banco em ' . date('c') . "\n");
                return true;
            }
        } catch (\Throwable) {
            // sem .env / banco indisponível => trata como não instalado
        }
        return false;
    }
}
