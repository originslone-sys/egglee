<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */ /** @var string $cat */ /** @var string $name */ /** @var array $items */
?>
<main class="wrap-wide">
  <p class="breadcrumbs">
    <a href="/<?= e($lang) ?>"><?= e(Lang::ui($lang, 'home')) ?></a> ›
    <?= e(Lang::ui($lang, 'categories')) ?> › <?= e($name) ?>
  </p>

  <header class="cat-head">
    <span class="cat-head__icon"><?= Lang::categoryIcon($cat) ?></span>
    <div>
      <h1><?= e(Lang::ui($lang, 'articlesIn')) ?> <?= e($name) ?></h1>
      <p class="section-sub"><?= count($items) ?> <?= count($items) === 1 ? 'artigo' : 'artigos' ?></p>
    </div>
  </header>

  <?php if (!$items): ?>
    <p class="section-sub">—</p>
  <?php else: ?>
    <div class="acard-grid">
      <?php foreach ($items as $card) { include __DIR__ . '/partials/card.php'; } ?>
    </div>
  <?php endif; ?>
</main>
