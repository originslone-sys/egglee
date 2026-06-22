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

<div class="queue-panel" style="display:block; margin-top:1rem;">
  <strong>Imagens (Pexels)</strong> —
  <?= !empty($pexels) ? '<span class="badge b-pub">chave configurada</span>' : '<span class="badge b-err">sem chave</span>' ?>
  <form method="post" action="/admin/set-pexels" style="display:flex; gap:.5rem; margin-top:.5rem; flex-wrap:wrap;">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
    <input type="password" name="pexels_key" placeholder="Cole a chave da API do Pexels" style="flex:1; min-width:220px;" autocomplete="off">
    <button class="btn btn-primary">Salvar chave</button>
  </form>
  <p class="hint" style="margin:.3rem 0 0;">Crie grátis em pexels.com/api. Cada artigo gerado busca 1 foto pelo conceito.</p>
</div>

<div class="queue-panel" style="display:block; margin-top:1rem;">
  <strong>Monetização e contato</strong>
  <form method="post" action="/admin/set-monetize" style="display:grid; gap:.5rem; margin-top:.5rem; max-width:520px;">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
    <label class="hint">AdSense Client (ca-pub-...) <input name="adsense" value="<?= e($adsense ?? '') ?>" placeholder="ca-pub-XXXXXXXXXXXXXXXX"></label>
    <label class="hint">AdSense Slot (opcional, p/ anúncio no meio do artigo) <input name="adslot" value="<?= e($adslot ?? '') ?>" placeholder="1234567890"></label>
    <label class="hint">E-mail de contato (aparece nas páginas legais) <input name="contact" value="<?= e($contact ?? '') ?>" placeholder="contato@egglee.com"></label>
    <button class="btn btn-primary">Salvar</button>
  </form>
  <p class="hint" style="margin:.4rem 0 0;">Só com o AdSense Client preenchido E o visitante aceitando os cookies os anúncios carregam. O "Slot" é opcional (sem ele, ative o <em>Auto Ads</em> no painel do AdSense).</p>
</div>

<div class="queue-panel" style="display:block; margin-top:1rem;">
  <strong>Geração real (1 idioma, com cronômetro)</strong> — mede quanto uma geração de verdade leva.
  <div style="margin-top:.5rem;">
    <a class="btn btn-pub" href="/admin/diagnose?gen=1">Testar geração real (pode levar ~30-60s)</a>
  </div>
  <?php if (!empty($genTest)): ?>
    <p style="margin-top:.7rem;">
      <?php if ($genTest['ok']): ?>
        <span class="badge b-pub">OK</span> em <strong><?= sprintf('%.1fs', $genTest['elapsed']) ?></strong>
        — <?= (int) $genTest['chars'] ?> caracteres gerados.
      <?php else: ?>
        <span class="badge b-err">FALHOU</span> após <strong><?= sprintf('%.1fs', $genTest['elapsed']) ?></strong>
        — <?= e((string) $genTest['error']) ?>
      <?php endif; ?>
    </p>
    <p class="hint" style="margin:.3rem 0 0;">Se levou &gt;50s, o servidor web mata a requisição antes de concluir — por isso a geração deve rodar pelo <strong>cron</strong>, não pelo botão do painel.</p>
  <?php endif; ?>
</div>

<div class="queue-panel" style="margin-top:1rem; display:block;">
  <strong>Como ler:</strong>
  <ul class="hint" style="margin:.5rem 0 0; padding-left:1.1rem;">
    <li>Os dois testes <strong>OK</strong> → está tudo certo; pode gerar normalmente.</li>
    <li>Só o configurado FALHA → clique em <strong>deepseek-v4-flash</strong> acima.</li>
    <li>Ambos FALHAM com erro de rede/curl → host bloqueando a saída, ou chave/URL errada.</li>
    <li>Chave <em>ausente</em> → preencha <code>DEEPSEEK_API_KEY</code> no <code>.env</code>.</li>
  </ul>
</div>
