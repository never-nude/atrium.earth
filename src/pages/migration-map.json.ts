import { legacyRedirects } from '../lib/legacy';

export function GET() {
  return new Response(JSON.stringify(legacyRedirects, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
