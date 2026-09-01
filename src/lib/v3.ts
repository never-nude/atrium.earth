import v3Content from '../data/v3-content.json';
import { homepageHeroWorkForDate, recentlyPrepared, workBySlug, works, type Work } from './catalog';
import { exhibitions as baseExhibitions, featuredWork, neighborsFor, type V2Exhibition } from './v2';

export type V3Exhibition = V2Exhibition & {
  coda: string;
  captions: Record<string, string>;
};

export type V3Pairing = {
  title: string;
  line: string;
  a: Work;
  b: Work;
};

type WallText = { invitation: string; coda: string; captions: Array<{ slug: string; text: string }> };
type NewExhibitionSeed = {
  slug: string; title: string; kicker: string; summary: string;
  invitation: string; coda: string; accent: string;
  works: Array<{ slug: string; text: string }>;
};
type PairingSeed = { title: string; a: string; b: string; line: string };

const wallTexts = (v3Content as { wallTexts: Record<string, WallText> }).wallTexts;
const newExhibitionSeed = (v3Content as { newExhibition: NewExhibitionSeed }).newExhibition;
const pairingSeeds = (v3Content as { pairings: PairingSeed[] }).pairings;

function captionMap(entries: Array<{ slug: string; text: string }>): Record<string, string> {
  return Object.fromEntries(entries.map((entry) => [entry.slug, entry.text]));
}

const enriched: V3Exhibition[] = baseExhibitions.map((exhibition) => {
  const wall = wallTexts[exhibition.slug];
  return {
    ...exhibition,
    invitation: wall?.invitation || exhibition.invitation,
    coda: wall?.coda || '',
    captions: wall ? captionMap(wall.captions) : {},
  };
});

const otherKingdomWorks = newExhibitionSeed.works
  .map((entry) => workBySlug(entry.slug))
  .filter((work): work is Work => Boolean(work));

const otherKingdom: V3Exhibition = {
  slug: newExhibitionSeed.slug,
  number: String(enriched.length + 1).padStart(2, '0'),
  title: newExhibitionSeed.title,
  shortTitle: 'Animals',
  kicker: newExhibitionSeed.kicker,
  summary: newExhibitionSeed.summary,
  invitation: newExhibitionSeed.invitation,
  coda: newExhibitionSeed.coda,
  accent: newExhibitionSeed.accent,
  works: otherKingdomWorks,
  captions: captionMap(newExhibitionSeed.works),
};

// Guard the build against future catalog re-slugs: a room with no resolvable
// works drops out gracefully instead of throwing at prerender (works[0]).
export const exhibitions: V3Exhibition[] = [...enriched, otherKingdom].filter(
  (exhibition) => exhibition.works.length > 0,
);

export const pairings: V3Pairing[] = pairingSeeds
  .map((seed) => {
    const a = workBySlug(seed.a);
    const b = workBySlug(seed.b);
    return a && b ? { title: seed.title, line: seed.line, a, b } : null;
  })
  .filter((pair): pair is V3Pairing => Boolean(pair));

export const homepageFeaturedWork = homepageHeroWorkForDate();
export { featuredWork, neighborsFor, works };
export const collectionCount = works.length;
export const newToCollection = recentlyPrepared(10);

export function v3WorkRoute(work: Work | string): string {
  const slug = typeof work === 'string' ? work : work.slug;
  return `/works/${slug}/`;
}

export function v3ExhibitionRoute(exhibition: V3Exhibition | string): string {
  const slug = typeof exhibition === 'string' ? exhibition : exhibition.slug;
  return `/exhibitions/${slug}/`;
}

export function exhibitionBySlug(slug: string): V3Exhibition | undefined {
  return exhibitions.find((exhibition) => exhibition.slug === slug);
}

export function nextExhibition(current: V3Exhibition): V3Exhibition {
  const index = exhibitions.findIndex((exhibition) => exhibition.slug === current.slug);
  return exhibitions[(index + 1) % exhibitions.length];
}

/** Wall texts written for this work across all exhibitions it appears in. */
export function wallTextsForWork(slug: string): Array<{ exhibition: V3Exhibition; text: string }> {
  return exhibitions
    .filter((exhibition) => exhibition.captions[slug])
    .map((exhibition) => ({ exhibition, text: exhibition.captions[slug] }));
}
