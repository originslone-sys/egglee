<?php
use App\Support\Lang;
use function App\Core\e;
/** @var array $card */ /** @var string $lang */
?>
<a class="acard" href="<?= e($card['href']) ?>">
  <div class="acard__media">
    <?php if (!empty($card['image'])): ?>
      <img src="<?= e($card['image']) ?>" alt="" loading="lazy">
    <?php else: ?>
      <span class="acard__icon"><?= Lang::categoryIcon($card['category'] ?? '') ?></span>
    <?php endif; ?>
  </div>
  <div class="acard__body">
    <span class="acard__cat"><?= e(Lang::categoryName($lang, $card['category'] ?? '')) ?></span>
    <h3><?= e($card['h1']) ?></h3>
  </div>
</a>
