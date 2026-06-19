<?php
declare(strict_types=1);

/*
 * Worker da fila de geração. Processa itens pendentes (1 por vez por padrão).
 *
 * Rodar manualmente:   php scripts/worker.php [quantidade]
 * Cron (recomendado, a cada 5 min):
 *   [*]/5 * * * * php /home/USER/domains/SEU_DOMINIO/public_html/scripts/worker.php 1 >> /tmp/egglee-worker.log 2>&1
 *   (troque [*]/5 pelo asterisco-barra-5 normal do cron)
 *
 * Processa em segundo plano, então nunca trava o painel nem estoura timeout web.
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
