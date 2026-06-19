<?php
declare(strict_types=1);

namespace App\Core;

/** Escreve/atualiza uma chave no arquivo .env, preservando o resto. */
final class EnvFile
{
    public static function set(string $root, string $key, string $value): bool
    {
        $path = "$root/.env";
        $lines = is_file($path) ? file($path, FILE_IGNORE_NEW_LINES) : [];
        $found = false;
        foreach ($lines as $i => $line) {
            if (preg_match('/^\s*' . preg_quote($key, '/') . '\s*=/', $line)) {
                $lines[$i] = "$key=$value";
                $found = true;
                break;
            }
        }
        if (!$found) {
            $lines[] = "$key=$value";
        }
        $ok = @file_put_contents($path, implode("\n", $lines) . "\n") !== false;
        if ($ok) {
            // aplica também em runtime para o efeito ser imediato
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
        return $ok;
    }
}
