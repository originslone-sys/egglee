<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */
$cats = Lang::categories();
?>
<footer class="site-footer">
  <div class="site-footer__inner">
    <div class="foot-cols">
      <div class="foot-brand-col">
        <p class="foot-brand">egglee</p>
        <p class="foot-tag"><?= e(Lang::ui($lang, 'tagline')) ?></p>
        <nav class="foot-langs">
          <?php foreach (Lang::LANGS as $l): ?>
            <a href="/<?= e($l) ?>"<?= $l===$lang?' aria-current="page"':'' ?>><?= e(Lang::ui($l, 'langName')) ?></a>
          <?php endforeach; ?>
        </nav>
      </div>
      <div class="foot-cats">
        <h4><?= e(Lang::ui($lang, 'categories')) ?></h4>
        <ul>
          <?php foreach ($cats as $c): ?>
            <li><a href="<?= e(Lang::categoryUrl($lang, $c)) ?>"><?= Lang::categoryIcon($c) ?> <?= e(Lang::categoryName($lang, $c)) ?></a></li>
          <?php endforeach; ?>
        </ul>
      </div>
    </div>
    <p class="disclaimer"><?= e(Lang::ui($lang, 'disclaimer')) ?></p>
    <p class="disclaimer">© <?= date('Y') ?> egglee</p>
  </div>
</footer>
