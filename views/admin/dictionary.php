<?php
use function App\Core\e;
/** @var array $items */ /** @var array $categories */ /** @var string $cat */ /** @var string $q */
/** @var array $createdMap */ /** @var array $queueMap */ /** @var string $csrf */

/** Resolve o status visual de um conceito do dicionário. */
$statusOf = static function (string $id) use ($createdMap, $queueMap): array {
    if (isset($createdMap[$id])) {
        return match ($createdMap[$id]) {
            'published' => ['publicado', 'b-pub'],
            'reviewed'  => ['revisado', 'b-rev'],
            default     => ['rascunho', 'b-draft'],
        };
    }
    if (isset($queueMap[$id])) {
        return match ($queueMap[$id]) {
            'processing' => ['gerando…', 'b-rev'],
            'error'      => ['erro', 'b-err'],
            default      => ['na fila', 'b-draft'],
        };
    }
    return ['não criado', 'b-none'];
};
?>
<div class="page-head">
  <h1>Dicionário <span class="hint">(<?= count($items) ?> itens)</span></h1>
  <a class="btn" href="/admin">← Painel</a>
</div>

<form method="get" action="/admin/dictionary" class="filter-bar">
  <select name="cat" onchange="this.form.submit()">
    <option value="">Todas as categorias</option>
    <?php foreach ($categories as $c): ?>
      <option value="<?= e($c) ?>"<?= $cat===$c?' selected':'' ?>><?= e($c) ?></option>
    <?php endforeach; ?>
  </select>
  <input type="search" name="q" value="<?= e($q) ?>" placeholder="Buscar (ex: cobra, money, falling)…">
  <button class="btn">Filtrar</button>
</form>

<form method="post" action="/admin/enqueue">
  <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
  <input type="hidden" name="cat" value="<?= e($cat) ?>">
  <input type="hidden" name="q" value="<?= e($q) ?>">

  <div class="dict-actions">
    <label class="checkall"><input type="checkbox" id="checkall"> Selecionar todos os "não criados"</label>
    <button class="btn btn-primary">Enfileirar selecionados para gerar</button>
  </div>

  <table class="data-table dict-table">
    <thead><tr><th></th><th>Conceito</th><th>Categoria</th><th>ID</th><th>Status</th></tr></thead>
    <tbody>
      <?php foreach ($items as $it): [$label, $cls] = $statusOf($it['id']); $isNew = $cls === 'b-none' || $cls === 'b-err'; ?>
        <tr>
          <td><input type="checkbox" name="ids[]" value="<?= e($it['id']) ?>" class="pick" data-new="<?= $isNew?'1':'0' ?>"></td>
          <td><?= e($it['en']) ?></td>
          <td><?= e($it['category']) ?></td>
          <td><code><?= e($it['id']) ?></code></td>
          <td><span class="badge <?= $cls ?>"><?= e($label) ?></span>
            <?php if (isset($createdMap[$it['id']])): ?>
              <a class="mini" href="/admin/edit?id=<?= e(rawurlencode($it['id'])) ?>">editar</a>
            <?php endif; ?>
          </td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$items): ?><tr><td colspan="5" class="empty">Nada encontrado com esse filtro.</td></tr><?php endif; ?>
    </tbody>
  </table>
</form>

<script>
  document.getElementById('checkall')?.addEventListener('change', function (e) {
    document.querySelectorAll('.pick[data-new="1"]').forEach(cb => { cb.checked = e.target.checked; });
  });
</script>
