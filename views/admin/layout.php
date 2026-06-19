<?php
use App\Core\Auth;
use function App\Core\e;
$user = Auth::user();
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
  <link rel="stylesheet" href="/admin.css">
</head>
<body class="admin">
  <header class="admin-top">
    <a class="admin-brand" href="/admin"><img src="/logo.svg" alt="egglee" height="28"> <span>admin</span></a>
    <nav>
      <a href="/admin">Painel</a>
      <a href="/admin/dictionary">Dicionário</a>
      <a href="/pt" target="_blank" rel="noopener">Ver site ↗</a>
      <a href="/admin/logout">Sair (<?= e($user['username'] ?? '') ?>)</a>
    </nav>
  </header>
  <main class="admin-main">
    <?php if (!empty($flash)): ?><div class="alert ok"><?= e($flash) ?></div><?php endif; ?>
    <?php if (!empty($error)): ?><div class="alert err"><?= e($error) ?></div><?php endif; ?>
    <?= $content ?>
  </main>
</body>
</html>
