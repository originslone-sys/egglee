<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */ /** @var array $alternates */
$cats = Lang::categories();
?>
<header class="site-header">
  <div class="site-header__inner">
    <a class="brand" href="/<?= e($lang) ?>" aria-label="egglee — início">
      <img src="/logo.svg" alt="egglee" width="220" height="64">
    </a>

    <form class="nav-search" action="<?= e(Lang::searchUrl($lang)) ?>" method="get" role="search">
      <input type="search" name="q" placeholder="<?= e(Lang::ui($lang, 'searchPh')) ?>" aria-label="<?= e(Lang::ui($lang, 'searchTitle')) ?>">
      <button type="submit" aria-label="<?= e(Lang::ui($lang, 'searchTitle')) ?>">🔍</button>
    </form>

    <div class="nav-right">
      <details class="cat-menu">
        <summary><?= e(Lang::ui($lang, 'categories')) ?> ▾</summary>
        <div class="cat-dropdown">
          <?php foreach ($cats as $c): ?>
            <a href="<?= e(Lang::categoryUrl($lang, $c)) ?>"><span><?= Lang::categoryIcon($c) ?></span><?= e(Lang::categoryName($lang, $c)) ?></a>
          <?php endforeach; ?>
        </div>
      </details>
      <nav class="langs" aria-label="Idiomas">
        <?php foreach (Lang::LANGS as $l): ?>
          <a href="<?= e($alternates[$l] ?? "/$l") ?>"<?= $l === $lang ? ' aria-current="page"' : '' ?> hreflang="<?= e($l) ?>"><?= e(Lang::ui($l, 'langName')) ?></a>
        <?php endforeach; ?>
      </nav>
    </div>
  </div>
</header>
