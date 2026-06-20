<?php
declare(strict_types=1);

/*
 * Piloto automático de geração. Cada execução gera o PRÓXIMO conceito ainda
 * não gerado (base + variações), pulando os que já existem ou falharam.
 *
 * Rodar manualmente:  php scripts/worker.php [quantos_artigos]
 * Cron (a cada 10 min):
 *   [*]/10 * * * * /usr/bin/php /home/USER/public_html/scripts/worker.php 1
 *   (troque [*]/10 pelo asterisco-barra-10 normal do cron)
 *
 * IMPORTANTE: use o PHP 8.1+ no cron. Se /usr/bin/php for antigo, troque pelo
 * binário do PHP 8 (ex.: /opt/alt/php82/usr/bin/php).
 */

// Guard de versão (precisa rodar antes de carregar as classes do app).
if (PHP_VERSION_ID < 80100) {
    fwrite(STDERR, "egglee: requer PHP 8.1+. Versao atual do cron: " . PHP_VERSION
        . ". Troque o binario do cron para o PHP 8 (ex.: /opt/alt/php82/usr/bin/php).\n");
    exit(1);
}

$root = dirname(__DIR__);
spl_autoload_register(static function (string $class) use ($root): void {
    if (strncmp($class, 'App\\', 4) !== 0) return;
    $file = "$root/app/" . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) require $file;
});
require "$root/app/Core/View.php";

use App\Core\Env;
use App\Service\AutoGenerator;

Env::load("$root/.env");
@set_time_limit(0);

// Heartbeat inicial: prova que o cron disparou (tick sobrescreve com o resultado).
@file_put_contents("$root/database/last-run.json", json_encode([
    'time' => date('c'), 'sapi' => PHP_SAPI, 'php' => PHP_VERSION, 'ok' => 0, 'failedRun' => 0,
]));

if (!Env::get('DEEPSEEK_API_KEY')) {
    fwrite(STDERR, "egglee: DEEPSEEK_API_KEY nao configurada no .env — nada a gerar.\n");
    exit(1);
}

$n = isset($argv[1]) ? max(1, (int) $argv[1]) : 1;
$r = (new AutoGenerator())->tick($n);
echo date('c') . " auto: {$r['ok']} gerado(s), {$r['failedRun']} falha(s) nesta execucao | "
    . "{$r['generated']}/{$r['total']} prontos, {$r['remaining']} restantes\n";
