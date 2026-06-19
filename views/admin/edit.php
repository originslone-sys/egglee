<?php
use App\Support\Lang;
use function App\Core\e;
/** @var array $sym */ /** @var string $csrf */
$jsonField = static function ($v): string {
    return json_encode($v ?? [], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
};
?>
<div class="page-head">
  <h1>Editar: <code><?= e($sym['id']) ?></code></h1>
  <div class="status-line">
    Status atual: <span class="badge"><?= e($sym['status']) ?></span>
    <form method="post" action="/admin/status" class="inline">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <input type="hidden" name="id" value="<?= e($sym['id']) ?>">
      <input type="hidden" name="back" value="/admin/edit?id=<?= e(rawurlencode($sym['id'])) ?>">
      <select name="status">
        <?php foreach (['draft','reviewed','published'] as $st): ?>
          <option value="<?= $st ?>"<?= $sym['status']===$st?' selected':'' ?>><?= $st ?></option>
        <?php endforeach; ?>
      </select>
      <button class="btn btn-sm">Aplicar status</button>
    </form>
  </div>
</div>

<form method="post" action="/admin/update">
  <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
  <input type="hidden" name="id" value="<?= e($sym['id']) ?>">

  <div class="meta-row">
    <label>Categoria<input name="category" value="<?= e($sym['category']) ?>"></label>
    <label>Relacionados (ids, vírgula)<input name="related" value="<?= e(implode(', ', $sym['related'] ?? [])) ?>"></label>
  </div>

  <div class="lang-tabs">
    <?php foreach (Lang::LANGS as $i => $lang): $c = $sym['content'][$lang] ?? []; ?>
      <details class="lang-block"<?= $i===0?' open':'' ?>>
        <summary><?= strtoupper($lang) ?> — <?= e($c['h1'] ?? '(vazio)') ?></summary>

        <label>Slug<input name="<?= $lang ?>[slug]" value="<?= e($c['slug'] ?? '') ?>"></label>
        <label>Title (SEO)<input name="<?= $lang ?>[title]" value="<?= e($c['title'] ?? '') ?>" maxlength="65"></label>
        <label>Meta description<input name="<?= $lang ?>[metaDescription]" value="<?= e($c['meta_description'] ?? '') ?>" maxlength="160"></label>
        <label>H1<input name="<?= $lang ?>[h1]" value="<?= e($c['h1'] ?? '') ?>"></label>
        <label>Quick answer<textarea name="<?= $lang ?>[quickAnswer]" rows="2"><?= e($c['quick_answer'] ?? '') ?></textarea></label>
        <label>Intro (parágrafos separados por linha em branco)<textarea name="<?= $lang ?>[intro]" rows="4"><?= e($c['intro'] ?? '') ?></textarea></label>
        <label>Closing<textarea name="<?= $lang ?>[closing]" rows="2"><?= e($c['closing'] ?? '') ?></textarea></label>

        <label>Sections (JSON: [{heading, body}])<textarea class="json" name="<?= $lang ?>[sections]" rows="8"><?= e($jsonField($c['sections'] ?? [])) ?></textarea></label>
        <label>Variations (JSON: [{keyword, meaning}])<textarea class="json" name="<?= $lang ?>[variations]" rows="6"><?= e($jsonField($c['variations'] ?? [])) ?></textarea></label>
        <label>FAQ (JSON: [{question, answer}])<textarea class="json" name="<?= $lang ?>[faq]" rows="6"><?= e($jsonField($c['faq'] ?? [])) ?></textarea></label>
        <label>Semantic keywords (JSON: ["...", "..."])<textarea class="json" name="<?= $lang ?>[semanticKeywords]" rows="3"><?= e($jsonField($c['semanticKeywords'] ?? [])) ?></textarea></label>
      </details>
    <?php endforeach; ?>
  </div>

  <div class="form-actions sticky">
    <button class="btn btn-primary">Salvar alterações</button>
    <a class="btn" href="/admin">Voltar</a>
  </div>
</form>
