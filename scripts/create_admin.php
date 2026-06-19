<?php
declare(strict_types=1);

/**
 * Cria (ou atualiza) um usuário do painel admin com senha em hash.
 * Uso: php scripts/create_admin.php <usuario> <senha>
 */
$root = dirname(__DIR__);
spl_autoload_register(static function (string $class) use ($root): void {
    if (!str_starts_with($class, 'App\\')) return;
    $file = "$root/app/" . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) require $file;
});

use App\Core\Env;
use App\Core\Database;

Env::load("$root/.env");

$user = $argv[1] ?? '';
$pass = $argv[2] ?? '';
if ($user === '' || strlen($pass) < 8) {
    fwrite(STDERR, "Uso: php scripts/create_admin.php <usuario> <senha (>=8 chars)>\n");
    exit(1);
}

$hash = password_hash($pass, PASSWORD_DEFAULT);
Database::pdo()->prepare(
    'INSERT INTO admin_users (username, password_hash, role) VALUES (?,?,"admin")
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)'
)->execute([$user, $hash]);

echo "✓ Usuário admin \"$user\" pronto.\n";
