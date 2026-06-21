<?php
declare(strict_types=1);

/**
 * Front controller da egglee. O .htaccess envia todas as requisições para cá.
 * Document root = a raiz do repositório (= public_html na Hostinger).
 * As pastas app/, views/, database/, scripts/ ficam protegidas por .htaccess próprio.
 */

use App\Core\Auth;
use App\Core\Env;
use App\Controller\PublicController;
use App\Controller\AdminController;
use App\Support\Lang;

// Servidor embutido do PHP (dev): deixa assets estáticos passarem direto.
if (PHP_SAPI === 'cli-server') {
    $f = __DIR__ . (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '');
    if ($f !== __DIR__ && is_file($f)) {
        return false;
    }
}

$root = __DIR__;

// Autoloader PSR-4 simples: App\ -> app/
spl_autoload_register(static function (string $class) use ($root): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $rel = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = "$root/app/$rel.php";
    if (is_file($file)) {
        require $file;
    }
});
require "$root/app/Core/View.php"; // garante o helper e()

Env::load("$root/.env");
Auth::start();

// ---- roteamento ----
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$path = '/' . trim(rawurldecode($path), '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Ainda não instalado? Manda para o instalador (rodar uma vez após o deploy).
// Detecção robusta: trava em arquivo OU tabelas já existentes no banco.
if (!\App\Core\Installed::check($root)) {
    header('Location: /install.php', true, 302);
    exit;
}

$pub = new PublicController();

try {
    // raiz -> idioma padrão
    if ($path === '/' || $path === '') {
        header('Location: /pt', true, 302);
        exit;
    }
    if ($path === '/sitemap.xml') {
        $pub->sitemap();
        exit;
    }
    if ($path === '/robots.txt') {
        $pub->robots();
        exit;
    }

    // ---- admin ----
    if ($path === '/admin' || str_starts_with($path, '/admin/')) {
        $admin = new AdminController();
        match (true) {
            $path === '/admin'                            => header('Location: /admin/generate', true, 302),
            $path === '/admin/login' && $method==='GET'   => $admin->loginForm(),
            $path === '/admin/login' && $method==='POST'  => $admin->login(),
            $path === '/admin/logout'                     => $admin->logout(),
            $path === '/admin/generate' && $method==='POST'=> $admin->generateRun(),
            $path === '/admin/generate'                   => $admin->generateForm(),
            $path === '/admin/auto' && $method==='POST'   => $admin->auto(),
            $path === '/admin/cron-toggle' && $method==='POST'=> $admin->cronToggle(),
            $path === '/admin/auto-publish' && $method==='POST'=> $admin->autoPublish(),
            $path === '/admin/auto-reset' && $method==='POST'=> $admin->autoReset(),
            $path === '/admin/articles'                   => $admin->articles(),
            $path === '/admin/diagnose'                   => $admin->diagnose(),
            $path === '/admin/set-model' && $method==='POST'=> $admin->setModel(),
            $path === '/admin/set-pexels' && $method==='POST'=> $admin->setPexels(),
            $path === '/admin/delete' && $method==='POST' => $admin->deleteSymbol(),
            $path === '/admin/image' && $method==='POST' => $admin->image(),
            $path === '/admin/edit'                       => $admin->edit(),
            $path === '/admin/update' && $method==='POST' => $admin->update(),
            $path === '/admin/status' && $method==='POST' => $admin->status(),
            default                                       => $pub->notFound(),
        };
        exit;
    }

    // ---- público ----
    $segments = array_values(array_filter(explode('/', $path), fn($s) => $s !== ''));
    $lang = $segments[0] ?? '';
    if (Lang::isValid($lang)) {
        $n = count($segments);
        if ($n === 1) {
            $pub->home($lang);
            exit;
        }
        if ($n === 2 && $segments[1] === Lang::SEARCH_PATH[$lang]) {
            $pub->search($lang);
            exit;
        }
        if ($n === 3 && $segments[1] === Lang::CATEGORY_PATH[$lang]) {
            $pub->category($lang, $segments[2]);
            exit;
        }
        if ($n === 2) {
            $pub->article($lang, $segments[1]);
            exit;
        }
    }

    $pub->notFound();
} catch (\Throwable $e) {
    http_response_code(500);
    // Registra sempre (arquivo legível pelo app), com trace completo.
    @file_put_contents(
        "$root/database/error.log", // pasta bloqueada por .htaccess e ignorada no git
        '[' . date('c') . '] ' . $e . "\n\n",
        FILE_APPEND
    );
    if (Env::get('APP_DEBUG') === '1') {
        echo '<pre>' . htmlspecialchars((string) $e) . '</pre>';
    } else {
        // Mostra só a mensagem (sem trace/paths) — diagnóstico sem expor o código.
        echo '<p>Erro interno.</p><p style="color:#a00;font-family:monospace">'
            . htmlspecialchars(get_class($e) . ': ' . $e->getMessage()) . '</p>';
    }
}
