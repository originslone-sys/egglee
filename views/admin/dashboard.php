<?php
use function App\Core\e;
/** @var array $symbols */ /** @var string $csrf */
$badge = ['draft' => 'b-draft', 'reviewed' => 'b-rev', 'published' => 'b-pub'];
?>
<div class="page-head">
  <h1>Símbolos</h1>
</div>

<details class="new-symbol">
  <summary>+ Novo símbolo (gerar com IA)</summary>
  <form method="post" action="/admin/create" class="grid-form">
    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
    <label>ID (slug interno, ex: <code>snake</code>)<input name="id" required></label>
    <label>Categoria
      <select name="category">
        <?php foreach (['animals','people','actions','objects','places','feelings','events','body','nature','spiritual'] as $cat): ?>
          <option value="<?= $cat ?>"><?= $cat ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label>Relacionados (ids, separados por vírgula)<input name="related" placeholder="spider, rat"></label>
    <label>Termo PT<input name="term_pt" placeholder="cobra" required></label>
    <label>Termo ES<input name="term_es" placeholder="serpiente" required></label>
    <label>Termo EN<input name="term_en" placeholder="snakes" required></label>
    <div class="form-actions">
      <button class="btn btn-primary">Gerar rascunho (3 idiomas)</button>
      <span class="hint">Usa a DEEPSEEK_API_KEY do .env. Pode levar ~1 min.</span>
    </div>
  </form>
</details>

<table class="data-table">
  <thead><tr><th>ID</th><th>Título (PT)</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead>
  <tbody>
    <?php if (!$symbols): ?>
      <tr><td colspan="5" class="empty">Nenhum símbolo ainda. Crie o primeiro acima.</td></tr>
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
        </td>
      </tr>
    <?php endforeach; ?>
  </tbody>
</table>
