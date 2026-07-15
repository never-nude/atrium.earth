import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: process.env.SITE || 'https://atrium.earth',
  base: base === '/' ? undefined : base,
  output: 'static',
  integrations: [sitemap()],
  redirects: {
    // The immersive museum staged under /v2 is now the primary site.
    '/v2': '/',
    '/v2/collection': '/collection',
    '/v2/exhibitions': '/exhibitions',
    '/v2/exhibitions/[slug]': '/exhibitions/[slug]',
    '/v2/works/[...slug]': '/works/[...slug]',
  },
  server: {
    // Honor the port assigned by the preview harness (via PORT); fall back to Astro's default.
    port: process.env.PORT ? Number(process.env.PORT) : 4321,
    host: true,
  },
  vite: {
    build: {
      chunkSizeWarningLimit: 1100,
    },
  },
});
