<?php
use App\Core\Env;
use App\Support\Lang;
use function App\Core\e;
use function App\Core\asset;

$site = rtrim((string) Env::get('SITE_URL', ''), '/');
$hl = Lang::HREFLANG;
$adsClient = Env::get('ADSENSE_CLIENT'); // ex.: ca-pub-XXXXXXXXXXXXXXXX
$consent = ($_COOKIE['egglee_consent'] ?? '') === '1';
$adsOn = $adsClient && $consent; // anúncios só com chave configurada E consentimento
$gaId = Env::get('GA_ID');               // GA4: ex. G-XXXXXXXXXX (só com consentimento)
$gscVerify = Env::get('GSC_VERIFICATION'); // token de verificação do Search Console
?><!doctype html>
<html lang="<?= e($hl[$lang] ?? 'pt-BR') ?>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php if ($gscVerify): ?><meta name="google-site-verification" content="<?= e($gscVerify) ?>"><?php endif; ?>
  <title><?= e($title) ?></title>
  <meta name="description" content="<?= e($description) ?>">
  <?php if (!empty($noindex ?? null)): ?><meta name="robots" content="noindex, follow"><?php endif; ?>
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
  <?php if (!empty($image ?? null)): ?>
  <meta property="og:image" content="<?= e($image) ?>">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="<?= e($image) ?>">
  <?php endif; ?>

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

  <?php if ($adsOn): ?>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<?= e($adsClient) ?>" crossorigin="anonymous"></script>
  <?php endif; ?>

  <?php if ($gaId && $consent): ?>
  <script async src="https://www.googletagmanager.com/gtag/js?id=<?= e($gaId) ?>"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', <?= json_encode($gaId, JSON_UNESCAPED_SLASHES) ?>);
  </script>
  <?php endif; ?>
</head>
<body>
  <?php include __DIR__ . '/partials/header.php'; ?>
  <?= $content ?>
  <?php include __DIR__ . '/partials/footer.php'; ?>

  <?php if (($_COOKIE['egglee_consent'] ?? '') === ''): ?>
  <div class="cookie-bar" id="cookie-bar">
    <p><?= e(Lang::ui($lang, 'cookieMsg')) ?> <a href="<?= e(\App\Support\Pages::url($lang, 'cookies')) ?>"><?= e(Lang::ui($lang, 'cookieMore')) ?></a></p>
    <div class="cookie-actions">
      <button type="button" data-consent="0" class="ck-btn ck-reject"><?= e(Lang::ui($lang, 'cookieReject')) ?></button>
      <button type="button" data-consent="1" class="ck-btn ck-accept"><?= e(Lang::ui($lang, 'cookieAccept')) ?></button>
    </div>
  </div>
  <script>
    document.querySelectorAll('#cookie-bar .ck-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-consent');
        document.cookie = 'egglee_consent=' + v + ';path=/;max-age=31536000;samesite=Lax';
        document.getElementById('cookie-bar').style.display = 'none';
        if (v === '1') location.reload(); // recarrega para ativar os anúncios
      });
    });
  </script>
  <?php endif; ?>
</body>
</html>
