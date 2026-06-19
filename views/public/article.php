<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */ /** @var array $c */ /** @var array $related */
?>
<main class="wrap article">
  <p class="breadcrumbs"><a href="/<?= e($lang) ?>"><?= e(Lang::ui($lang, 'home')) ?></a> › <?= e($c['h1']) ?></p>
  <h1><?= e($c['h1']) ?></h1>

  <aside class="quick-answer">
    <strong><?= e(Lang::ui($lang, 'quickAnswer')) ?></strong>
    <p><?= e($c['quick_answer']) ?></p>
  </aside>

  <?php foreach (preg_split('/\n+/', (string) $c['intro']) as $p): if (trim($p) === '') continue; ?>
    <p><?= e($p) ?></p>
  <?php endforeach; ?>

  <?php foreach (($c['sections'] ?? []) as $s): ?>
    <section>
      <h2><?= e($s['heading'] ?? '') ?></h2>
      <p><?= e($s['body'] ?? '') ?></p>
    </section>
  <?php endforeach; ?>

  <section>
    <h2><?= e(Lang::ui($lang, 'variations')) ?></h2>
    <ul class="variations">
      <?php foreach (($c['variations'] ?? []) as $v): ?>
        <li><strong><?= e($v['keyword'] ?? '') ?>:</strong> <?= e($v['meaning'] ?? '') ?></li>
      <?php endforeach; ?>
    </ul>
  </section>

  <section class="faq">
    <h2><?= e(Lang::ui($lang, 'faq')) ?></h2>
    <?php foreach (($c['faq'] ?? []) as $f): ?>
      <details>
        <summary><?= e($f['question'] ?? '') ?></summary>
        <p><?= e($f['answer'] ?? '') ?></p>
      </details>
    <?php endforeach; ?>
  </section>

  <p class="closing"><?= e($c['closing']) ?></p>

  <?php if ($related): ?>
    <nav class="related">
      <h2><?= e(Lang::ui($lang, 'related')) ?></h2>
      <ul>
        <?php foreach ($related as $r): ?>
          <li><a href="<?= e($r['href']) ?>"><?= e($r['label']) ?></a></li>
        <?php endforeach; ?>
      </ul>
    </nav>
  <?php endif; ?>
</main>
