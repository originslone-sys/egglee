<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Páginas estáticas (legais/institucionais) nos 3 idiomas.
 * Placeholders {EMAIL} e {SITE} são substituídos na renderização.
 *
 * Texto-modelo: revise com cuidado (e, idealmente, com apoio jurídico) antes de
 * considerar definitivo. É suficiente e adequado para aprovação do AdSense.
 */
final class Pages
{
    /** key => [slug por idioma, title por idioma, body por idioma]. */
    private const PAGES = [
        'privacy' => [
            'slug'  => ['pt' => 'privacidade', 'es' => 'privacidad', 'en' => 'privacy'],
            'title' => ['pt' => 'Política de Privacidade', 'es' => 'Política de Privacidad', 'en' => 'Privacy Policy'],
        ],
        'cookies' => [
            'slug'  => ['pt' => 'cookies', 'es' => 'cookies', 'en' => 'cookies'],
            'title' => ['pt' => 'Política de Cookies', 'es' => 'Política de Cookies', 'en' => 'Cookie Policy'],
        ],
        'terms' => [
            'slug'  => ['pt' => 'termos', 'es' => 'terminos', 'en' => 'terms'],
            'title' => ['pt' => 'Termos de Uso', 'es' => 'Términos de Uso', 'en' => 'Terms of Use'],
        ],
        'about' => [
            'slug'  => ['pt' => 'sobre', 'es' => 'sobre', 'en' => 'about'],
            'title' => ['pt' => 'Sobre a egglee', 'es' => 'Sobre egglee', 'en' => 'About egglee'],
        ],
        'contact' => [
            'slug'  => ['pt' => 'contato', 'es' => 'contacto', 'en' => 'contact'],
            'title' => ['pt' => 'Contato', 'es' => 'Contacto', 'en' => 'Contact'],
        ],
    ];

    public static function keys(): array
    {
        return array_keys(self::PAGES);
    }

    public static function slug(string $lang, string $key): string
    {
        return self::PAGES[$key]['slug'][$lang] ?? $key;
    }

    public static function title(string $lang, string $key): string
    {
        return self::PAGES[$key]['title'][$lang] ?? $key;
    }

    public static function url(string $lang, string $key): string
    {
        return '/' . $lang . '/' . self::slug($lang, $key);
    }

    public static function keyFromSlug(string $lang, string $slug): ?string
    {
        foreach (self::PAGES as $key => $p) {
            if (($p['slug'][$lang] ?? null) === $slug) {
                return $key;
            }
        }
        return null;
    }

    /** Corpo HTML da página (com placeholders {EMAIL}/{SITE} resolvidos). */
    public static function body(string $lang, string $key, string $email, string $site): string
    {
        $raw = self::content($key, $lang);
        return strtr($raw, [
            '{EMAIL}' => $email,
            '{SITE}'  => $site,
            '{LANG}'  => $lang,
            '{PRIV}'  => self::slug($lang, 'privacy'),
        ]);
    }

    private static function content(string $key, string $lang): string
    {
        $c = self::CONTENT[$key][$lang] ?? self::CONTENT[$key]['en'] ?? '';
        return $c;
    }

