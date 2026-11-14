import editions from '../data/curated-visits.json';
import previews from '../data/previews.json';
import { validateCuratedVisit } from './curated-visit.mjs';
import type { Work } from './catalog';
import type { V3Exhibition } from './v3';

export type CuratedVisit = typeof editions.visits['the-work-of-the-surface'];
export type ResolvedCuratedVisit = Omit<CuratedVisit, 'stops'> & {
  exhibitionSlug: string;
  fullWorkCount: number;
  stops: Array<CuratedVisit['stops'][number] & { work: Work }>;
};

/** Load the authored edition without modifying the exhibition or its objects. */
export function curatedVisitFor(exhibition: V3Exhibition): ResolvedCuratedVisit | null {
  const visit = (editions.visits as Record<string, CuratedVisit>)[exhibition.slug];
  if (!visit) return null;
  validateCuratedVisit(visit, { exhibitionSlug: exhibition.slug, works: exhibition.works, captions: exhibition.captions, previews });
  const works = new Map(exhibition.works.map(work => [work.slug, work]));
  return { ...visit, exhibitionSlug: exhibition.slug, fullWorkCount: exhibition.works.length,
    stops: visit.stops.map(stop => ({ ...stop, work: works.get(stop.workSlug)! })) };
}
