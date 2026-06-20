<?php
use App\Support\Lang;
use function App\Core\e;
/** @var array $grouped */ /** @var string $csrf */ /** @var ?array $results */
$cats = array_keys($grouped);
?>
<div class="page-head"><h1>Gerador</h1></div>

<?php $pct = $auto['total'] > 0 ? round($auto['generated'] / $auto['total'] * 100) : 0; ?>
<div class="auto-panel">
  <div class="auto-head">
    <strong>Piloto automático</strong>
    <span class="hint">Gera o próximo conceito do dicionário (sem repetir). Configure o cron a cada 10 min.</span>
  </div>
  <div class="auto-bar"><span style="width: <?= $pct ?>%"></span></div>
  <div class="auto-stats">
    <span><strong><?= (int) $auto['generated'] ?></strong>/<?= (int) $auto['total'] ?> prontos</span>
    <span><strong><?= (int) $auto['remaining'] ?></strong> restantes</span>
    <span class="err"><strong><?= (int) $auto['failed'] ?></strong> com falha</span>
  </div>
  <div class="auto-actions">
    <form method="post" action="/admin/auto" class="inline">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <button class="btn btn-primary">Gerar próximo agora</button>
    </form>
    <form method="post" action="/admin/auto-publish" class="inline">
      <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
      <input type="hidden" name="on" value="<?= !empty($autoPublish) ? '0' : '1' ?>">
      <button class="btn btn-sm">Auto-publicar: <strong><?= !empty($autoPublish) ? 'LIGADO' : 'DESLIGADO' ?></strong> (clique p/ <?= !empty($autoPublish) ? 'desligar' : 'ligar' ?>)</button>
    </form>
    <?php if (($auto['failed'] ?? 0) > 0): ?>
      <form method="post" action="/admin/auto-reset" class="inline">
        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
        <button class="btn btn-sm">Tentar falhas de novo</button>
      </form>
    <?php endif; ?>
  </div>
  <p class="hint" style="margin:.5rem 0 0;">
    <?= !empty($autoPublish)
      ? 'Artigos gerados entram <strong>publicados</strong> automaticamente.'
      : 'Artigos gerados ficam como <strong>rascunho</strong> — publique em Artigos.' ?>
  </p>
  <p class="hint" style="margin:.5rem 0 0;">
    <strong>Última execução automática:</strong>
    <?php if (!empty($lastRun)): ?>
      <?= e($lastRun['time'] ?? '?') ?> — <?= (int) ($lastRun['ok'] ?? 0) ?> gerado(s),
      <?= (int) ($lastRun['failedRun'] ?? 0) ?> falha(s) [<?= e($lastRun['sapi'] ?? '') ?>]
    <?php else: ?>
      <span class="err">nunca rodou ainda</span> — o cron pode não estar disparando ou o PHP do cron é antigo (precisa 8.1+).
    <?php endif; ?>
  </p>
  <details class="auto-cron">
    <summary>Como ligar o cron (Hostinger)</summary>
    <p class="hint" style="margin:.4rem 0 0;">hPanel → Cron Jobs → a cada 10 min (Minuto: <code>*/10</code>), comando:</p>
    <code class="cron-cmd">/usr/bin/php /home/u740938289/public_html/scripts/worker.php 1</code>
    <p class="hint" style="margin:.4rem 0 0;">Se "nunca rodou" persistir após o cron disparar, troque <code>/usr/bin/php</code> pelo PHP 8 (ex.: <code>/opt/alt/php82/usr/bin/php</code>).</p>
  </details>
  <?php if (!empty($failures)): ?>
    <details class="auto-cron">
      <summary><?= count($failures) ?> falha(s) recente(s)</summary>
      <ul class="hint" style="margin:.4rem 0 0; padding-left:1.1rem;">
        <?php foreach ($failures as $f): ?>
          <li><code><?= e($f['concept_id']) ?></code> (<?= (int) $f['attempts'] ?>x): <?= e(mb_substr((string) $f['error'], 0, 120)) ?></li>
        <?php endforeach; ?>
      </ul>
    </details>
  <?php endif; ?>
</div>

<h2 class="sub-h">Gerar um específico (manual)</h2>

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
