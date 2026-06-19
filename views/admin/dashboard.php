<?php
use function App\Core\e;
/** @var array $symbols */ /** @var array $queue */ /** @var array $errors */ /** @var string $csrf */
$badge = ['draft' => 'b-draft', 'reviewed' => 'b-rev', 'published' => 'b-pub'];
?>
<div class="page-head">
  <h1>Painel</h1>
  <div style="display:flex; gap:.5rem;">
    <a class="btn" href="/admin/diagnose">Testar IA</a>
    <a class="btn btn-primary" href="/admin/dictionary">+ Gerar do dicionário</a>
  </div>
</div>

<!-- Fila de geração -->
<div class="queue-panel">
  <div class="queue-stats">
    <div class="qstat"><span class="qn"><?= (int) $queue['pending'] ?></span> na fila</div>
    <div class="qstat"><span class="qn"><?= (int) $queue['processing'] ?></span> gerando</div>
    <div class="qstat"><span class="qn"><?= (int) $queue['done'] ?></span> concluídos</div>
    <div class="qstat err"><span class="qn"><?= (int) $queue['error'] ?></span> erros</div>
  </div>
  <?php if ($queue['pending'] > 0): ?>
    <form method="post" action="/admin/process" class="inline">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <button class="btn btn-pub">Gerar próximo idioma</button>
    </form>
    <span class="hint">Cada clique gera 1 idioma (3 = símbolo completo). O ideal é o cron rodando <code>scripts/worker.php</code> a cada 1–5 min (ver README).</span>
  <?php else: ?>
    <span class="hint">Sem itens pendentes. Vá ao <a href="/admin/dictionary">dicionário</a> para escolher o que gerar.</span>
  <?php endif; ?>
  <?php if ($errors): ?>
    <details class="queue-errors">
      <summary><?= count($errors) ?> erro(s) recente(s)</summary>
      <ul>
        <?php foreach ($errors as $er): ?>
          <li><code><?= e($er['concept_id']) ?></code>: <?= e(mb_substr((string) $er['error'], 0, 160)) ?></li>
        <?php endforeach; ?>
      </ul>
    </details>
  <?php endif; ?>
</div>

<h2 class="sub-h">Símbolos criados</h2>
<table class="data-table">
  <thead><tr><th>ID</th><th>Título (PT)</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead>
  <tbody>
    <?php if (!$symbols): ?>
      <tr><td colspan="5" class="empty">Nenhum símbolo ainda. Gere a partir do dicionário.</td></tr>
    <?php endif; ?>
    <?php foreach ($symbols as $s): ?>
      <tr>
        <td><code><?= e($s['id']) ?></code></td>
        <td><?= e($s['h1_pt'] ?? '—') ?></td>
        <td><?= e($s['category']) ?></td>
        <td><span class="badge <?= $badge[$s['status']] ?? '' ?>"><?= e($s['status']) ?></span></td>
        <td class="actions">
          <a class="btn btn-sm" href="/admin/edit?id=<?= e(rawurlencode($s['id'])) ?>">Editar</a>
          <?php if ($s['status'] !== 'published'): ?>
            <form method="post" action="/admin/status" class="inline">
              <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
              <input type="hidden" name="id" value="<?= e($s['id']) ?>">
              <input type="hidden" name="status" value="published">
              <button class="btn btn-sm btn-pub">Publicar</button>
            </form>
          <?php else: ?>
            <form method="post" action="/admin/status" class="inline">
              <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
              <input type="hidden" name="id" value="<?= e($s['id']) ?>">
              <input type="hidden" name="status" value="draft">
              <button class="btn btn-sm">Despublicar</button>
            </form>
          <?php endif; ?>
          <form method="post" action="/admin/delete" class="inline" onsubmit="return confirm('Excluir <?= e($s['id']) ?>? Esta ação não pode ser desfeita.');">
            <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
            <input type="hidden" name="id" value="<?= e($s['id']) ?>">
            <button class="btn btn-sm btn-del">Excluir</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
  </tbody>
</table>
