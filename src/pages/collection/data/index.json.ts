import { collectionIndex } from '../../../lib/collection-data';

export function GET() {
  return new Response(JSON.stringify(collectionIndex), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
