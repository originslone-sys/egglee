<?php
declare(strict_types=1);

/**
 * Instalador da egglee — rode UMA vez após o primeiro deploy.
 *
 * Faz tudo pelo navegador (sem phpMyAdmin/SSH):
 *   1. testa a conexão MySQL
 *   2. grava o .env
 *   3. cria as tabelas (database/schema.sql)
 *   4. importa o conteúdo de exemplo
 *   5. cria o usuário admin
 *   6. trava-se (database/.installed) para não rodar de novo
 *
 * Depois de instalar, apague este arquivo do servidor por segurança
 * (ou deixe — o lock impede reexecução).
 */

$root = __DIR__;
$lock = "$root/database/.installed";

// Autoloader mínimo
spl_autoload_register(static function (string $class) use ($root): void {
    if (!str_starts_with($class, 'App\\')) return;
    $file = "$root/app/" . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) require $file;
});
require "$root/app/Core/View.php";

use App\Core\Env;
use App\Core\Database;
use App\Core\Installed;
use App\Repository\SymbolRepository;
use function App\Core\e;

// Carrega o .env (se existir) para permitir a detecção via banco.
Env::load("$root/.env");

// Já instalado se: trava em arquivo OU as tabelas já existem no banco.
$alreadyInstalled = Installed::check($root);
$errors = [];
$done = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$alreadyInstalled) {
    $in = static fn(string $k, string $d = '') => trim((string) ($_POST[$k] ?? $d));

    $cfg = [
        'DB_HOST' => $in('db_host', 'localhost'),
        'DB_PORT' => $in('db_port', '3306'),
        'DB_NAME' => $in('db_name'),
        'DB_USER' => $in('db_user'),
        'DB_PASS' => (string) ($_POST['db_pass'] ?? ''),
        'SITE_URL' => rtrim($in('site_url'), '/'),
        'DEEPSEEK_API_KEY' => (string) ($_POST['deepseek_key'] ?? ''),
    ];
    $adminUser = $in('admin_user');
    $adminPass = (string) ($_POST['admin_pass'] ?? '');

    if ($cfg['DB_NAME'] === '' || $cfg['DB_USER'] === '') {
        $errors[] = 'Informe nome e usuário do banco.';
    }
    if ($adminUser === '' || strlen($adminPass) < 8) {
        $errors[] = 'Usuário admin e senha (mínimo 8 caracteres) são obrigatórios.';
    }

    // 1) testa conexão
    $pdo = null;
    if (!$errors) {
        try {
            $dsn = "mysql:host={$cfg['DB_HOST']};port={$cfg['DB_PORT']};dbname={$cfg['DB_NAME']};charset=utf8mb4";
            $pdo = new PDO($dsn, $cfg['DB_USER'], $cfg['DB_PASS'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (\Throwable $ex) {
            $errors[] = 'Falha ao conectar no MySQL: ' . $ex->getMessage();
        }
    }

    // 2) grava .env
    if (!$errors) {
        $env = "# Gerado pelo instalador da egglee em " . date('c') . "\n"
            . "DEEPSEEK_API_KEY={$cfg['DEEPSEEK_API_KEY']}\n"
            . "DEEPSEEK_MODEL=deepseek-reasoner\n"
            . "DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions\n"
            . "SITE_URL={$cfg['SITE_URL']}\n"
            . "DB_HOST={$cfg['DB_HOST']}\n"
            . "DB_PORT={$cfg['DB_PORT']}\n"
            . "DB_NAME={$cfg['DB_NAME']}\n"
            . "DB_USER={$cfg['DB_USER']}\n"
            . "DB_PASS={$cfg['DB_PASS']}\n"
            . "APP_DEBUG=0\n";
        if (@file_put_contents("$root/.env", $env) === false) {
            $errors[] = 'Não consegui gravar o .env (permissão de escrita na raiz?).';
        }
    }

    // 3) schema, 4) seed, 5) admin, 6) lock
    if (!$errors && $pdo instanceof PDO) {
        try {
            runSql($pdo, (string) file_get_contents("$root/database/schema.sql"));

            // bootstrap do app com o .env recém-criado
            Env::load("$root/.env");
            $repo = new SymbolRepository();
            foreach (glob("$root/database/seed/*.json") ?: [] as $file) {
                $data = json_decode((string) file_get_contents($file), true);
                if (is_array($data) && !empty($data['id'])) {
                    $repo->save($data['id'], $data['category'] ?? 'objects', $data['related'] ?? [], $data['languages'] ?? [], $data['model'] ?? 'seed');
                    $repo->setStatus($data['id'], $data['status'] ?? 'reviewed');
                }
            }

            $hash = password_hash($adminPass, PASSWORD_DEFAULT);
            Database::pdo()->prepare(
                'INSERT INTO admin_users (username, password_hash, role) VALUES (?,?,"admin")
                 ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)'
            )->execute([$adminUser, $hash]);

            file_put_contents($lock, "instalado em " . date('c') . "\n");
            $done = true;
        } catch (\Throwable $ex) {
            $errors[] = 'Erro durante a instalação: ' . $ex->getMessage();
        }
    }
}

/** Executa um arquivo .sql (remove comentários "--" e divide em statements). */
function runSql(PDO $pdo, string $sql): void
{
    $lines = preg_split('/\r?\n/', $sql) ?: [];
    $clean = array_filter($lines, static fn($l) => !preg_match('/^\s*--/', $l));
    $sql = implode("\n", $clean);
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
        if ($stmt !== '') {
            $pdo->exec($stmt);
        }
    }
}

// valores padrão do formulário (NÃO pré-preenche a senha)
$d = [
    'db_host' => 'localhost',
    'db_port' => '3306',
    'db_name' => 'u740938289_egg',
    'db_user' => 'u740938289_egg_user',
    'site_url' => (($_SERVER['HTTPS'] ?? '') === 'on' ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? ''),
];
?><!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Instalador — egglee</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/admin.css">
</head>
<body class="admin admin-login-page">
  <div class="login-card" style="max-width:520px;text-align:left;">
    <div style="text-align:center;"><img src="/favicon.svg" alt="" width="56" height="56"><h1>Instalador egglee</h1></div>

    <?php if ($alreadyInstalled): ?>
      <div class="alert ok">Já instalado. Para reinstalar, apague <code>database/.installed</code> no servidor.</div>
      <p><a class="btn" href="/pt">Ver site</a> <a class="btn btn-primary" href="/admin">Ir para o admin</a></p>

    <?php elseif ($done): ?>
      <div class="alert ok">Instalação concluída! 🎉</div>
      <p><strong>Apague o arquivo <code>install.php</code> do servidor</strong> por segurança.</p>
      <p><a class="btn" href="/pt">Ver site</a> <a class="btn btn-primary" href="/admin">Entrar no admin</a></p>

    <?php else: ?>
      <?php foreach ($errors as $err): ?><div class="alert err"><?= e($err) ?></div><?php endforeach; ?>
      <p class="hint">Preencha com os dados do MySQL da Hostinger e crie seu acesso ao painel.</p>
      <form method="post">
        <h3>Banco de dados</h3>
        <label>Host <input name="db_host" value="<?= e($d['db_host']) ?>"></label>
        <label>Porta <input name="db_port" value="<?= e($d['db_port']) ?>"></label>
        <label>Nome do banco <input name="db_name" value="<?= e($d['db_name']) ?>" required></label>
        <label>Usuário <input name="db_user" value="<?= e($d['db_user']) ?>" required></label>
        <label>Senha <input type="password" name="db_pass" autocomplete="off"></label>

        <h3>Site</h3>
        <label>URL do site <input name="site_url" value="<?= e($d['site_url']) ?>"></label>
        <label>DeepSeek API Key (opcional) <input name="deepseek_key" autocomplete="off" placeholder="sk-..."></label>

        <h3>Acesso ao painel</h3>
        <label>Usuário admin <input name="admin_user" value="admin" required></label>
        <label>Senha admin (mín. 8) <input type="password" name="admin_pass" required></label>

        <button type="submit" class="btn btn-primary" style="margin-top:1rem;">Instalar</button>
      </form>
    <?php endif; ?>
  </div>
</body>
</html>
