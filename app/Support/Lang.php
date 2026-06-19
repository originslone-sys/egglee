<?php
declare(strict_types=1);

namespace App\Support;

/** Strings de interface, hreflang e vozes de geração por idioma. */
final class Lang
{
    public const LANGS = ['pt', 'es', 'en'];

    public const HREFLANG = ['pt' => 'pt-BR', 'es' => 'es-ES', 'en' => 'en-US'];

    /** Textos da interface pública. */
    public const UI = [
        'pt' => [
            'tagline'       => 'O que os seus sonhos querem dizer — tradição popular e psicologia, sem enrolação.',
            'heroTitle'     => 'Descubra o significado dos seus sonhos',
            'quickAnswer'   => 'Resposta rápida',
            'variations'    => 'Variações comuns',
            'faq'           => 'Perguntas frequentes',
            'related'       => 'Sonhos relacionados',
            'indexTitle'    => 'Sonhos mais buscados',
            'indexSub'      => 'Escolha um símbolo e veja a interpretação completa.',
            'home'          => 'Início',
            'langName'      => 'PT',
            'disclaimer'    => 'As interpretações da egglee reúnem tradição popular, simbologia cultural e psicologia, e têm caráter informativo e de entretenimento. Não substituem orientação profissional de saúde.',
        ],
        'es' => [
            'tagline'       => 'Lo que tus sueños quieren decir — tradición popular y psicología, sin rodeos.',
            'heroTitle'     => 'Descubre el significado de tus sueños',
            'quickAnswer'   => 'Respuesta rápida',
            'variations'    => 'Variaciones comunes',
            'faq'           => 'Preguntas frecuentes',
            'related'       => 'Sueños relacionados',
            'indexTitle'    => 'Sueños más buscados',
            'indexSub'      => 'Elige un símbolo y mira la interpretación completa.',
            'home'          => 'Inicio',
            'langName'      => 'ES',
            'disclaimer'    => 'Las interpretaciones de egglee reúnen tradición popular, simbología cultural y psicología, con fines informativos y de entretenimiento. No sustituyen la orientación de un profesional de la salud.',
        ],
        'en' => [
            'tagline'       => 'What your dreams are trying to say — folk tradition and psychology, no fluff.',
            'heroTitle'     => 'Discover what your dreams mean',
            'quickAnswer'   => 'Quick answer',
            'variations'    => 'Common variations',
            'faq'           => 'Frequently asked questions',
            'related'       => 'Related dreams',
            'indexTitle'    => 'Most searched dreams',
            'indexSub'      => 'Pick a symbol and read the full interpretation.',
            'home'          => 'Home',
            'langName'      => 'EN',
            'disclaimer'    => 'egglee interpretations blend folk tradition, cultural symbolism and psychology, for informational and entertainment purposes. They are not a substitute for professional health advice.',
        ],
    ];

    public static function isValid(string $lang): bool
    {
        return in_array($lang, self::LANGS, true);
    }

    public static function ui(string $lang, string $key): string
    {
        return self::UI[$lang][$key] ?? '';
    }
}
