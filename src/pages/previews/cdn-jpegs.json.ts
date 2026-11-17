import { artworkJpegHashes } from '../../lib/artwork-jpegs';
import { works } from '../../lib/catalog';

const publicJpegHashes = Object.fromEntries(
  works.filter(({ slug }) => Object.hasOwn(artworkJpegHashes, slug))
    .map(({ slug }) => [slug, artworkJpegHashes[slug]]),
);

export function GET() {
  return new Response(JSON.stringify(publicJpegHashes), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
