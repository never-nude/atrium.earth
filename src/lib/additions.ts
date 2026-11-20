import rawCatalog from '../data/catalog.json';
import metadata from '../data/additions.json';
import recentSelection from '../data/recent-addition-picks.json';
import { works, worksBySlug, type Work } from './catalog';
import { buildAdditionBatches, buildNewestWorks, formatAdditionDate } from './addition-batches.mjs';

export type AdditionBatch = {
  id: string;
  date: string;
  addedAt: string;
  legacy: boolean;
  title: string;
  summary: string;
  works: Work[];
  highlights: Work[];
};

export const additionBatches: AdditionBatch[] = buildAdditionBatches(rawCatalog, works, metadata);
export const newestWorks: Work[] = buildNewestWorks(rawCatalog, works);
export const curatedRecentWorks: Work[] = recentSelection.flatMap(slug => {
  const work = worksBySlug.get(slug);
  return work?.hasPreview ? [work] : [];
});
export const latestAddition = additionBatches[0];
export const additionRoute = (batch: AdditionBatch) => `/newest/${batch.id}/`;
export { formatAdditionDate };
