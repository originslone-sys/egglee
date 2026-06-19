<?php
declare(strict_types=1);

namespace App\Controller;

use App\Core\Auth;
use App\Core\Database;
use App\Core\View;
use App\Repository\SymbolRepository;
use App\Service\DeepSeek;
use App\Support\Lang;

/** Painel administrativo. */
final class AdminController
{
    public function __construct(private SymbolRepository $repo = new SymbolRepository()) {}

    // ---------- auth ----------
    public function loginForm(): void
    {
        if (Auth::check()) {
            $this->redirect('/admin');
        }
        echo View::render('admin/login', [
            'csrf'  => Auth::csrf(),
            'error' => $_GET['e'] ?? null,
        ], 'admin/layout_blank');
    }

    public function login(): void
    {
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/login?e=1');
        }
        $ok = Auth::attempt(trim($_POST['username'] ?? ''), $_POST['password'] ?? '');
        $this->redirect($ok ? '/admin' : '/admin/login?e=1');
    }

    public function logout(): void
    {
        Auth::logout();
        $this->redirect('/admin/login');
    }

    // ---------- dashboard ----------
    public function dashboard(): void
    {
        Auth::require();
        echo View::render('admin/dashboard', [
            'symbols' => $this->repo->listAll(),
            'csrf'    => Auth::csrf(),
            'flash'   => $_GET['flash'] ?? null,
            'error'   => $_GET['error'] ?? null,
        ], 'admin/layout');
    }

    // ---------- criar + gerar via IA ----------
    public function create(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin?error=' . rawurlencode('Token inválido.'));
        }

        $id       = \App\Service\Slug::make($_POST['id'] ?? '');
        $category = trim($_POST['category'] ?? 'objects');
        $related  = array_values(array_filter(array_map('trim', explode(',', $_POST['related'] ?? ''))));
        $terms    = [
            'pt' => trim($_POST['term_pt'] ?? ''),
            'es' => trim($_POST['term_es'] ?? ''),
            'en' => trim($_POST['term_en'] ?? ''),
        ];

        if ($id === '' || $terms['pt'] === '' || $terms['es'] === '' || $terms['en'] === '') {
            $this->redirect('/admin?error=' . rawurlencode('Preencha id e os termos nos 3 idiomas.'));
        }

        $languages = [];
        $model = \App\Core\Env::get('DEEPSEEK_MODEL', 'deepseek-reasoner');
        foreach (Lang::LANGS as $lang) {
            try {
                $languages[$lang] = DeepSeek::generate($id, $category, $terms[$lang], $lang, $related);
                $this->log($id, $lang, $model, true, null);
            } catch (\Throwable $e) {
                $this->log($id, $lang, $model, false, $e->getMessage());
                $this->redirect('/admin?error=' . rawurlencode("Falha ao gerar [$lang]: " . $e->getMessage()));
            }
        }

        try {
            $this->repo->save($id, $category, $related, $languages, $model);
        } catch (\Throwable $e) {
            $this->redirect('/admin?error=' . rawurlencode('Falha ao salvar: ' . $e->getMessage()));
        }
        $this->redirect("/admin/edit?id=$id&flash=" . rawurlencode('Gerado como rascunho. Revise e publique.'));
    }

    // ---------- editar ----------
    public function edit(): void
    {
        Auth::require();
        $id = $_GET['id'] ?? '';
        $sym = $this->repo->find($id);
        if (!$sym) {
            $this->redirect('/admin?error=' . rawurlencode('Símbolo não encontrado.'));
        }
        echo View::render('admin/edit', [
            'sym'   => $sym,
            'csrf'  => Auth::csrf(),
            'flash' => $_GET['flash'] ?? null,
            'error' => $_GET['error'] ?? null,
        ], 'admin/layout');
    }

    public function update(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin?error=' . rawurlencode('Token inválido.'));
        }
        $id  = $_POST['id'] ?? '';
        $sym = $this->repo->find($id);
        if (!$sym) {
            $this->redirect('/admin?error=' . rawurlencode('Símbolo não encontrado.'));
        }

        $languages = [];
        foreach (Lang::LANGS as $lang) {
            $f = $_POST[$lang] ?? [];
            $languages[$lang] = [
                'slug'            => \App\Service\Slug::make($f['slug'] ?? ''),
                'title'           => trim($f['title'] ?? ''),
                'metaDescription' => trim($f['metaDescription'] ?? ''),
                'h1'              => trim($f['h1'] ?? ''),
                'quickAnswer'     => trim($f['quickAnswer'] ?? ''),
                'intro'           => trim($f['intro'] ?? ''),
                'sections'        => $this->decodeJsonField($f['sections'] ?? '[]'),
                'variations'      => $this->decodeJsonField($f['variations'] ?? '[]'),
                'faq'             => $this->decodeJsonField($f['faq'] ?? '[]'),
                'closing'         => trim($f['closing'] ?? ''),
                'semanticKeywords'=> $this->decodeJsonField($f['semanticKeywords'] ?? '[]'),
            ];
        }
        $related = array_values(array_filter(array_map('trim', explode(',', $_POST['related'] ?? ''))));

        try {
            $this->repo->save($id, trim($_POST['category'] ?? $sym['category']), $related, $languages, $sym['model']);
        } catch (\Throwable $e) {
            $this->redirect("/admin/edit?id=$id&error=" . rawurlencode('Erro ao salvar: ' . $e->getMessage()));
        }
        $this->redirect("/admin/edit?id=$id&flash=" . rawurlencode('Salvo.'));
    }

    public function status(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin?error=' . rawurlencode('Token inválido.'));
        }
        $id = $_POST['id'] ?? '';
        $status = $_POST['status'] ?? 'draft';
        if (!in_array($status, ['draft', 'reviewed', 'published'], true)) {
            $status = 'draft';
        }
        $this->repo->setStatus($id, $status);
        $back = $_POST['back'] ?? '/admin';
        $this->redirect($back . (str_contains($back, '?') ? '&' : '?') . 'flash=' . rawurlencode("Status: $status"));
    }

    // ---------- helpers ----------
    private function decodeJsonField(string $raw): array
    {
        $v = json_decode($raw, true);
        return is_array($v) ? $v : [];
    }

    private function log(?string $symbolId, ?string $lang, ?string $model, bool $ok, ?string $error): void
    {
        try {
            Database::pdo()->prepare(
                'INSERT INTO generation_log (symbol_id, lang, model, ok, error) VALUES (?,?,?,?,?)'
            )->execute([$symbolId, $lang, $model, $ok ? 1 : 0, $error]);
        } catch (\Throwable) {
            // log é best-effort
        }
    }

    private function redirect(string $to): never
    {
        header("Location: $to");
        exit;
    }
}
