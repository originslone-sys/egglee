<?php
declare(strict_types=1);

/*
 * Worker da fila de geração. Processa por PASSOS: cada passo gera 1 idioma,
 * então cada execução é curta e cabe no tempo limite do cron/PHP.
 * Um símbolo completo = 3 passos (pt, es, en).
 *
 * O argumento é a quantidade de PASSOS por execução (padrão 1).
 *
 * Rodar manualmente:   php scripts/worker.php [passos]
 * Cron (recomendado, a cada 1 min para ir mais rápido):
 *   [*]/1 * * * * /usr/bin/php /home/USER/public_html/scripts/worker.php 1 >> /tmp/egglee-worker.log 2>&1
 *   (troque [*]/1 pelo asterisco-barra-1 normal do cron)
 *
 * Itens travados em "processing" (processo morto por timeout) são recuperados
 * automaticamente no início de cada execução (reclaim).
 */
$root = dirname(__DIR__);
spl_autoload_register(static function (string $class) use ($root): void {
    if (!str_starts_with($class, 'App\\')) return;
    $file = "$root/app/" . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) require $file;
});
require "$root/app/Core/View.php";

use App\Core\Env;
use App\Service\Generator;

Env::load("$root/.env");
@set_time_limit(0);

$max = isset($argv[1]) ? max(1, (int) $argv[1]) : 1;
[$done, $error] = (new Generator())->processPending($max);
echo date('c') . " worker: $done ok, $error erro(s)\n";
