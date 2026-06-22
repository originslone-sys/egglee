<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */ /** @var string $pageTitle */ /** @var string $bodyHtml */
?>
<main class="wrap article static-page">
  <p class="breadcrumbs">
    <a href="/<?= e($lang) ?>"><?= e(Lang::ui($lang, 'home')) ?></a> › <?= e($pageTitle) ?>
  </p>
  <h1><?= e($pageTitle) ?></h1>
  <div class="page-body"><?= $bodyHtml /* HTML confiável, definido pela aplicação */ ?></div>
</main>
