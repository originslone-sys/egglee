<?php
use App\Core\Auth;
use function App\Core\e;
use function App\Core\asset;
$user = Auth::user();
// item de menu ativo a partir da URL atual
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/admin', PHP_URL_PATH) ?? '';
$nav = [
    ['/admin/generate', 'Gerador',     '✦'],
    ['/admin/articles', 'Artigos',     '☰'],
    ['/admin/diagnose', 'Diagnóstico', '⚙'],
];
$isActive = static function (string $href) use ($path): bool {
    return $path === $href || ($href !== '/admin' && str_starts_with($path, $href));
};
?><!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($title ?? 'Admin') ?> — egglee</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Nunito:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="<?= e(asset('admin.css')) ?>">
</head>
<body class="admin">
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <a class="side-brand" href="/admin/generate"><img src="/logo.svg" alt="egglee" height="26"> <span>admin</span></a>
      <nav class="side-nav">
        <?php foreach ($nav as [$href, $label, $icon]): ?>
          <a href="<?= e($href) ?>" class="<?= $isActive($href) ? 'active' : '' ?>"><span class="ico"><?= $icon ?></span><?= e($label) ?></a>
        <?php endforeach; ?>
      </nav>
      <div class="side-foot">
        <a href="/pt" target="_blank" rel="noopener">Ver site ↗</a>
        <a href="/admin/logout">Sair (<?= e($user['username'] ?? '') ?>)</a>
      </div>
    </aside>

    <main class="admin-content">
      <?php if (!empty($flash)): ?><div class="alert ok"><?= e($flash) ?></div><?php endif; ?>
      <?php if (!empty($error)): ?><div class="alert err"><?= e($error) ?></div><?php endif; ?>
      <?= $content ?>
    </main>
  </div>
</body>
</html>
