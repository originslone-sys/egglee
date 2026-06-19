<?php
declare(strict_types=1);

namespace App\Core;

/** Sessão de admin: login por usuário/senha (hash), guarda de rotas. */
final class Auth
{
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_NONE) {
            session_set_cookie_params([
                'httponly' => true,
                'samesite' => 'Lax',
                'secure'   => (($_SERVER['HTTPS'] ?? '') === 'on'),
            ]);
            session_start();
        }
    }

    public static function attempt(string $username, string $password): bool
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, username, password_hash, role FROM admin_users WHERE username = ? LIMIT 1'
        );
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            return false;
        }
        session_regenerate_id(true);
        $_SESSION['admin'] = ['id' => $user['id'], 'username' => $user['username'], 'role' => $user['role']];
        return true;
    }

    public static function check(): bool
    {
        return isset($_SESSION['admin']);
    }

    public static function user(): ?array
    {
        return $_SESSION['admin'] ?? null;
    }

    public static function logout(): void
    {
        $_SESSION = [];
        session_destroy();
    }

    /** Redireciona para o login se não autenticado. */
    public static function require(): void
    {
        if (!self::check()) {
            header('Location: /admin/login');
            exit;
        }
    }

    /** Token CSRF para formulários do admin. */
    public static function csrf(): string
    {
        if (empty($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(16));
        }
        return $_SESSION['csrf'];
    }

    public static function checkCsrf(?string $token): bool
    {
        return is_string($token) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
    }
}
