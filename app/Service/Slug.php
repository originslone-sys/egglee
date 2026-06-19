<?php
declare(strict_types=1);

namespace App\Service;

final class Slug
{
    /** Gera slug ASCII, minúsculo, com hífens (remove acentos). */
    public static function make(string $text): string
    {
        $text = self::asciiFold($text);
        $text = strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
        return trim($text, '-');
    }

    public static function asciiFold(string $s): string
    {
        $map = [
            'á'=>'a','à'=>'a','â'=>'a','ã'=>'a','ä'=>'a','å'=>'a',
            'é'=>'e','è'=>'e','ê'=>'e','ë'=>'e',
            'í'=>'i','ì'=>'i','î'=>'i','ï'=>'i',
            'ó'=>'o','ò'=>'o','ô'=>'o','õ'=>'o','ö'=>'o',
            'ú'=>'u','ù'=>'u','û'=>'u','ü'=>'u',
            'ç'=>'c','ñ'=>'n',
            'Á'=>'a','À'=>'a','Â'=>'a','Ã'=>'a','É'=>'e','Ê'=>'e','Í'=>'i',
            'Ó'=>'o','Ô'=>'o','Õ'=>'o','Ú'=>'u','Ç'=>'c','Ñ'=>'n',
        ];
        return strtr($s, $map);
    }
}
