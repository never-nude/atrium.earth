import { works } from './catalog';
import rawCatalog from '../data/catalog.json';
import corrections from '../data/identity-corrections.json';
import placesData from '../data/world-places.json';
import { buildWorldCollection } from './world-collection.mjs';

export type WorldRegion = 'Europe' | 'Africa' | 'Asia' | 'Americas' | 'Oceania' | 'Transregional';
export type WorldPlace = { id: string; label: string; lat: number; lon: number; region: WorldRegion; color: string; precision: 'country' | 'region' };
export type WorldWork = {
  slug: string;
  title: string;
  maker: string;
  dateLabel: string;
  start: number | null;
  end: number | null;
  placeId: string | null;
  thumbnail: string;
  url: string;
  sourceLabel: string;
  sourceUrl: string;
};
export type WorldCollection = {
  places: WorldPlace[];
  works: WorldWork[];
  unplacedCount: number;
  undatedCount: number;
  totalCount: number;
  dateMin: number | null;
  dateMax: number | null;
};

// The catalog's normalized geography deliberately includes folder/title fallbacks.
// Only its public identity, thumbnail and route are used here; origin/date evidence
// comes from the explicit raw record after existing identity corrections.
const projected = buildWorldCollection({ records: rawCatalog, publicWorks: works, placesData, corrections });
export const worldCollection: WorldCollection = {
  places: projected.places as WorldPlace[],
  works: projected.works as WorldWork[],
  unplacedCount: projected.unplacedCount,
  undatedCount: projected.undatedCount,
  totalCount: projected.totalCount,
  dateMin: projected.dateMin,
  dateMax: projected.dateMax,
};
