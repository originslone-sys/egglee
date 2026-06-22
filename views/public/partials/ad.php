<?php
use App\Core\Env;
use function App\Core\e;
// Unidade de anúncio manual: aparece só com chave + slot configurados E consentimento.
$client = Env::get('ADSENSE_CLIENT');
$slot   = Env::get('ADSENSE_SLOT');
if ($client && $slot && (($_COOKIE['egglee_consent'] ?? '') === '1')):
?>
<div class="ad-slot">
  <ins class="adsbygoogle" style="display:block" data-ad-client="<?= e($client) ?>" data-ad-slot="<?= e($slot) ?>" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>
<?php endif; ?>
