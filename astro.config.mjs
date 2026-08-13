import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const base = process.env.BASE_PATH || '/';
const easterEggRoute = '/works/baroque/ecstasy-of-saint-teresa-bernini-cornaro-chapel/';

export default defineConfig({
  site: process.env.SITE || 'https://atrium.earth',
  base: base === '/' ? undefined : base,
  output: 'static',
  integrations: [
    // /v2 is the archived previous design and /v3 was the staging alias;
    // neither belongs in the crawler sitemap.
    sitemap({
      filter: (page) =>
        !page.includes('/v2/') &&
        !page.includes('/v3/') &&
        !page.includes(easterEggRoute),
    }),
  ],
  redirects: {
    // The Night Vitrine staged under /v3 is now the primary site.
    '/v3': '/',
    '/v3/collection': '/collection',
    '/v3/exhibitions': '/exhibitions',
    '/v3/exhibitions/[slug]': '/exhibitions/[slug]',
    '/v3/works/[...slug]': '/works/[...slug]',
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
