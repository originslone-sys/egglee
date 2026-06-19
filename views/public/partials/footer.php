<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */
?>
<footer class="site-footer">
  <div class="site-footer__inner">
    <p class="foot-brand">egglee</p>
    <p class="disclaimer"><?= e(Lang::ui($lang, 'disclaimer')) ?></p>
    <p class="disclaimer">© <?= date('Y') ?> egglee</p>
  </div>
</footer>
