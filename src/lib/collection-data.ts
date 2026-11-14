import { works, publicDataset } from './catalog';
import { createHash } from 'node:crypto';
import { shortWorkTitle } from './work-titles';
import { withBase } from './urls';
import previews from '../data/previews.json';
import { COLLECTION_CHUNK_SIZE, packCollectionIndex } from './collection-window.mjs';

// Only the normalized public catalogue enters either endpoint. No model URLs,
// internal source paths, private recovery maps or raw hidden records are sent.
const entries = works.map((work) => {
  const data = publicDataset(work);
  const title = shortWorkTitle(work.title);
  const makerLabel = work.maker || 'Maker not yet recorded';
  const spatialAccess = work.spatialAccess?.enabled ? work.spatialAccess : null;
  const preview = (previews as Record<string, { bytes?: number }>)[work.slug];
  const previewBytes = typeof preview?.bytes === 'number' && Number.isFinite(preview.bytes) && preview.bytes > 0 ? preview.bytes : undefined;
  const detail = [work.maker || work.culture, work.displayDate].filter(Boolean).join(' · ');
  return {
    metadata: { slug: work.slug, title, search: data.search, year: data.year, wing: data.wing, era: data.era, place: data.place, material: data.material, maker: data.maker, makerLabel, catalogIndex: work.index, ingested: work.ingested || '', size: spatialAccess?.status || '' },
    card: { id: work.id, href: withBase(`/works/${work.slug}/`), title: work.title, caption: title, detail, alt: `${work.title}${detail ? ` — ${detail}` : ''}`, thumbnail: withBase(work.thumbnailImage), spatialLabel: spatialAccess?.label || '',
      attributes: { search: data.search, year: data.year, wing: data.wing, era: data.era, place: data.place, material: data.material, maker: data.maker, makerLabel, size: spatialAccess?.status,
        studioPreviewBytes: previewBytes, studioPeekAvailable: String(work.hasPreview), studioIndex: work.index, studioIngested: work.ingested || undefined } },
  };
});

export const collectionDataVersion = createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0,16);
export const collectionIndex = { ...packCollectionIndex(entries.map(entry => entry.metadata)), revision:collectionDataVersion };
export const collectionChunkCount = Math.ceil(entries.length / COLLECTION_CHUNK_SIZE);
export function collectionCardChunk(chunk: number) {
  return { version: 1, revision:collectionDataVersion, chunk, cards: entries.slice(chunk * COLLECTION_CHUNK_SIZE, (chunk + 1) * COLLECTION_CHUNK_SIZE).map(entry => entry.card) };
}
