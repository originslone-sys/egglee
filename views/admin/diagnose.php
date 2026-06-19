<?php
use function App\Core\e;
/** @var array $result */
$render = static function (array $r): string {
    if ($r['ok']) {
        return '<span class="badge b-pub">OK</span> ' . sprintf('%.1fs', $r['elapsed'])
            . ' — HTTP ' . (int) $r['http'];
    }
    return '<span class="badge b-err">FALHOU</span> ' . sprintf('%.1fs', $r['elapsed'])
        . ' — ' . e((string) $r['error']);
};
?>
<div class="page-head">
  <h1>Diagnóstico da IA</h1>
  <a class="btn" href="/admin">← Painel</a>
</div>

<table class="data-table">
  <tbody>
    <tr><th>Chave (.env)</th><td><?= $result['hasKey'] ? '<span class="badge b-pub">presente</span>' : '<span class="badge b-err">ausente</span>' ?></td></tr>
    <tr><th>Modelo configurado</th><td><code><?= e($result['configured']) ?></code></td></tr>
    <tr><th>Teste <code>deepseek-chat</code> (rápido)</th><td><?= $render($result['chat']) ?></td></tr>
    <tr><th>Teste do modelo configurado</th><td><?= $render($result['confModel']) ?></td></tr>
  </tbody>
</table>

<div class="queue-panel" style="margin-top:1rem; display:block;">
  <strong>Como ler:</strong>
  <ul class="hint" style="margin:.5rem 0 0; padding-left:1.1rem;">
    <li>Se <code>chat</code> = OK mas o modelo configurado FALHA por tempo → o modelo é lento demais para o host. <strong>Troque <code>DEEPSEEK_MODEL</code> para <code>deepseek-chat</code> no <code>.env</code></strong> (Gerenciador de Arquivos).</li>
    <li>Se ambos FALHAM com erro de rede/curl → o host está bloqueando a saída ou a chave/URL está errada.</li>
    <li>Se a chave está <em>ausente</em> → preencha <code>DEEPSEEK_API_KEY</code> no <code>.env</code>.</li>
  </ul>
</div>
