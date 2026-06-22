<?php
use App\Support\Lang;
use function App\Core\e;
/** @var string $lang */ /** @var array $c */ /** @var array $related */
?>
<main class="wrap article">
  <p class="breadcrumbs">
    <a href="/<?= e($lang) ?>"><?= e(Lang::ui($lang, 'home')) ?></a> ›
    <a href="<?= e(Lang::categoryUrl($lang, (string) ($c['category'] ?? ''))) ?>"><?= e(Lang::categoryName($lang, (string) ($c['category'] ?? ''))) ?></a> ›
    <?php if (!empty($parentInfo)): ?>
      <a href="<?= e($parentInfo['href']) ?>"><?= e($parentInfo['h1']) ?></a> ›
    <?php endif; ?>
    <?= e($c['h1']) ?>
  </p>
  <h1><?= e($c['h1']) ?></h1>

  <?php if (!empty($c['updated_at'])): ?>
    <p class="article-meta">
      <time datetime="<?= e(date('Y-m-d', strtotime((string) $c['updated_at']))) ?>">
        <?= e(Lang::ui($lang, 'updatedOn')) ?> <?= e(Lang::formatDate($lang, (string) $c['updated_at'])) ?>
      </time>
    </p>
  <?php endif; ?>

  <?php if (!empty($c['image_url'])): ?>
    <figure class="article-hero">
      <img src="<?= e($c['image_url']) ?>" alt="<?= e($c['h1']) ?>" loading="eager" width="940" height="600">
      <?php if (!empty($c['image_photographer'])): ?>
        <figcaption>Foto: <a href="<?= e($c['image_photographer_url']) ?>" rel="nofollow noopener" target="_blank"><?= e($c['image_photographer']) ?></a> / <a href="https://www.pexels.com" rel="nofollow noopener" target="_blank">Pexels</a></figcaption>
      <?php endif; ?>
    </figure>
  <?php endif; ?>

  <aside class="quick-answer">
    <strong><?= e(Lang::ui($lang, 'quickAnswer')) ?></strong>
    <p><?= e($c['quick_answer']) ?></p>
  </aside>

  <?php foreach (preg_split('/\n+/', (string) $c['intro']) as $p): if (trim($p) === '') continue; ?>
    <p><?= e($p) ?></p>
  <?php endforeach; ?>

  <?php include __DIR__ . '/partials/ad.php'; /* anúncio no meio do conteúdo */ ?>

  <?php foreach (($c['sections'] ?? []) as $s): ?>
    <section>
      <h2><?= e($s['heading'] ?? '') ?></h2>
      <p><?= e($s['body'] ?? '') ?></p>
    </section>
  <?php endforeach; ?>

  <?php $tbl = $c['table_data'] ?? null; if (is_array($tbl) && !empty($tbl['rows'])): ?>
    <section>
      <?php if (!empty($tbl['title'])): ?><h2><?= e($tbl['title']) ?></h2><?php endif; ?>
      <table class="meaning-table">
        <tbody>
          <?php foreach ($tbl['rows'] as $row): ?>
            <tr><th scope="row"><?= e($row['label'] ?? '') ?></th><td><?= e($row['meaning'] ?? '') ?></td></tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </section>
  <?php endif; ?>

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

  <?php if (!empty($parentInfo)): ?>
    <p class="parent-back"><a href="<?= e($parentInfo['href']) ?>">← <?= e($parentInfo['h1']) ?></a></p>
  <?php endif; ?>

  <?php if (!empty($children)): ?>
    <section class="variations-hub">
      <h2><?= e(Lang::ui($lang, 'variations')) ?></h2>
      <div class="acard-grid">
        <?php foreach ($children as $card) { include __DIR__ . '/partials/card.php'; } ?>
      </div>
    </section>
  <?php endif; ?>

  <?php if (!empty($suggested)): ?>
    <section class="suggested">
      <h2><?= e(Lang::ui($lang, 'related')) ?></h2>
      <div class="acard-grid">
        <?php foreach ($suggested as $card) { include __DIR__ . '/partials/card.php'; } ?>
      </div>
      <p class="suggested__more">
        <a class="btn-more" href="<?= e(Lang::categoryUrl($lang, (string) $c['category'])) ?>">
          <?= e(Lang::ui($lang, 'inCategory')) ?> <?= e(Lang::categoryName($lang, (string) $c['category'])) ?> →
        </a>
      </p>
    </section>
  <?php endif; ?>
</main>
