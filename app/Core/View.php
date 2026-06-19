<?php
declare(strict_types=1);

namespace App\Core;

/** Renderização de templates PHP simples com escape seguro. */
final class View
{
    private static string $base = __DIR__ . '/../../views';

    /** Renderiza um template dentro de um layout. */
    public static function render(string $template, array $data = [], ?string $layout = null): string
    {
        $content = self::partial($template, $data);
        if ($layout !== null) {
            return self::partial($layout, array_merge($data, ['content' => $content]));
        }
        return $content;
    }

    public static function partial(string $template, array $data = []): string
    {
        $file = self::$base . '/' . $template . '.php';
        if (!is_file($file)) {
            throw new \RuntimeException("Template não encontrado: $template");
        }
        extract($data, EXTR_SKIP);
        ob_start();
        include $file;
        return (string) ob_get_clean();
    }
}

/** Helper global de escape (HTML). */
function e(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * URL de asset com "cache-busting": acrescenta ?v=<mtime>, então o navegador
 * busca a versão nova sempre que o arquivo muda (e mantém o cache longo entre
 * mudanças). Evita CSS/JS velho preso no cache após o deploy.
 */
function asset(string $path): string
{
    $rel  = '/' . ltrim($path, '/');
    $full = dirname(__DIR__, 2) . $rel; // raiz do projeto (= document root)
    $v    = is_file($full) ? filemtime($full) : time();
    return $rel . '?v=' . $v;
}
