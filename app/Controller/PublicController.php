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
        $alternates = ['pt' => '/pt', 'es' => '/es', 'en' => '/en'];

        echo View::render('public/home', [
            'lang'       => $lang,
            'counts'     => $this->repo->categoryCounts($lang),
            'recent'     => $this->repo->recent($lang, 8),
            'popular'    => $this->repo->listLive($lang, 60),
            'alternates' => $alternates,
            'title'      => 'egglee — ' . Lang::ui($lang, 'tagline'),
            'description'=> Lang::ui($lang, 'tagline'),
            'canonical'  => "/$lang",
            'jsonLd'     => [],
            'image'      => null,
        ], 'public/layout');
    }

    public function category(string $lang, string $slug): void
    {
        if (!Lang::isValid($lang)) {
            $this->notFound();
            return;
        }
        $cat = Lang::categoryFromSlug($lang, $slug);
        if ($cat === null) {
            $this->notFound();
            return;
        }
        $items = $this->repo->listByCategory($lang, $cat);
        $name = Lang::categoryName($lang, $cat);
        $alternates = [];
        foreach (Lang::LANGS as $l) {
            $alternates[$l] = Lang::categoryUrl($l, $cat);
        }
        echo View::render('public/category', [
            'lang'       => $lang,
            'cat'        => $cat,
            'name'       => $name,
            'items'      => $items,
            'alternates' => $alternates,
            'title'      => $name . ' — ' . Lang::ui($lang, 'articlesIn') . ' egglee',
            'description'=> Lang::ui($lang, 'articlesIn') . ' ' . mb_strtolower($name) . '. ' . Lang::ui($lang, 'tagline'),
            'canonical'  => Lang::categoryUrl($lang, $cat),
            'jsonLd'     => [],
            'image'      => null,
        ], 'public/layout');
    }

    public function search(string $lang): void
    {
        if (!Lang::isValid($lang)) {
            $this->notFound();
            return;
        }
        $q = trim((string) ($_GET['q'] ?? ''));
        $items = $q !== '' ? $this->repo->search($lang, $q) : [];
        $alternates = [];
        foreach (Lang::LANGS as $l) {
            $alternates[$l] = Lang::searchUrl($l);
        }
        echo View::render('public/search', [
            'lang'       => $lang,
            'q'          => $q,
            'items'      => $items,
            'alternates' => $alternates,
            'title'      => Lang::ui($lang, 'searchTitle') . ($q !== '' ? ': ' . $q : '') . ' — egglee',
            'description'=> Lang::ui($lang, 'searchTitle'),
            'canonical'  => Lang::searchUrl($lang),
            'jsonLd'     => [],
            'image'      => null,
            'noindex'    => true,
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
        $parentInfo = !empty($c['parent_id']) ? $this->repo->cardById((string) $c['parent_id'], $lang) : null;
        $children = $this->repo->childrenCards((string) $c['id'], $lang);

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
        if (!empty($c['updated_at'])) {
            $iso = date('c', strtotime((string) $c['updated_at']));
            $articleSchema['dateModified'] = $iso;
            $articleSchema['datePublished'] = $iso;
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
                'itemListElement' => (function () use ($lang, $c, $siteUrl, $parentInfo) {
                    $crumbs = [
                        ['@type' => 'ListItem', 'name' => Lang::ui($lang, 'home'), 'item' => "$siteUrl/$lang"],
                        ['@type' => 'ListItem', 'name' => Lang::categoryName($lang, (string) $c['category']), 'item' => $siteUrl . Lang::categoryUrl($lang, (string) $c['category'])],
                    ];
                    if ($parentInfo) {
                        $crumbs[] = ['@type' => 'ListItem', 'name' => $parentInfo['h1'], 'item' => $siteUrl . $parentInfo['href']];
                    }
                    $crumbs[] = ['@type' => 'ListItem', 'name' => $c['h1']];
                    foreach ($crumbs as $i => &$cr) {
                        $cr['position'] = $i + 1;
                    }
                    return $crumbs;
                })(),
            ],
        ];

        echo View::render('public/article', [
            'lang'       => $lang,
            'c'          => $c,
            'related'    => $related,
            'parentInfo' => $parentInfo,
            'children'   => $children,
            'suggested'  => $this->repo->relatedArticles($lang, (string) $c['category'], (string) $c['symbol_id'], 6),
            'alternates' => $alternates,
            'title'      => $c['title'],
            'description'=> $c['meta_description'],
            'canonical'  => $canonical,
            'jsonLd'     => $jsonLd,
            'image'      => $image,
        ], 'public/layout');
    }

    public function robots(): void
    {
        $siteUrl = rtrim((string) (\App\Core\Env::get('SITE_URL', '')), '/');
        header('Content-Type: text/plain; charset=utf-8');
        echo "User-agent: *\n";
        echo "Allow: /\n";
        echo "Disallow: /admin\n";
        echo "Disallow: /install.php\n\n";
        echo "Sitemap: $siteUrl/sitemap.xml\n";
    }

    public function page(string $lang, string $key): void
    {
        if (!Lang::isValid($lang)) {
            $this->notFound();
            return;
        }
        $email = \App\Core\Env::get('CONTACT_EMAIL', 'contato@egglee.com');
        $siteHost = preg_replace('#^https?://#', '', rtrim((string) \App\Core\Env::get('SITE_URL', 'egglee.com'), '/'));
        $alternates = [];
        foreach (Lang::LANGS as $l) {
            $alternates[$l] = \App\Support\Pages::url($l, $key);
        }
        echo View::render('public/page', [
            'lang'       => $lang,
            'pageTitle'  => \App\Support\Pages::title($lang, $key),
            'bodyHtml'   => \App\Support\Pages::body($lang, $key, $email, $siteHost),
            'alternates' => $alternates,
            'title'      => \App\Support\Pages::title($lang, $key) . ' — egglee',
            'description'=> \App\Support\Pages::title($lang, $key) . ' — egglee.',
            'canonical'  => \App\Support\Pages::url($lang, $key),
            'jsonLd'     => [],
            'image'      => null,
        ], 'public/layout');
    }

    public function sitemap(): void
    {
        $siteUrl = rtrim((string) (\App\Core\Env::get('SITE_URL', '')), '/');
        header('Content-Type: application/xml; charset=utf-8');
        $urls = [];
        foreach (Lang::LANGS as $lang) {
            $urls[] = "$siteUrl/$lang";
            foreach (['about', 'privacy', 'cookies', 'terms', 'contact'] as $pk) {
                $urls[] = $siteUrl . \App\Support\Pages::url($lang, $pk);
            }
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
