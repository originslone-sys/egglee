<?php
declare(strict_types=1);

/**
 * Front controller da egglee. O .htaccess envia todas as requisições para cá.
 * Document root = esta pasta (public/). O código da app fica em ../app (fora da web).
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

$root = dirname(__DIR__);

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

    // ---- admin ----
    if ($path === '/admin' || str_starts_with($path, '/admin/')) {
        $admin = new AdminController();
        match (true) {
            $path === '/admin'                          => $admin->dashboard(),
            $path === '/admin/login' && $method==='GET' => $admin->loginForm(),
            $path === '/admin/login' && $method==='POST'=> $admin->login(),
            $path === '/admin/logout'                   => $admin->logout(),
            $path === '/admin/create' && $method==='POST'=> $admin->create(),
            $path === '/admin/edit'                     => $admin->edit(),
            $path === '/admin/update' && $method==='POST'=> $admin->update(),
            $path === '/admin/status' && $method==='POST'=> $admin->status(),
            default                                     => $pub->notFound(),
        };
        exit;
    }

    // ---- público: /{lang} ou /{lang}/{slug} ----
    $segments = array_values(array_filter(explode('/', $path), fn($s) => $s !== ''));
    if (count($segments) === 1 && Lang::isValid($segments[0])) {
        $pub->home($segments[0]);
        exit;
    }
    if (count($segments) === 2 && Lang::isValid($segments[0])) {
        $pub->article($segments[0], $segments[1]);
        exit;
    }

    $pub->notFound();
} catch (\Throwable $e) {
    http_response_code(500);
    $debug = Env::get('APP_DEBUG') === '1';
    echo $debug ? '<pre>' . htmlspecialchars((string) $e) . '</pre>' : 'Erro interno.';
}
