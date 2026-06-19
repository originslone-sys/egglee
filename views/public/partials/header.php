<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */ /** @var array $alternates */
?>
<header class="site-header">
  <div class="site-header__inner">
    <a class="brand" href="/<?= e($lang) ?>" aria-label="egglee — início">
      <img src="/logo.svg" alt="egglee" width="220" height="64">
    </a>
    <nav class="langs" aria-label="Idiomas">
      <?php foreach (Lang::LANGS as $l): ?>
        <a href="<?= e($alternates[$l] ?? "/$l") ?>"<?= $l === $lang ? ' aria-current="page"' : '' ?> hreflang="<?= e($l) ?>"><?= e(Lang::ui($l, 'langName')) ?></a>
      <?php endforeach; ?>
    </nav>
  </div>
</header>
