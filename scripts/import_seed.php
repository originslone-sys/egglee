<?php
declare(strict_types=1);

/**
 * Importa os JSONs de database/seed/ para o MySQL.
 * Uso: php scripts/import_seed.php
 */
$root = dirname(__DIR__);
spl_autoload_register(static function (string $class) use ($root): void {
    if (!str_starts_with($class, 'App\\')) return;
    $file = "$root/app/" . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) require $file;
});
require "$root/app/Core/View.php";

use App\Core\Env;
use App\Repository\SymbolRepository;

Env::load("$root/.env");
$repo = new SymbolRepository();

$files = glob("$root/database/seed/*.json") ?: [];
if (!$files) {
    fwrite(STDERR, "Nenhum seed em database/seed/.\n");
    exit(1);
}

foreach ($files as $file) {
    $data = json_decode((string) file_get_contents($file), true);
    if (!is_array($data) || empty($data['id'])) {
        fwrite(STDERR, "Ignorando inválido: $file\n");
        continue;
    }
    $repo->save(
        $data['id'],
        $data['category'] ?? 'objects',
        $data['related'] ?? [],
        $data['languages'] ?? [],
        $data['model'] ?? 'seed'
    );
    $repo->setStatus($data['id'], $data['status'] ?? 'reviewed');
    echo "✓ importado {$data['id']} ({$data['status']})\n";
}
echo "Concluído.\n";
