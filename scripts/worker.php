<?php
declare(strict_types=1);

/*
 * Piloto automático de geração. Cada execução gera o PRÓXIMO conceito ainda
 * não gerado (percorrendo o dicionário), pulando os que já existem ou falharam.
 *
 * Rodar manualmente:  php scripts/worker.php [quantos_artigos]
 * Cron (recomendado, a cada 30 min):
 *   [*]/30 * * * * /usr/bin/php /home/USER/public_html/scripts/worker.php 1
 *   (troque [*]/30 pelo asterisco-barra-30 normal do cron)
 *
 * Se uma geração falhar, registra e passa para o próximo. Roda em CLI, sem
 * limite de tempo da web.
 */
$root = dirname(__DIR__);
spl_autoload_register(static function (string $class) use ($root): void {
    if (!str_starts_with($class, 'App\\')) return;
    $file = "$root/app/" . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) require $file;
});
require "$root/app/Core/View.php";

use App\Core\Env;
use App\Service\AutoGenerator;

Env::load("$root/.env");
@set_time_limit(0);

$n = isset($argv[1]) ? max(1, (int) $argv[1]) : 1;
$r = (new AutoGenerator())->tick($n);
echo date('c') . " auto: {$r['ok']} gerado(s), {$r['failedRun']} falha(s) nesta execução | "
    . "{$r['generated']}/{$r['total']} prontos, {$r['remaining']} restantes\n";
