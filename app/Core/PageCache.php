<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Cache de página inteira em arquivo. Acelera o site e tira carga do MySQL/PHP.
 *
 * Só armazena/serve para visitantes SEM o cookie de consentimento — assim o
 * HTML cacheado (sem anúncios/Analytics, com o banner) é sempre coerente.
 * Quem aceita os cookies passa a receber a página dinâmica (com anúncios).
 * Bots e visitantes de primeira viagem — o tráfego que importa para SEO —
 * recebem a versão rápida do cache.
 */
final class PageCache
{
    /** Liga/desliga via .env (padrão: ligado). */
    public static function enabled(): bool
    {
        return Env::get('CACHE_ENABLED', '1') !== '0';
    }

    /** Validade do cache em segundos (padrão: 6 horas). */
    public static function ttl(): int
    {
        return max(60, (int) Env::get('CACHE_TTL', '21600'));
    }

    /** A requisição pode ser cacheada? GET puro, sem query, sem cookie de consentimento. */
    public static function cacheable(string $path, string $method): bool
    {
        return self::enabled()
            && $method === 'GET'
            && empty($_GET)
            && ($_COOKIE['egglee_consent'] ?? '') === ''
            && !str_starts_with($path, '/admin');
    }

    private static function dir(): string
    {
        $dir = dirname(__DIR__, 2) . '/database/cache';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        return $dir;
    }

    private static function file(string $path): string
    {
        return self::dir() . '/' . sha1($path) . '.html';
    }

    /** Se houver cópia válida, envia e devolve true (o chamador deve sair). */
    public static function serveFresh(string $path): bool
    {
        $file = self::file($path);
        if (!is_file($file) || (time() - filemtime($file)) > self::ttl()) {
            return false;
        }
        header('Content-Type: text/html; charset=utf-8');
        header('X-Egglee-Cache: HIT');
        readfile($file);
        return true;
    }

    /** Começa a capturar a saída; ao finalizar, grava no cache se for HTTP 200. */
    public static function begin(string $path): void
    {
        $file = self::file($path);
        ob_start(static function (string $html) use ($file): string {
            if (http_response_code() === 200 && trim($html) !== '') {
                @file_put_contents($file, $html, LOCK_EX);
            }
            return $html;
        });
    }

    /** Apaga todo o cache (chamar quando o conteúdo público muda). */
    public static function clear(): void
    {
        $dir = dirname(__DIR__, 2) . '/database/cache';
        if (!is_dir($dir)) {
            return;
        }
        foreach (glob($dir . '/*.html') ?: [] as $f) {
            @unlink($f);
        }
    }
}
