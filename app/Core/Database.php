<?php
declare(strict_types=1);

namespace App\Core;

use PDO;

/** Conexão PDO única (MySQL/utf8mb4). */
final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }
        return self::$pdo = self::connect();
    }

    /** Força uma conexão nova (ex.: após uma chamada longa que pode ter
     *  derrubado a conexão por wait_timeout — erro "server has gone away"). */
    public static function reconnect(): PDO
    {
        self::$pdo = null;
        return self::pdo();
    }

    private static function connect(): PDO
    {
        $host = Env::get('DB_HOST', 'localhost');
        $port = Env::get('DB_PORT', '3306');
        $name = Env::get('DB_NAME', '');
        $user = Env::get('DB_USER', '');
        $pass = Env::get('DB_PASS', '');

        $dsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        // Mantém a conexão viva durante chamadas longas à IA (evita 2006).
        try {
            $pdo->exec('SET SESSION wait_timeout=28800, interactive_timeout=28800');
        } catch (\Throwable) {
            // host pode restringir; segue assim mesmo
        }
        return $pdo;
    }
}
