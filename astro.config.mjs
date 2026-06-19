import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Ajuste para o domínio final antes do deploy.
const SITE = process.env.SITE_URL || 'https://exemplo.com';

export default defineConfig({
  site: SITE,
  // Saída 100% estática: HTML em CDN = Core Web Vitals altos e custo baixo.
  output: 'static',
  trailingSlash: 'never',
  i18n: {
    defaultLocale: 'pt',
    locales: ['pt', 'es', 'en'],
    routing: {
      // /pt/... explícito; sem redirect automático para o usuário escolher idioma.
      prefixDefaultLocale: true,
    },
  },
  integrations: [
    sitemap({
      // A raiz "/" é só redirect e não tem prefixo de idioma — fora do sitemap.
      filter: (page) => {
        const path = new URL(page).pathname;
        return path !== '/' && path !== '';
      },
      i18n: {
        defaultLocale: 'pt',
        locales: { pt: 'pt-BR', es: 'es-ES', en: 'en-US' },
      },
    }),
  ],
});
