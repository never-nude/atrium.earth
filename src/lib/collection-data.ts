import { works, publicDataset, type Work } from './catalog';
import { createHash } from 'node:crypto';
import { shortWorkTitle } from './work-titles';
import { withBase } from './urls';
import { COLLECTION_CHUNK_SIZE, DEFAULT_COLLECTION_SORT, packCollectionIndex, workComparator } from './collection-window.mjs';

export function workSortValues(work: Work) {
  return {
    slug: work.slug,
    title: shortWorkTitle(work.title),
    makerLabel: work.maker || 'Maker not yet recorded',
    year: work.yearStart,
    catalogIndex: work.index,
    ingested: work.ingested || '',
  };
}

// Only the normalized public catalogue enters either endpoint. No model URLs,
// internal source paths, private recovery maps or raw hidden records are sent.
const entries = works.map((work) => {
  const data = publicDataset(work);
  const sortValues = workSortValues(work);
  const { title, makerLabel } = sortValues;
  const year = String(sortValues.year ?? '');
  const spatialAccess = work.spatialAccess?.enabled ? work.spatialAccess : null;
  const previewBytes = work.modelBytes || undefined;
  const detail = [work.maker || work.culture, work.displayDate].filter(Boolean).join(' · ');
  return {
    metadata: { ...sortValues, search: data.search, year, wing: data.wing, era: data.era, place: data.place, material: data.material, maker: data.maker, size: spatialAccess?.status || '' },
    card: { id: work.id, href: withBase(`/works/${work.slug}/`), title: work.title, caption: title, detail, alt: `${work.title}${detail ? ` — ${detail}` : ''}`, thumbnail: withBase(work.thumbnailImage), spatialLabel: spatialAccess?.label || '',
      photoOnly: work.photoOnly || undefined,
      attributes: { search: data.search, year, wing: data.wing, era: data.era, place: data.place, material: data.material, maker: data.maker, makerLabel, size: spatialAccess?.status,
        studioPreviewBytes: previewBytes, studioPeekAvailable: String(work.hasPreview), studioIndex: work.index, studioIngested: work.ingested || undefined } },
  };
});

export function sortWorks(works: Work[], sort = DEFAULT_COLLECTION_SORT) {
  const compare = workComparator(sort);
  return works.map(work => ({ work, ...workSortValues(work) })).sort(compare).map(({ work }) => work);
}

export const collectionWorksByDate = sortWorks(works);
export const spatialCollectionWorksByDate = collectionWorksByDate.filter(work => work.spatialAccess.enabled);

export const collectionDataVersion = createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0,16);
export const collectionIndex = { ...packCollectionIndex(entries.map(entry => entry.metadata)), revision:collectionDataVersion };
export const collectionChunkCount = Math.ceil(entries.length / COLLECTION_CHUNK_SIZE);
export function collectionCardChunk(chunk: number) {
  return { version: 1, revision:collectionDataVersion, chunk, cards: entries.slice(chunk * COLLECTION_CHUNK_SIZE, (chunk + 1) * COLLECTION_CHUNK_SIZE).map(entry => entry.card) };
}
