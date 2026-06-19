<?php use function App\Core\e; ?><!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($title ?? 'Login') ?> — egglee admin</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Nunito:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/admin.css">
</head>
<body class="admin admin-login-page">
  <?= $content ?>
</body>
</html>
