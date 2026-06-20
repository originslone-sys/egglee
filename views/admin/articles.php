<?php
use function App\Core\e;
/** @var array $symbols */ /** @var string $csrf */
$badge = ['draft' => 'b-draft', 'reviewed' => 'b-rev', 'published' => 'b-pub'];
?>
<div class="page-head">
  <h1>Artigos gerados <span class="hint">(<?= (int) ($total ?? 0) ?>)</span></h1>
  <a class="btn btn-primary" href="/admin/generate">+ Gerar novo</a>
</div>

<table class="data-table">
  <thead><tr><th>ID</th><th>Título (PT)</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead>
  <tbody>
    <?php if (!$symbols): ?>
      <tr><td colspan="5" class="empty">Nenhum artigo ainda. Use o <a href="/admin/generate">Gerador</a>.</td></tr>
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
          <form method="post" action="/admin/delete" class="inline" onsubmit="return confirm('Excluir <?= e($s['id']) ?>?');">
            <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
            <input type="hidden" name="id" value="<?= e($s['id']) ?>">
            <button class="btn btn-sm btn-del">Excluir</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
  </tbody>
</table>

<?php if (($pages ?? 1) > 1): ?>
  <nav class="pager">
    <?php if ($page > 1): ?><a class="btn btn-sm" href="/admin/articles?page=<?= $page - 1 ?>">← Anterior</a><?php endif; ?>
    <span class="pager-info">Página <?= (int) $page ?> de <?= (int) $pages ?></span>
    <?php if ($page < $pages): ?><a class="btn btn-sm" href="/admin/articles?page=<?= $page + 1 ?>">Próxima →</a><?php endif; ?>
  </nav>
<?php endif; ?>
