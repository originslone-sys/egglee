<?php
use App\Support\Lang;
use function App\Core\e;
/** @var array $grouped */ /** @var string $csrf */ /** @var ?array $results */
$cats = array_keys($grouped);
?>
<div class="page-head"><h1>Gerador</h1></div>

<form method="post" action="/admin/generate" class="gen-form">
  <input type="hidden" name="csrf" value="<?= e($csrf) ?>">

  <label>Categoria
    <select name="category" id="gen-cat">
      <?php foreach ($cats as $c): ?><option value="<?= e($c) ?>"><?= e($c) ?></option><?php endforeach; ?>
    </select>
  </label>

  <label>Conceito
    <select name="concept" id="gen-concept"></select>
  </label>

  <label>Idioma
    <select name="lang">
      <option value="all">Todos os 3 idiomas (pt, es, en)</option>
      <?php foreach (Lang::LANGS as $l): ?><option value="<?= e($l) ?>"><?= strtoupper($l) ?></option><?php endforeach; ?>
    </select>
  </label>

  <div class="form-actions">
    <button class="btn btn-primary">Gerar</button>
    <span class="hint">Gera direto (~15s por idioma) e salva como rascunho para você revisar.</span>
  </div>
</form>

<?php if ($results !== null): ?>
  <div class="gen-results">
    <h2 class="sub-h">Resultado</h2>
    <?php foreach ($results as $r): ?>
      <div class="gen-row">
        <strong><?= strtoupper(e($r['lang'])) ?></strong>
        <?php if ($r['ok']): ?>
          <span class="badge b-pub">gerado</span> <?= sprintf('%.1fs', $r['elapsed']) ?>
        <?php else: ?>
          <span class="badge b-err">falhou</span> <?= e((string) $r['error']) ?>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
    <?php if (!empty($symbolId)): ?>
      <p style="margin-top:.6rem;"><a class="btn" href="/admin/edit?id=<?= e(rawurlencode($symbolId)) ?>">Revisar / editar</a> <a class="btn" href="/admin/articles">Ver artigos</a></p>
    <?php endif; ?>
  </div>
<?php endif; ?>

<script>
  const DICT = <?= json_encode($grouped, JSON_UNESCAPED_UNICODE) ?>;
  const catSel = document.getElementById('gen-cat');
  const conSel = document.getElementById('gen-concept');
  function fillConcepts() {
    const items = DICT[catSel.value] || [];
    conSel.innerHTML = items.map(i => `<option value="${i.id}">${i.en} (${i.id})</option>`).join('');
  }
  catSel.addEventListener('change', fillConcepts);
  fillConcepts();
</script>
