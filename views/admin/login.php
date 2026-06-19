<?php use function App\Core\e; ?>
<div class="login-card">
  <img src="/favicon.svg" alt="" width="56" height="56">
  <h1>egglee admin</h1>
  <?php if (!empty($error)): ?><div class="alert err">Usuário ou senha inválidos.</div><?php endif; ?>
  <form method="post" action="/admin/login">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
    <label>Usuário
      <input type="text" name="username" autocomplete="username" required autofocus>
    </label>
    <label>Senha
      <input type="password" name="password" autocomplete="current-password" required>
    </label>
    <button type="submit" class="btn btn-primary">Entrar</button>
  </form>
</div>
