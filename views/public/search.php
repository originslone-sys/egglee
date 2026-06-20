<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */ /** @var string $q */ /** @var array $items */
?>
<main class="wrap-wide">
  <h1 class="section-title" style="text-align:left"><?= e(Lang::ui($lang, 'searchTitle')) ?></h1>
  <form class="search-page" action="<?= e(Lang::searchUrl($lang)) ?>" method="get" role="search">
    <input type="search" name="q" value="<?= e($q) ?>" placeholder="<?= e(Lang::ui($lang, 'searchPh')) ?>" autofocus>
    <button type="submit"><?= e(Lang::ui($lang, 'searchTitle')) ?></button>
  </form>

  <?php if ($q !== ''): ?>
    <p class="section-sub" style="text-align:left">
      <?= e(Lang::ui($lang, 'searchFor')) ?> <strong><?= e($q) ?></strong> — <?= count($items) ?>
    </p>
    <?php if (!$items): ?>
      <p class="section-sub"><?= e(Lang::ui($lang, 'noResults')) ?></p>
    <?php else: ?>
      <div class="acard-grid">
        <?php foreach ($items as $card) { include __DIR__ . '/partials/card.php'; } ?>
      </div>
    <?php endif; ?>
  <?php endif; ?>
</main>
