import { collectionCardChunk, collectionChunkCount } from '../../../lib/collection-data';

export function getStaticPaths() {
  return Array.from({ length: collectionChunkCount }, (_, chunk) => ({ params: { chunk: String(chunk) }, props: { chunk } }));
}

export function GET({ props }: { props: { chunk: number } }) {
  return new Response(JSON.stringify(collectionCardChunk(props.chunk)), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
