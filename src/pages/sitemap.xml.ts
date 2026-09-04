import { works } from '../lib/catalog';
import { absoluteUrl } from '../lib/urls';
import { wings } from '../data/wings';

const staticRoutes = [
  '/',
  '/collection/',
  '/wings/',
  ...wings.map((wing) => `/wings/${wing.id}/`),
  '/museum/',
  '/timeline/',
  '/geography/',
  '/materials/',
  '/movements/',
  '/makers/',
  '/exhibitions/',
  '/about/',
  '/migration-map.json',
];

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function GET() {
  const urls = [...staticRoutes, ...works.map((work) => `/works/${work.slug}/`)]
    .map((route) => `  <url><loc>${escapeXml(absoluteUrl(route, import.meta.env.SITE || 'https://atrium.earth'))}</loc></url>`)
    .join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
