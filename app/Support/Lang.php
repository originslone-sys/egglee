<?php
declare(strict_types=1);

namespace App\Support;

/** Strings de interface, hreflang e vozes de geração por idioma. */
final class Lang
{
    public const LANGS = ['pt', 'es', 'en'];

    // hreflang por IDIOMA (sem país): alcança todos os falantes, não só BR/ES/US.
    public const HREFLANG = ['pt' => 'pt', 'es' => 'es', 'en' => 'en'];

    /** Nomes de categoria por idioma (para breadcrumb). */
    public const CATEGORY_NAMES = [
        'pt' => ['animals'=>'Animais','people'=>'Pessoas','actions'=>'Ações','objects'=>'Objetos','places'=>'Lugares','feelings'=>'Sentimentos','events'=>'Acontecimentos','body'=>'Corpo','nature'=>'Natureza','spiritual'=>'Espiritual'],
        'es' => ['animals'=>'Animales','people'=>'Personas','actions'=>'Acciones','objects'=>'Objetos','places'=>'Lugares','feelings'=>'Sentimientos','events'=>'Acontecimientos','body'=>'Cuerpo','nature'=>'Naturaleza','spiritual'=>'Espiritual'],
        'en' => ['animals'=>'Animals','people'=>'People','actions'=>'Actions','objects'=>'Objects','places'=>'Places','feelings'=>'Feelings','events'=>'Events','body'=>'Body','nature'=>'Nature','spiritual'=>'Spiritual'],
    ];

    public static function categoryName(string $lang, string $cat): string
    {
        return self::CATEGORY_NAMES[$lang][$cat] ?? ucfirst($cat);
    }

    /** Lista canônica das categorias (na ordem de exibição). */
    public static function categories(): array
    {
        return array_keys(self::CATEGORY_ICONS);
    }

    /** Slugs de categoria por idioma (para URLs amigáveis). */
    public const CATEGORY_SLUGS = [
        'pt' => ['animals'=>'animais','people'=>'pessoas','actions'=>'acoes','objects'=>'objetos','places'=>'lugares','feelings'=>'sentimentos','events'=>'acontecimentos','body'=>'corpo','nature'=>'natureza','spiritual'=>'espiritual'],
        'es' => ['animals'=>'animales','people'=>'personas','actions'=>'acciones','objects'=>'objetos','places'=>'lugares','feelings'=>'sentimientos','events'=>'acontecimientos','body'=>'cuerpo','nature'=>'naturaleza','spiritual'=>'espiritual'],
        'en' => ['animals'=>'animals','people'=>'people','actions'=>'actions','objects'=>'objects','places'=>'places','feelings'=>'feelings','events'=>'events','body'=>'body','nature'=>'nature','spiritual'=>'spiritual'],
    ];

    /** Ícone (emoji) por categoria. */
    public const CATEGORY_ICONS = [
        'animals'=>'🐾','people'=>'👥','actions'=>'🏃','objects'=>'🔑','places'=>'📍',
        'feelings'=>'💜','events'=>'📅','body'=>'✋','nature'=>'🌿','spiritual'=>'🔮',
    ];

    /** Palavra de URL para a listagem de categoria e para a busca, por idioma. */
    public const CATEGORY_PATH = ['pt'=>'categoria','es'=>'categoria','en'=>'category'];
    public const SEARCH_PATH   = ['pt'=>'busca','es'=>'busca','en'=>'search'];

    public static function categorySlug(string $lang, string $cat): string
    {
        return self::CATEGORY_SLUGS[$lang][$cat] ?? $cat;
    }

    /** Resolve a categoria (chave) a partir do slug localizado. */
    public static function categoryFromSlug(string $lang, string $slug): ?string
    {
        $map = self::CATEGORY_SLUGS[$lang] ?? [];
        $key = array_search($slug, $map, true);
        return $key === false ? null : $key;
    }

    public static function categoryIcon(string $cat): string
    {
        return self::CATEGORY_ICONS[$cat] ?? '✦';
    }

    public static function categoryUrl(string $lang, string $cat): string
    {
        return '/' . $lang . '/' . self::CATEGORY_PATH[$lang] . '/' . self::categorySlug($lang, $cat);
    }

