import rawCatalog from '../data/catalog.json';
import metadata from '../data/additions.json';
import recentSelection from '../data/recent-addition-picks.json';
import { works, type Work } from './catalog';
import { buildAdditionBatches, buildNewestWorks, buildRecentModelWorks, formatAdditionDate } from './addition-batches.mjs';

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
const recentModels = new Map<string, Work>(buildRecentModelWorks(rawCatalog, works, 300).map(work => [work.slug, work]));
export const curatedRecentWorks: Work[] = recentSelection.flatMap(slug => {
  const work = recentModels.get(slug);
  return work ? [work] : [];
});
export const latestAddition = additionBatches[0];
export const additionRoute = (batch: AdditionBatch) => `/newest/${batch.id}/`;
export { formatAdditionDate };
