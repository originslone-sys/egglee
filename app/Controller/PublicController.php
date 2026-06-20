<?php
declare(strict_types=1);

namespace App\Controller;

use App\Core\View;
use App\Repository\SymbolRepository;
use App\Support\Lang;

/** Site público: home por idioma, artigo e sitemap. */
final class PublicController
{
    public function __construct(private SymbolRepository $repo = new SymbolRepository()) {}

    public function home(string $lang): void
    {
        if (!Lang::isValid($lang)) {
            $this->notFound();
            return;
        }
        $items = $this->repo->listLive($lang);
        $alternates = ['pt' => '/pt', 'es' => '/es', 'en' => '/en'];

        echo View::render('public/home', [
            'lang'       => $lang,
            'items'      => $items,
            'alternates' => $alternates,
            'title'      => 'egglee — ' . Lang::ui($lang, 'tagline'),
            'description'=> Lang::ui($lang, 'tagline'),
            'canonical'  => "/$lang",
            'jsonLd'     => [],
        ], 'public/layout');
    }

    public function article(string $lang, string $slug): void
    {
        if (!Lang::isValid($lang)) {
            $this->notFound();
            return;
        }
        $c = $this->repo->findBySlug($lang, $slug);
        if ($c === null) {
            $this->notFound();
            return;
        }

        $alternates = $this->repo->alternates($c['symbol_id']);
        $related = $this->repo->relatedLinks($c['related'] ?? [], $lang);
        $canonical = "/$lang/{$c['slug']}";
        $siteUrl = rtrim((string) (\App\Core\Env::get('SITE_URL', '')), '/');

        $image = !empty($c['image_url']) ? (string) $c['image_url'] : null;

        $articleSchema = [
            '@context' => 'https://schema.org',
            '@type'    => 'Article',
            'headline' => $c['h1'],
            'description' => $c['meta_description'],
            'inLanguage'  => $lang,
            'mainEntityOfPage' => $siteUrl . $canonical,
        ];
        if ($image) {
            $articleSchema['image'] = $image;
        }

        $jsonLd = [
            $articleSchema,
            [
                '@context' => 'https://schema.org',
                '@type'    => 'FAQPage',
                'mainEntity' => array_map(fn($f) => [
                    '@type' => 'Question',
                    'name'  => $f['question'],
                    'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['answer']],
                ], $c['faq']),
            ],
            [
                '@context' => 'https://schema.org',
                '@type'    => 'BreadcrumbList',
                'itemListElement' => [
                    ['@type' => 'ListItem', 'position' => 1, 'name' => Lang::ui($lang, 'home'), 'item' => "$siteUrl/$lang"],
                    ['@type' => 'ListItem', 'position' => 2, 'name' => $c['h1']],
                ],
            ],
        ];

        echo View::render('public/article', [
            'lang'       => $lang,
            'c'          => $c,
            'related'    => $related,
            'alternates' => $alternates,
            'title'      => $c['title'],
            'description'=> $c['meta_description'],
            'canonical'  => $canonical,
            'jsonLd'     => $jsonLd,
            'image'      => $image,
        ], 'public/layout');
    }

    public function sitemap(): void
    {
        $siteUrl = rtrim((string) (\App\Core\Env::get('SITE_URL', '')), '/');
        header('Content-Type: application/xml; charset=utf-8');
        $urls = [];
        foreach (Lang::LANGS as $lang) {
            $urls[] = "$siteUrl/$lang";
            foreach ($this->repo->listLive($lang) as $it) {
                $urls[] = "$siteUrl/$lang/{$it['slug']}";
            }
        }
        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($urls as $u) {
            echo '  <url><loc>' . htmlspecialchars($u, ENT_XML1) . "</loc></url>\n";
        }
        echo '</urlset>';
    }

    public function notFound(): void
    {
        http_response_code(404);
        echo View::render('public/notfound', [
            'lang' => 'pt',
            'alternates' => ['pt' => '/pt', 'es' => '/es', 'en' => '/en'],
            'title' => '404 — egglee',
            'description' => '',
            'canonical' => '/',
            'jsonLd' => [],
        ], 'public/layout');
    }
}