    public static function searchUrl(string $lang): string
    {
        return '/' . $lang . '/' . self::SEARCH_PATH[$lang];
    }

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
            'searchPh'      => 'Buscar um sonho… (ex: cobra, dente, água)',
            'searchTitle'   => 'Buscar sonhos',
            'searchFor'     => 'Resultados para',
            'noResults'     => 'Nenhum resultado. Tente outra palavra.',
            'categories'    => 'Categorias',
            'browseAll'     => 'Explore por categoria',
            'recent'        => 'Adicionados recentemente',
            'readArticle'   => 'Ler interpretação',
            'inCategory'    => 'Veja mais em',
            'articlesIn'    => 'Sonhos sobre',
            'updatedOn'     => 'Atualizado em',
            'imageAlt'      => 'Imagem ilustrativa sobre o significado de',
            'cookieMsg'     => 'Usamos cookies para melhorar sua experiência e exibir anúncios. Você aceita?',
            'cookieAccept'  => 'Aceitar',
            'cookieReject'  => 'Recusar',
            'cookieMore'    => 'Saber mais',
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
            'searchPh'      => 'Busca un sueño… (ej: serpiente, dientes, agua)',
            'searchTitle'   => 'Buscar sueños',
            'searchFor'     => 'Resultados para',
            'noResults'     => 'Sin resultados. Prueba otra palabra.',
            'categories'    => 'Categorías',
            'browseAll'     => 'Explora por categoría',
            'recent'        => 'Añadidos recientemente',
            'readArticle'   => 'Ver interpretación',
            'inCategory'    => 'Ver más en',
            'articlesIn'    => 'Sueños sobre',
            'updatedOn'     => 'Actualizado el',
            'imageAlt'      => 'Imagen ilustrativa sobre el significado de',
            'cookieMsg'     => 'Usamos cookies para mejorar tu experiencia y mostrar anuncios. ¿Aceptas?',
            'cookieAccept'  => 'Aceptar',
            'cookieReject'  => 'Rechazar',
            'cookieMore'    => 'Saber más',
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
            'searchPh'      => 'Search a dream… (e.g. snake, teeth, water)',
            'searchTitle'   => 'Search dreams',
            'searchFor'     => 'Results for',
            'noResults'     => 'No results. Try another word.',
            'categories'    => 'Categories',
            'browseAll'     => 'Browse by category',
            'recent'        => 'Recently added',
            'readArticle'   => 'Read interpretation',
            'inCategory'    => 'See more in',
            'articlesIn'    => 'Dreams about',
            'updatedOn'     => 'Updated on',
            'imageAlt'      => 'Illustrative image about the meaning of',
            'cookieMsg'     => 'We use cookies to improve your experience and show ads. Do you accept?',
            'cookieAccept'  => 'Accept',
            'cookieReject'  => 'Reject',
            'cookieMore'    => 'Learn more',
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

    /** Nomes dos meses por idioma (1-based), para datas sem depender de locale do servidor. */
    private const MONTHS = [
        'pt' => ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
        'es' => ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
        'en' => ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ];

    /** Data por extenso no idioma dado (ex.: "22 de junho de 2026" / "June 22, 2026"). */
    public static function formatDate(string $lang, string $datetime): string
    {
        $ts = strtotime($datetime);
        if ($ts === false) {
            return '';
        }
        $d = (int) date('j', $ts);
        $m = self::MONTHS[$lang][(int) date('n', $ts)] ?? '';
        $y = date('Y', $ts);
        return $lang === 'en' ? "$m $d, $y" : "$d de $m de $y";
    }

    /** Texto alternativo descritivo da imagem do artigo (acessibilidade e SEO). */
    public static function imageAlt(string $lang, string $h1): string
    {
        $h1 = trim($h1);
        $prefix = self::UI[$lang]['imageAlt'] ?? '';
        if ($h1 === '') {
            return $prefix;
        }
        // Minúscula na 1ª letra para a frase fluir ("...significado de sonhar com cobra").
        $h1 = mb_strtolower(mb_substr($h1, 0, 1)) . mb_substr($h1, 1);
        return trim("$prefix $h1");
    }
}
