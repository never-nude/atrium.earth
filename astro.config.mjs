import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: process.env.SITE || 'https://atrium.earth',
  base: base === '/' ? undefined : base,
  output: 'static',
  integrations: [sitemap()],
  vite: {
    build: {
      chunkSizeWarningLimit: 1100,
    },
  },
});
