import { absoluteUrl } from '../lib/urls';

export function GET() {
  return new Response(
    [
      'User-agent: *',
      'Allow: /',
      `Sitemap: ${absoluteUrl('/sitemap.xml', import.meta.env.SITE || 'https://atrium.earth')}`,
      '',
    ].join('\n'),
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    },
  );
}