    /** Conteúdo HTML por página/idioma. */
    private const CONTENT = [
        'privacy' => [
            'pt' => <<<'H'
<p>Esta Política de Privacidade explica como a egglee ({SITE}) trata as informações de quem visita o site. Ao continuar navegando, você concorda com as práticas aqui descritas.</p>
<h2>Quais dados coletamos</h2>
<p>Não solicitamos cadastro nem dados pessoais para ler o conteúdo. Coletamos automaticamente apenas informações de navegação (como páginas visitadas, tipo de dispositivo e navegador, e dados aproximados de localização via endereço IP), por meio de cookies e tecnologias semelhantes.</p>
<h2>Cookies e parceiros</h2>
<p>Utilizamos cookies para melhorar a experiência, entender o uso do site e exibir anúncios. Parceiros terceiros, incluindo o <strong>Google AdSense</strong> e serviços de análise, podem usar cookies para personalizar e medir anúncios. O Google, como fornecedor terceiro, utiliza cookies (incluindo o cookie DART) para exibir anúncios com base em visitas anteriores a este e a outros sites.</p>
<p>Você pode gerenciar a personalização de anúncios nas <a href="https://www.google.com/settings/ads" rel="nofollow noopener" target="_blank">Configurações de anúncios do Google</a> e saber mais nas <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow noopener" target="_blank">políticas de parceiros do Google</a>.</p>
<h2>Seus direitos (LGPD / GDPR)</h2>
<p>Você pode, a qualquer momento, solicitar acesso, correção ou exclusão dos seus dados, além de retirar o consentimento para cookies. Para isso, escreva para <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
<h2>Consentimento</h2>
<p>Ao acessar o site, exibimos um aviso de cookies. Anúncios e análises só são ativados após o seu consentimento.</p>
<p>Esta política pode ser atualizada periodicamente. Dúvidas? Fale com a gente em <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
H,
            'es' => <<<'H'
<p>Esta Política de Privacidad explica cómo egglee ({SITE}) trata la información de quienes visitan el sitio. Al continuar navegando, aceptas las prácticas aquí descritas.</p>
<h2>Qué datos recopilamos</h2>
<p>No pedimos registro ni datos personales para leer el contenido. Recopilamos automáticamente solo información de navegación (páginas visitadas, tipo de dispositivo y navegador, y ubicación aproximada por dirección IP), mediante cookies y tecnologías similares.</p>
<h2>Cookies y socios</h2>
<p>Usamos cookies para mejorar la experiencia, entender el uso del sitio y mostrar anuncios. Terceros, incluido <strong>Google AdSense</strong> y servicios de análisis, pueden usar cookies para personalizar y medir anuncios. Google, como proveedor externo, usa cookies (incluida la cookie DART) para mostrar anuncios según visitas anteriores a este y otros sitios.</p>
<p>Puedes gestionar la personalización en la <a href="https://www.google.com/settings/ads" rel="nofollow noopener" target="_blank">Configuración de anuncios de Google</a> y saber más en las <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow noopener" target="_blank">políticas de socios de Google</a>.</p>
<h2>Tus derechos (RGPD / leyes locales)</h2>
<p>Puedes solicitar acceso, corrección o eliminación de tus datos y retirar el consentimiento de cookies en cualquier momento escribiendo a <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
<h2>Consentimiento</h2>
<p>Mostramos un aviso de cookies al entrar. Los anuncios y análisis se activan solo tras tu consentimiento.</p>
<p>Esta política puede actualizarse. ¿Dudas? Escríbenos a <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
H,
            'en' => <<<'H'
<p>This Privacy Policy explains how egglee ({SITE}) handles the information of people who visit the site. By continuing to browse, you agree to the practices described here.</p>
<h2>What data we collect</h2>
<p>We do not require registration or personal data to read the content. We automatically collect only browsing information (pages visited, device and browser type, and approximate location via IP address) through cookies and similar technologies.</p>
<h2>Cookies and partners</h2>
<p>We use cookies to improve your experience, understand site usage, and serve ads. Third parties, including <strong>Google AdSense</strong> and analytics services, may use cookies to personalize and measure ads. Google, as a third-party vendor, uses cookies (including the DART cookie) to serve ads based on prior visits to this and other sites.</p>
<p>You can manage ad personalization in <a href="https://www.google.com/settings/ads" rel="nofollow noopener" target="_blank">Google Ad Settings</a> and learn more in <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow noopener" target="_blank">Google's partner policies</a>.</p>
<h2>Your rights (GDPR / local laws)</h2>
<p>You may request access to, correction, or deletion of your data, and withdraw cookie consent at any time by writing to <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
<h2>Consent</h2>
<p>We show a cookie notice on entry. Ads and analytics are enabled only after your consent.</p>
<p>This policy may be updated periodically. Questions? Contact us at <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
H,
        ],
        'cookies' => [
            'pt' => <<<'H'
<p>Cookies são pequenos arquivos guardados no seu dispositivo para que o site funcione e melhore sua experiência.</p>
<h2>Que cookies usamos</h2>
<ul>
<li><strong>Essenciais:</strong> necessários para o funcionamento do site (ex.: lembrar seu consentimento).</li>
<li><strong>Análise:</strong> ajudam a entender como o site é usado, de forma agregada.</li>
<li><strong>Publicidade:</strong> usados por parceiros como o Google AdSense para exibir anúncios relevantes.</li>
</ul>
<h2>Como controlar</h2>
<p>Você pode aceitar ou recusar cookies não essenciais no aviso exibido ao entrar, e também apagar ou bloquear cookies nas configurações do seu navegador. Veja mais na nossa <a href="/{LANG}/{PRIV}">Política de Privacidade</a>.</p>
H,
            'es' => <<<'H'
<p>Las cookies son pequeños archivos guardados en tu dispositivo para que el sitio funcione y mejore tu experiencia.</p>
<h2>Qué cookies usamos</h2>
<ul>
<li><strong>Esenciales:</strong> necesarias para el funcionamiento del sitio (p. ej., recordar tu consentimiento).</li>
<li><strong>Análisis:</strong> ayudan a entender cómo se usa el sitio, de forma agregada.</li>
<li><strong>Publicidad:</strong> usadas por socios como Google AdSense para mostrar anuncios relevantes.</li>
</ul>
<h2>Cómo controlar</h2>
<p>Puedes aceptar o rechazar las cookies no esenciales en el aviso al entrar, y borrar o bloquear cookies en la configuración de tu navegador. Más información en nuestra <a href="/{LANG}/{PRIV}">Política de Privacidad</a>.</p>
H,
            'en' => <<<'H'
<p>Cookies are small files stored on your device so the site works and improves your experience.</p>
<h2>Which cookies we use</h2>
<ul>
<li><strong>Essential:</strong> required for the site to function (e.g., remembering your consent).</li>
<li><strong>Analytics:</strong> help us understand how the site is used, in aggregate.</li>
<li><strong>Advertising:</strong> used by partners such as Google AdSense to show relevant ads.</li>
</ul>
<h2>How to control</h2>
<p>You can accept or reject non-essential cookies in the notice shown on entry, and delete or block cookies in your browser settings. Learn more in our <a href="/{LANG}/{PRIV}">Privacy Policy</a>.</p>
H,
        ],
        'terms' => [
            'pt' => <<<'H'
<p>Ao usar a egglee ({SITE}), você concorda com estes Termos de Uso.</p>
<h2>Natureza do conteúdo</h2>
<p>As interpretações de sonhos publicadas aqui reúnem tradição popular, simbologia cultural e psicologia, e têm caráter <strong>informativo e de entretenimento</strong>. Não constituem aconselhamento médico, psicológico, jurídico ou financeiro, e não substituem a orientação de profissionais qualificados.</p>
<h2>Uso do site</h2>
<p>Você se compromete a usar o site de forma lícita. O conteúdo, a marca e o design pertencem à egglee e não podem ser copiados em massa sem autorização.</p>
<h2>Isenção de responsabilidade</h2>
<p>O conteúdo é fornecido "como está". Não garantimos resultados específicos e não nos responsabilizamos por decisões tomadas com base nas interpretações.</p>
<h2>Alterações</h2>
<p>Podemos atualizar estes termos a qualquer momento. Dúvidas: <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
H,
            'es' => <<<'H'
<p>Al usar egglee ({SITE}), aceptas estos Términos de Uso.</p>
<h2>Naturaleza del contenido</h2>
<p>Las interpretaciones de sueños aquí publicadas reúnen tradición popular, simbología cultural y psicología, con fines <strong>informativos y de entretenimiento</strong>. No constituyen asesoramiento médico, psicológico, legal ni financiero, y no sustituyen la orientación de profesionales cualificados.</p>
<h2>Uso del sitio</h2>
<p>Te comprometes a usar el sitio de forma lícita. El contenido, la marca y el diseño pertenecen a egglee y no pueden copiarse masivamente sin autorización.</p>
<h2>Exención de responsabilidad</h2>
<p>El contenido se ofrece "tal cual". No garantizamos resultados específicos ni nos responsabilizamos por decisiones tomadas con base en las interpretaciones.</p>
<h2>Cambios</h2>
<p>Podemos actualizar estos términos en cualquier momento. Dudas: <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
H,
            'en' => <<<'H'
<p>By using egglee ({SITE}), you agree to these Terms of Use.</p>
<h2>Nature of the content</h2>
<p>The dream interpretations published here blend folk tradition, cultural symbolism, and psychology, and are for <strong>informational and entertainment purposes</strong>. They do not constitute medical, psychological, legal, or financial advice and are not a substitute for guidance from qualified professionals.</p>
<h2>Use of the site</h2>
<p>You agree to use the site lawfully. The content, brand, and design belong to egglee and may not be copied at scale without permission.</p>
<h2>Disclaimer</h2>
<p>Content is provided "as is". We do not guarantee specific outcomes and are not liable for decisions made based on the interpretations.</p>
<h2>Changes</h2>
<p>We may update these terms at any time. Questions: <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
H,
        ],
        'about' => [
            'pt' => <<<'H'
<p>A egglee nasceu para responder, de forma clara e acolhedora, o que tanta gente pesquisa de madrugada: "o que significa esse sonho?".</p>
<h2>Como interpretamos</h2>
<p>Cada interpretação combina três olhares: a <strong>tradição popular</strong>, a <strong>psicologia analítica</strong> (arquétipos, o inconsciente) e o <strong>bom senso emocional</strong> — sempre considerando o contexto e os sentimentos do sonho. Evitamos respostas rasas e genéricas.</p>
<h2>Aviso</h2>
<p>O conteúdo tem caráter informativo e de entretenimento e não substitui orientação profissional. Fale com a gente em <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
H,
            'es' => <<<'H'
<p>egglee nació para responder, de forma clara y cercana, lo que tanta gente busca de madrugada: "¿qué significa este sueño?".</p>
<h2>Cómo interpretamos</h2>
<p>Cada interpretación combina tres miradas: la <strong>tradición popular</strong>, la <strong>psicología analítica</strong> (arquetipos, el inconsciente) y el <strong>sentido común emocional</strong>, siempre considerando el contexto y las emociones del sueño. Evitamos respuestas superficiales.</p>
<h2>Aviso</h2>
<p>El contenido es informativo y de entretenimiento y no sustituye la orientación profesional. Escríbenos a <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
H,
            'en' => <<<'H'
<p>egglee was created to answer, clearly and warmly, what so many people search at 3 a.m.: "what does this dream mean?".</p>
<h2>How we interpret</h2>
<p>Each interpretation blends three lenses: <strong>folk tradition</strong>, <strong>analytical psychology</strong> (archetypes, the unconscious), and <strong>emotional common sense</strong> — always considering the dream's context and feelings. We avoid shallow, generic answers.</p>
<h2>Disclaimer</h2>
<p>The content is informational and for entertainment, and is not a substitute for professional guidance. Contact us at <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
H,
        ],
        'contact' => [
            'pt' => <<<'H'
<p>Quer falar com a egglee? Envie um e-mail para <a href="mailto:{EMAIL}">{EMAIL}</a> — lemos sugestões, correções e parcerias.</p>
H,
            'es' => <<<'H'
<p>¿Quieres hablar con egglee? Escribe a <a href="mailto:{EMAIL}">{EMAIL}</a> — leemos sugerencias, correcciones y colaboraciones.</p>
H,
            'en' => <<<'H'
<p>Want to reach egglee? Email <a href="mailto:{EMAIL}">{EMAIL}</a> — we read suggestions, corrections, and partnership requests.</p>
H,
        ],
    ];
}
