<?php
declare(strict_types=1);

namespace App\Controller;

use App\Core\Auth;
use App\Core\View;
use App\Repository\SymbolRepository;
use App\Repository\GenerationQueue;
use App\Service\Generator;
use App\Support\Dictionary;
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
            'queue'   => GenerationQueue::counts(),
            'errors'  => GenerationQueue::recentErrors(5),
            'csrf'    => Auth::csrf(),
            'flash'   => $_GET['flash'] ?? null,
            'error'   => $_GET['error'] ?? null,
        ], 'admin/layout');
    }

    // ---------- dicionário: filtrar e escolher o que gerar ----------
    public function dictionary(): void
    {
        Auth::require();
        $cat = $_GET['cat'] ?? '';
        $q   = trim($_GET['q'] ?? '');

        $items = Dictionary::all();
        if ($cat !== '') {
            $items = array_values(array_filter($items, fn($i) => $i['category'] === $cat));
        }
        if ($q !== '') {
            $needle = mb_strtolower($q);
            $items = array_values(array_filter(
                $items,
                fn($i) => str_contains(mb_strtolower($i['id'] . ' ' . $i['en']), $needle)
            ));
        }

        echo View::render('admin/dictionary', [
            'items'       => $items,
            'categories'  => Dictionary::categories(),
            'cat'         => $cat,
            'q'           => $q,
            'createdMap'  => $this->repo->statusMap(),          // id => status do símbolo já criado
            'queueMap'    => GenerationQueue::statusByConcept(), // id => pending/processing/error
            'csrf'        => Auth::csrf(),
            'flash'       => $_GET['flash'] ?? null,
            'error'       => $_GET['error'] ?? null,
        ], 'admin/layout');
    }

    // ---------- enfileirar conceitos selecionados ----------
    public function enqueue(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/dictionary?error=' . rawurlencode('Token inválido.'));
        }
        $ids = (array) ($_POST['ids'] ?? []);
        $n = 0;
        foreach ($ids as $cid) {
            $item = Dictionary::find((string) $cid);
            if ($item && GenerationQueue::enqueue($item['id'], $item['category'], $item['en'])) {
                $n++;
            }
        }
        $back = '/admin/dictionary?' . http_build_query(['cat' => $_POST['cat'] ?? '', 'q' => $_POST['q'] ?? '']);
        $this->redirect($back . '&flash=' . rawurlencode("$n conceito(s) enfileirado(s) para geração."));
    }

    // ---------- processar a fila agora (sem cron) ----------
    public function processNow(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin?error=' . rawurlencode('Token inválido.'));
        }
        @set_time_limit(0);
        ignore_user_abort(true);
        [$done, $err] = (new Generator())->processPending(1);
        $this->redirect('/admin?flash=' . rawurlencode("Processado: $done ok, $err erro(s)."));
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

    private function redirect(string $to): never
    {
        header("Location: $to");
        exit;
    }
}
