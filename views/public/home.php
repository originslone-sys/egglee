<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */ /** @var array $items */
?>
<section class="hero">
  <div class="hero__inner">
    <img class="egg-mark" src="/favicon.svg" alt="" width="64" height="64">
    <h1><?= e(Lang::ui($lang, 'heroTitle')) ?></h1>
    <p class="tagline"><?= e(Lang::ui($lang, 'tagline')) ?></p>
  </div>
</section>

<main class="wrap-wide">
  <h2 class="section-title"><?= e(Lang::ui($lang, 'indexTitle')) ?></h2>
  <p class="section-sub"><?= e(Lang::ui($lang, 'indexSub')) ?></p>

  <?php if (!$items): ?>
    <p class="section-sub">—</p>
  <?php else: ?>
    <ul class="card-grid">
      <?php foreach ($items as $it): ?>
        <li>
          <a class="card" href="/<?= e($lang) ?>/<?= e($it['slug']) ?>">
            <span class="dot" aria-hidden="true"></span><?= e($it['h1']) ?>
          </a>
        </li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>
</main>
