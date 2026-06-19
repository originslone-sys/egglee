<?php
use App\Core\Env;
use App\Support\Lang;
use function App\Core\e;
use function App\Core\asset;

$site = rtrim((string) Env::get('SITE_URL', ''), '/');
$hl = Lang::HREFLANG;
?><!doctype html>
<html lang="<?= e($hl[$lang] ?? 'pt-BR') ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($title) ?></title>
  <meta name="description" content="<?= e($description) ?>">
  <link rel="canonical" href="<?= e($site . $canonical) ?>">
  <?php foreach (($alternates ?? []) as $l => $p): ?>
  <link rel="alternate" hreflang="<?= e($hl[$l]) ?>" href="<?= e($site . $p) ?>">
  <?php endforeach; ?>
  <?php if (!empty($alternates['pt'])): ?>
  <link rel="alternate" hreflang="x-default" href="<?= e($site . $alternates['pt']) ?>">
  <?php endif; ?>

  <meta property="og:type" content="article">
  <meta property="og:title" content="<?= e($title) ?>">
  <meta property="og:description" content="<?= e($description) ?>">
  <meta property="og:url" content="<?= e($site . $canonical) ?>">

  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#1c1745">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Nunito:wght@400;700&display=swap" rel="stylesheet">

  <?php foreach (($jsonLd ?? []) as $block): ?>
  <script type="application/ld+json"><?= json_encode($block, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
  <?php endforeach; ?>

  <link rel="stylesheet" href="<?= e(asset('styles.css')) ?>">
</head>
<body>
  <?php include __DIR__ . '/partials/header.php'; ?>
  <?= $content ?>
  <?php include __DIR__ . '/partials/footer.php'; ?>
</body>
</html>
