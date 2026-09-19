import rawCatalog from '../data/catalog.json';
import metadata from '../data/additions.json';
import { works, type Work } from './catalog';
import { buildAdditionBatches, formatAdditionDate } from './addition-batches.mjs';

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
export const latestAddition = additionBatches[0];
export const additionRoute = (batch: AdditionBatch) => `/newest/${batch.id}/`;
export { formatAdditionDate };
