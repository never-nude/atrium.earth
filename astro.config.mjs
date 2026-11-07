import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { previewAssets } from './scripts/lib/preview-assets.mjs';

const base = process.env.BASE_PATH || '/';
const consolidatedWorkAliases = ['/works/asia/ganesha-mia', '/asia/ganesha-mia'];

export function sitemapPageAllowed(page) {
  const pathname = new URL(page).pathname.replace(/\/+$/, '');
  return !/\/newest\/[^/]+$/.test(pathname)
    && !/\/v[23](?:\/|$)/.test(pathname)
    && !pathname.includes('/wings/unfiled')
    && !/\/wings\/(?:near-east|greece-rome|americas-oceania)$/.test(pathname)
    && !pathname.includes('/exhibitions/the-space-between')
    && !pathname.includes('/exhibitions/where-is-the-work')
    && !consolidatedWorkAliases.some(alias => pathname.endsWith(alias));
}

export default defineConfig({
  site: process.env.SITE || 'https://atrium.earth',
  base: base === '/' ? undefined : base,
  output: 'static',
  integrations: [
    // Keep retired design URLs and staging aliases out of the crawler sitemap.
    sitemap({ filter: sitemapPageAllowed }),
  ],
  redirects: {
    // One museum object: retain the historical Commons/STL source record and
    // asset maps while public visits use the reviewed GLB listing.
    '/works/asia/ganesha-mia': { status: 301, destination: '/works/asia/ganesha-java-mia/' },
    '/asia/ganesha-mia': { status: 301, destination: '/works/asia/ganesha-java-mia/' },
    '/exhibitions/the-space-between': '/exhibitions/the-price-of-victory/',
    '/exhibitions/where-is-the-work': '/exhibitions/the-price-of-victory/',
    // The Night Vitrine staged under /v3 is now the primary site.
    '/v3': '/',
    '/v3/collection': '/collection',
    '/v3/exhibitions': '/exhibitions',
    '/v3/exhibitions/[slug]': '/exhibitions/[slug]',
    '/v3/works/[...slug]': '/works/[...slug]',
    '/works/egyptian/tepemankh-stela-e25408-louvre': '/works/egyptian/offering-menu-relief-tepemankh-e25408-louvre',
  },
  server: {
    // Honor the port assigned by the preview harness (via PORT); fall back to Astro's default.
    port: process.env.PORT ? Number(process.env.PORT) : 4321,
    host: true,
  },
  vite: {
    plugins: [previewAssets()],
    build: {
      chunkSizeWarningLimit: 1100,
    },
  },
});
