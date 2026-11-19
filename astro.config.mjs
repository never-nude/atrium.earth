import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { previewAssets } from './scripts/lib/preview-assets.mjs';

const base = process.env.BASE_PATH || '/';

export function sitemapPageAllowed(page) {
  const pathname = new URL(page).pathname.replace(/\/+$/, '');
  return !/\/newest\/[^/]+$/.test(pathname)
    && !/\/(?:makers|geography|materials|museum)$/.test(pathname)
    && !/\/(?:collection|ar-vr)\/page\/\d+$/.test(pathname)
    && !/\/v[23](?:\/|$)/.test(pathname)
    && !/\/detail\//.test(pathname)
    && !pathname.includes('/wings/unfiled')
    && !/\/wings\/(?:near-east|greece-rome|americas-oceania)$/.test(pathname)
    && !pathname.includes('/exhibitions/the-space-between')
    && !pathname.includes('/exhibitions/where-is-the-work');
}

export default defineConfig({
  site: process.env.SITE || 'https://atrium.earth',
  base: base === '/' ? undefined : base,
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [
    // Keep retired design URLs and staging aliases out of the crawler sitemap.
    sitemap({ filter: sitemapPageAllowed }),
  ],
  redirects: {
    '/makers/': '/collection/',
    '/geography/': '/collection/',
    '/materials/': '/collection/',
    '/museum/': '/collection/',
    '/detail/egyptian/coffin-of-peftjaoeneith-68d0e0': '/works/egyptian/coffin-of-peftjaoeneith-68d0e0/',
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
