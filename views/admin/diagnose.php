<?php
use function App\Core\e;
/** @var array $result */ /** @var string $csrf */
$render = static function (array $r): string {
    if ($r['ok']) {
        return '<span class="badge b-pub">OK</span> ' . sprintf('%.1fs', $r['elapsed']) . ' — HTTP ' . (int) $r['http'];
    }
    return '<span class="badge b-err">FALHOU</span> ' . sprintf('%.1fs', $r['elapsed']) . ' — ' . e((string) $r['error']);
};
$models = [
    'deepseek-v4-flash' => 'deepseek-v4-flash (rápido, recomendado)',
    'deepseek-v4-pro'   => 'deepseek-v4-pro (mais capaz, mais caro)',
];
?>
<div class="page-head">
  <h1>Diagnóstico da IA</h1>
  <a class="btn" href="/admin">← Painel</a>
</div>

<div class="queue-panel" style="display:block; margin-bottom:1rem;">
  <strong>Modelo de geração</strong> — usamos <em>thinking mode desligado</em> (resposta direta e rápida).
  <div style="display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.6rem;">
    <?php foreach ($models as $id => $label): ?>
      <form method="post" action="/admin/set-model" class="inline">
        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
        <input type="hidden" name="model" value="<?= e($id) ?>">
        <button class="btn <?= $id==='deepseek-v4-flash'?'btn-primary':'' ?>"<?= $result['configured']===$id?' disabled':'' ?>><?= e($label) ?></button>
      </form>
    <?php endforeach; ?>
  </div>
</div>

<table class="data-table">
  <tbody>
    <tr><th>Chave (.env)</th><td><?= $result['hasKey'] ? '<span class="badge b-pub">presente</span>' : '<span class="badge b-err">ausente</span>' ?></td></tr>
    <tr><th>Modelo configurado</th><td><code><?= e($result['configured']) ?></code></td></tr>
    <tr><th>Teste <code>deepseek-v4-flash</code> (não-pensante)</th><td><?= $render($result['chat']) ?></td></tr>
    <tr><th>Teste do modelo configurado</th><td><?= $render($result['confModel']) ?></td></tr>
  </tbody>
</table>

<div class="queue-panel" style="margin-top:1rem; display:block;">
  <strong>Como ler:</strong>
  <ul class="hint" style="margin:.5rem 0 0; padding-left:1.1rem;">
    <li>Os dois testes <strong>OK</strong> → está tudo certo; pode gerar normalmente.</li>
    <li>Só o configurado FALHA → clique em <strong>deepseek-v4-flash</strong> acima.</li>
    <li>Ambos FALHAM com erro de rede/curl → host bloqueando a saída, ou chave/URL errada.</li>
    <li>Chave <em>ausente</em> → preencha <code>DEEPSEEK_API_KEY</code> no <code>.env</code>.</li>
  </ul>
</div>
