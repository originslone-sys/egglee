<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Variações (fase 2): páginas-filhas de cauda longa derivadas dos conceitos
 * base por MODIFICADORES por categoria (cor, estado, ação, contexto).
 *
 * Cada variação é um conceito próprio, com `parent` apontando para o conceito
 * base — usado para a linkagem mãe↔filha (hub-and-spoke).
 *
 * O `en` é só uma dica para a IA entender; ela decide o termo localizado
 * ("sonhar com cobra preta", "soñar con serpiente negra", etc.).
 */
final class Variations
{
    /** Modificadores por categoria. {n} = substantivo base (sem artigo). */
    private const MODIFIERS = [
        'animals' => [
            ['slug'=>'preta',     'en'=>'a black {n}'],
            ['slug'=>'branca',    'en'=>'a white {n}'],
            ['slug'=>'verde',     'en'=>'a green {n}'],
            ['slug'=>'amarela',   'en'=>'a yellow {n}'],
            ['slug'=>'grande',    'en'=>'a big {n}'],
            ['slug'=>'pequena',   'en'=>'a small {n}'],
            ['slug'=>'morta',     'en'=>'a dead {n}'],
            ['slug'=>'varias',    'en'=>'many {n}'],
            ['slug'=>'mordendo',  'en'=>'a {n} biting you'],
            ['slug'=>'atacando',  'en'=>'a {n} attacking you'],
            ['slug'=>'na-agua',   'en'=>'a {n} in the water'],
            ['slug'=>'em-casa',   'en'=>'a {n} inside your house'],
        ],
        'objects' => [
            ['slug'=>'quebrado',  'en'=>'a broken {n}'],
            ['slug'=>'velho',     'en'=>'an old {n}'],
            ['slug'=>'novo',      'en'=>'a new {n}'],
            ['slug'=>'dourado',   'en'=>'a golden {n}'],
            ['slug'=>'perdido',   'en'=>'losing a {n}'],
            ['slug'=>'varios',    'en'=>'many {n}'],
        ],
        'nature' => [
            ['slug'=>'forte',     'en'=>'a powerful {n}'],
            ['slug'=>'escuro',    'en'=>'a dark {n}'],
            ['slug'=>'em-chamas', 'en'=>'a {n} on fire'],
        ],
        'body' => [
            ['slug'=>'quebrado',  'en'=>'a broken {n}'],
            ['slug'=>'machucado', 'en'=>'an injured {n}'],
        ],
    ];

    /** Substantivo base (remove artigo inicial). */
    private static function noun(string $en): string
    {
        return preg_replace('/^(a |an |the )/i', '', $en) ?? $en;
    }

    /** Todas as variações como lista plana: {id, en, category, parent}. */
    public static function all(): array
    {
        $out = [];
        foreach (Dictionary::grouped() as $cat => $items) {
            $mods = self::MODIFIERS[$cat] ?? [];
            if (!$mods) {
                continue;
            }
            foreach ($items as $base) {
                $noun = self::noun($base['en']);
                foreach ($mods as $m) {
                    $out[] = [
                        'id'       => $base['id'] . '-' . $m['slug'],
                        'en'       => str_replace('{n}', $noun, $m['en']),
                        'category' => $cat,
                        'parent'   => $base['id'],
                    ];
                }
            }
        }
        return $out;
    }

    public static function find(string $id): ?array
    {
        foreach (self::all() as $it) {
            if ($it['id'] === $id) {
                return $it;
            }
        }
        return null;
    }

    public static function count(): int
    {
        return count(self::all());
    }
}
