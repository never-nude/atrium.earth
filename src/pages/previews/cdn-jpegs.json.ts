import { artworkJpegHashes } from '../../lib/artwork-jpegs';

export function GET() {
  return new Response(JSON.stringify(artworkJpegHashes), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
