<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */ /** @var array $counts */ /** @var array $recent */ /** @var array $popular */
$cats = Lang::categories();
?>
<section class="hero">
  <div class="hero__inner">
    <img class="egg-mark" src="/favicon.svg" alt="" width="64" height="64">
    <h1><?= e(Lang::ui($lang, 'heroTitle')) ?></h1>
    <p class="tagline"><?= e(Lang::ui($lang, 'tagline')) ?></p>
    <form class="hero-search" action="<?= e(Lang::searchUrl($lang)) ?>" method="get" role="search">
      <input type="search" name="q" placeholder="<?= e(Lang::ui($lang, 'searchPh')) ?>" aria-label="<?= e(Lang::ui($lang, 'searchTitle')) ?>">
      <button type="submit"><?= e(Lang::ui($lang, 'searchTitle')) ?></button>
    </form>
  </div>
</section>

<main class="wrap-wide">
  <h2 class="section-title" id="categorias"><?= e(Lang::ui($lang, 'browseAll')) ?></h2>
  <ul class="cat-grid">
    <?php foreach ($cats as $c): $n = $counts[$c] ?? 0; ?>
      <li>
        <a class="cat-card" href="<?= e(Lang::categoryUrl($lang, $c)) ?>">
          <span class="cat-card__icon"><?= Lang::categoryIcon($c) ?></span>
          <span class="cat-card__name"><?= e(Lang::categoryName($lang, $c)) ?></span>
          <span class="cat-card__count"><?= $n ?></span>
        </a>
      </li>
    <?php endforeach; ?>
  </ul>

  <?php if ($recent): ?>
    <h2 class="section-title"><?= e(Lang::ui($lang, 'recent')) ?></h2>
    <div class="acard-grid">
      <?php foreach ($recent as $card) { include __DIR__ . '/partials/card.php'; } ?>
    </div>
  <?php endif; ?>

  <?php if ($popular): ?>
    <h2 class="section-title"><?= e(Lang::ui($lang, 'indexTitle')) ?></h2>
    <ul class="link-list">
      <?php foreach ($popular as $p): ?>
        <li><a href="/<?= e($lang) ?>/<?= e($p['slug']) ?>"><?= e($p['h1']) ?></a></li>
      <?php endforeach; ?>
    </ul>
    <p class="home-more">
      <a class="btn-more" href="#categorias"><?= e(Lang::ui($lang, 'browseAll')) ?> →</a>
    </p>
  <?php endif; ?>
</main>
