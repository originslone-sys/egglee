<?php
declare(strict_types=1);

namespace App\Controller;

use App\Core\Auth;
use App\Core\View;
use App\Repository\SymbolRepository;
use App\Service\DeepSeek;
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

    // ---------- Artigos gerados ----------
    public function articles(): void
    {
        Auth::require();
        $perPage = 50;
        $total = $this->repo->countAll();
        $pages = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($pages, (int) ($_GET['page'] ?? 1)));
        echo View::render('admin/articles', [
            'symbols' => $this->repo->listAll($perPage, ($page - 1) * $perPage),
            'page'    => $page,
            'pages'   => $pages,
            'total'   => $total,
            'csrf'    => Auth::csrf(),
            'flash'   => $_GET['flash'] ?? null,
            'error'   => $_GET['error'] ?? null,
        ], 'admin/layout');
    }

    // ---------- Gerador (formulário) ----------
    public function generateForm(): void
    {
        Auth::require();
        \App\Core\Migrate::ensure();
        echo View::render('admin/generate', [
            'grouped'  => Dictionary::grouped(),
            'results'  => null,
            'symbolId' => null,
            'auto'     => (new \App\Service\AutoGenerator())->progress(),
            'autoPublish' => \App\Core\Env::get('AUTO_PUBLISH', '1') !== '0',
            'cronEnabled' => \App\Core\Env::get('CRON_ENABLED', '1') !== '0',
            'lastRun'  => @json_decode((string) @file_get_contents(dirname(__DIR__, 2) . '/database/last-run.json'), true) ?: null,
            'failures' => \App\Repository\AutoStatus::failures(10),
            'projectDir' => dirname(__DIR__, 2),
            'csrf'     => Auth::csrf(),
            'flash'    => $_GET['flash'] ?? null,
            'error'    => $_GET['error'] ?? null,
        ], 'admin/layout');
    }

    // ---------- Automação: gerar o próximo agora ----------
    public function auto(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/generate?error=' . rawurlencode('Token inválido.'));
        }
        @set_time_limit(0);
        ignore_user_abort(true);
        \App\Core\Migrate::ensure();
        $gen = new \App\Service\AutoGenerator();
        $r = $gen->tick(1);
        // Renderiza com o log detalhado (mostra exatamente o que aconteceu).
        echo View::render('admin/generate', [
            'grouped'  => Dictionary::grouped(),
            'results'  => null,
            'symbolId' => null,
            'auto'     => $gen->progress(),
            'autoPublish' => \App\Core\Env::get('AUTO_PUBLISH', '1') !== '0',
            'cronEnabled' => \App\Core\Env::get('CRON_ENABLED', '1') !== '0',
            'lastRun'  => @json_decode((string) @file_get_contents(dirname(__DIR__, 2) . '/database/last-run.json'), true) ?: null,
            'failures' => \App\Repository\AutoStatus::failures(10),
            'projectDir' => dirname(__DIR__, 2),
            'runLog'   => $gen->lastLog(),
            'runResult'=> $r,
            'csrf'     => Auth::csrf(),
            'flash'    => "Execução: {$r['ok']} gerado(s), {$r['failedRun']} falha(s).",
            'error'    => null,
        ], 'admin/layout');
    }

    // ---------- Automação: ligar/desligar a geração automática (cron) ----------
    public function cronToggle(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/generate?error=' . rawurlencode('Token inválido.'));
        }
        $on = ($_POST['on'] ?? '1') === '1';
        \App\Core\EnvFile::set(dirname(__DIR__, 2), 'CRON_ENABLED', $on ? '1' : '0');
        $this->redirect('/admin/generate?flash=' . rawurlencode(
            $on ? 'Automação LIGADA: o cron volta a gerar a cada execução.'
                : 'Automação PAUSADA: o cron continua disparando, mas não gera nada.'
        ));
    }

    // ---------- Automação: ligar/desligar auto-publicação ----------
    public function autoPublish(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/generate?error=' . rawurlencode('Token inválido.'));
        }
        $on = ($_POST['on'] ?? '1') === '1';
        \App\Core\EnvFile::set(dirname(__DIR__, 2), 'AUTO_PUBLISH', $on ? '1' : '0');
        $this->redirect('/admin/generate?flash=' . rawurlencode(
            $on ? 'Auto-publicação LIGADA: novos artigos vão ao ar automaticamente.'
                : 'Auto-publicação DESLIGADA: novos artigos ficam como rascunho para revisão.'
        ));
    }

    // ---------- Automação: limpar falhas (tentar de novo) ----------
    public function autoReset(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/generate?error=' . rawurlencode('Token inválido.'));
        }
        \App\Repository\AutoStatus::clearAll();
        $this->redirect('/admin/generate?flash=' . rawurlencode('Falhas zeradas. Serão tentadas de novo.'));
    }

    // ---------- Gerador (executa, direto e síncrono) ----------
    public function generateRun(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/generate?error=' . rawurlencode('Token inválido.'));
        }
        @set_time_limit(0);
        ignore_user_abort(true);
        \App\Core\Migrate::ensure(); // garante a coluna table_data em bancos antigos

        $item = Dictionary::find((string) ($_POST['concept'] ?? ''));
        if (!$item) {
            $this->redirect('/admin/generate?error=' . rawurlencode('Conceito inválido.'));
        }
        $langSel = $_POST['lang'] ?? 'all';
        $langs = ($langSel !== 'all' && in_array($langSel, Lang::LANGS, true)) ? [$langSel] : Lang::LANGS;
        $related = Dictionary::siblings($item['id'], 3);
        $model = \App\Core\Env::get('DEEPSEEK_MODEL', 'deepseek-v4-flash');

        $results = [];
        foreach ($langs as $l) {
            $t0 = microtime(true);
            try {
                $content = DeepSeek::generate($item['id'], $item['category'], $item['en'], $l, $related);
                // A chamada à IA demora ~30s; a conexão pode ter expirado. Reconecta.
                \App\Core\Database::reconnect();
                $this->repo->ensureSymbol($item['id'], $item['category'], $related, $model);
                $this->repo->saveLanguage($item['id'], $l, $content);
                $results[] = ['lang' => $l, 'ok' => true, 'elapsed' => microtime(true) - $t0, 'error' => null];
            } catch (\Throwable $e) {
                $results[] = ['lang' => $l, 'ok' => false, 'elapsed' => microtime(true) - $t0, 'error' => $e->getMessage()];
            }
        }

        // Imagem (Pexels) — best-effort: nunca derruba a geração já concluída.
        try {
            if (\App\Service\Pexels::enabled() && !$this->repo->imageUrl($item['id'])) {
                $img = \App\Service\Pexels::search($item['en']) ?? \App\Service\Pexels::search($item['category']);
                if ($img) {
                    $this->repo->setImage($item['id'], $img);
                }
            }
        } catch (\Throwable $e) {
            // imagem é opcional; segue sem ela
        }

        \App\Core\PageCache::clear();

        echo View::render('admin/generate', [
            'grouped'  => Dictionary::grouped(),
            'results'  => $results,
            'symbolId' => $item['id'],
            'csrf'     => Auth::csrf(),
            'flash'    => null,
            'error'    => null,
        ], 'admin/layout');
    }

    // ---------- diagnóstico da IA ----------
    public function diagnose(): void
    {
        Auth::require();
        @set_time_limit(0);
        // Teste de geração real só quando pedido (?gen=1), pois é mais lento.
        $genTest = isset($_GET['gen']) ? DeepSeek::testGeneration(60) : null;
        echo View::render('admin/diagnose', [
            'result'  => DeepSeek::diagnose(),
            'genTest' => $genTest,
            'pexels'  => \App\Service\Pexels::enabled(),
            'adsense' => (string) \App\Core\Env::get('ADSENSE_CLIENT', ''),
            'adslot'  => (string) \App\Core\Env::get('ADSENSE_SLOT', ''),
            'contact' => (string) \App\Core\Env::get('CONTACT_EMAIL', ''),
            'gaId'    => (string) \App\Core\Env::get('GA_ID', ''),
            'gscVerify' => (string) \App\Core\Env::get('GSC_VERIFICATION', ''),
            'csrf'    => Auth::csrf(),
            'flash'   => $_GET['flash'] ?? null,
            'error'   => $_GET['error'] ?? null,
        ], 'admin/layout');
    }

    // ---------- salvar config de monetização/contato (grava no .env) ----------
    public function setMonetize(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/diagnose?error=' . rawurlencode('Token inválido.'));
        }
        $root = dirname(__DIR__, 2);
        \App\Core\EnvFile::set($root, 'ADSENSE_CLIENT', trim($_POST['adsense'] ?? ''));
        \App\Core\EnvFile::set($root, 'ADSENSE_SLOT', trim($_POST['adslot'] ?? ''));
        \App\Core\EnvFile::set($root, 'CONTACT_EMAIL', trim($_POST['contact'] ?? ''));
        \App\Core\EnvFile::set($root, 'GA_ID', trim($_POST['ga_id'] ?? ''));
        \App\Core\EnvFile::set($root, 'GSC_VERIFICATION', trim($_POST['gsc_verify'] ?? ''));
        \App\Core\PageCache::clear(); // anúncios/Analytics/verificação afetam o HTML cacheado
        $this->redirect('/admin/diagnose?flash=' . rawurlencode('Configurações salvas.'));
    }

    // ---------- trocar o modelo da IA (grava no .env) ----------
    public function setModel(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/diagnose?error=' . rawurlencode('Token inválido.'));
        }
        $model = trim($_POST['model'] ?? '');
        $allowed = ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'];
        if (!in_array($model, $allowed, true)) {
            $this->redirect('/admin/diagnose?error=' . rawurlencode('Modelo inválido.'));
        }
        $ok = \App\Core\EnvFile::set(dirname(__DIR__, 2), 'DEEPSEEK_MODEL', $model);
        $this->redirect('/admin/diagnose?' . ($ok
            ? 'flash=' . rawurlencode("Modelo alterado para $model.")
            : 'error=' . rawurlencode('Não consegui gravar o .env (permissão).')));
    }

    // ---------- salvar a chave do Pexels (grava no .env) ----------
    public function setPexels(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/diagnose?error=' . rawurlencode('Token inválido.'));
        }
        $key = trim($_POST['pexels_key'] ?? '');
        $ok = \App\Core\EnvFile::set(dirname(__DIR__, 2), 'PEXELS_API_KEY', $key);
        $this->redirect('/admin/diagnose?' . ($ok
            ? 'flash=' . rawurlencode('Chave do Pexels salva.')
            : 'error=' . rawurlencode('Não consegui gravar o .env (permissão).')));
    }

    // ---------- imagem: trocar / remover ----------
    public function image(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/articles?error=' . rawurlencode('Token inválido.'));
        }
        \App\Core\Migrate::ensure();
        $id  = $_POST['id'] ?? '';
        $op  = $_POST['op'] ?? 'change';
        $back = "/admin/edit?id=" . rawurlencode($id);

        if ($op === 'remove') {
            $this->repo->setImage($id, ['url' => null, 'photographer' => null, 'photographer_url' => null, 'page' => null]);
            \App\Core\PageCache::clear();
            $this->redirect($back . '&flash=' . rawurlencode('Imagem removida.'));
        }

        if (!\App\Service\Pexels::enabled()) {
            $this->redirect($back . '&error=' . rawurlencode('Configure a chave do Pexels no Diagnóstico.'));
        }
        // Termo: o que o usuário digitou, senão o conceito do dicionário.
        $query = trim($_POST['query'] ?? '');
        if ($query === '') {
            $item = Dictionary::find($id);
            $query = $item['en'] ?? $id;
        }
        $img = \App\Service\Pexels::search($query, true);
        if (!$img) {
            $this->redirect($back . '&error=' . rawurlencode('Nenhuma imagem encontrada para "' . $query . '".'));
        }
        $this->repo->setImage($id, $img);
        \App\Core\PageCache::clear();
        $this->redirect($back . '&flash=' . rawurlencode('Imagem atualizada.'));
    }

    // ---------- excluir símbolo ----------
    public function deleteSymbol(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin?error=' . rawurlencode('Token inválido.'));
        }
        $id = $_POST['id'] ?? '';
        if ($id !== '') {
            $this->repo->delete($id);
            \App\Core\PageCache::clear();
        }
        $this->redirect('/admin/articles?flash=' . rawurlencode("Símbolo \"$id\" excluído."));
    }

    // ---------- editar ----------
    public function edit(): void
    {
        Auth::require();
        \App\Core\Migrate::ensure();
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
        \App\Core\Migrate::ensure();
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
                'table'           => $this->decodeJsonField($f['table'] ?? 'null'),
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
        \App\Core\PageCache::clear();
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
        \App\Core\PageCache::clear();
        $back = $_POST['back'] ?? '/admin/articles';
        $this->redirect($back . (str_contains($back, '?') ? '&' : '?') . 'flash=' . rawurlencode("Status: $status"));
    }

    // ---------- atualizar a data ("atualizado em") dos artigos ----------
    public function refreshDates(): void
    {
        Auth::require();
        if (!Auth::checkCsrf($_POST['csrf'] ?? null)) {
            $this->redirect('/admin/generate?error=' . rawurlencode('Token inválido.'));
        }
        $days = max(0, (int) ($_POST['days'] ?? 30));
        $n = $this->repo->refreshStaleDates($days, 1000);
        \App\Core\PageCache::clear();
        $this->redirect('/admin/generate?flash=' . rawurlencode(
            $n > 0
                ? "Datas atualizadas em $n artigo(s) com mais de $days dia(s)."
                : 'Nenhum artigo estava desatualizado.'
        ));
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
