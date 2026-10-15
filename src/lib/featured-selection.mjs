// Curatorial membership is explicit: new imports never enter a featured pool
// until this review is updated. Keep selection and rotation shared by all pages.
export const FEATURED_WORK_COUNT = 250;
export const HOMEPAGE_PREVIEW_LIMIT = 15 * 1024 * 1024;

export function buildFeaturedSelection(review, works, renders) {
  if (review.schema !== 'atrium-featured/1' || review.works?.length !== FEATURED_WORK_COUNT) {
    throw new Error(`Featured review must contain exactly ${FEATURED_WORK_COUNT} works.`);
  }
  const bySlug = new Map(works.map(work => [work.slug, work]));
  const seen = new Set();
  return review.works.map(entry => {
    if (seen.has(entry.slug)) throw new Error(`Duplicate featured work: ${entry.slug}`);
    seen.add(entry.slug);
    const work = bySlug.get(entry.slug);
    if (!work || work.hidden || !work.hasPreview || !renders.has(entry.slug)) {
      throw new Error(`Featured work needs a public model and rendered thumbnail: ${entry.slug}`);
    }
    if (!entry.reason?.trim()) throw new Error(`Featured work has no curatorial reason: ${entry.slug}`);
    if (typeof entry.homepage !== 'boolean') throw new Error(`Featured work needs an explicit homepage decision: ${entry.slug}`);
    return work;
  });
}

export function featuredForDate(pool, date = new Date()) {
  if (!pool.length) throw new Error('No reviewed featured works are available.');
  const shuffled = [...pool].sort((a, b) => stableHash(`atrium5-featured:${a.slug}`) - stableHash(`atrium5-featured:${b.slug}`));
  const anchorIndex = Math.max(0, shuffled.findIndex(work => work.slug === 'rodin/the-thinker'));
  const anchorWeek = utcWeekIndex(new Date(Date.UTC(2026, 5, 3)));
  return shuffled[positiveMod(anchorIndex + utcWeekIndex(date) - anchorWeek, shuffled.length)];
}

export function homepageHeroForDate(featured, previews, date = new Date()) {
  const pool = featured.filter(work => (
    Number.isFinite(previews[work.slug]?.bytes)
    && previews[work.slug].bytes > 0
    && previews[work.slug].bytes <= HOMEPAGE_PREVIEW_LIMIT
  ));
  if (!pool.length) throw new Error('No reviewed featured model meets the homepage loading budget.');
  const seed = 'atrium-homepage-featured/1';
  const launchSlug = 'michelangelo/david';
  const shuffled = [...pool].sort((a, b) => (
    stableHash(`${seed}:${a.slug}`) - stableHash(`${seed}:${b.slug}`)
    || a.slug.localeCompare(b.slug)
  ));
  const launchIndex = Math.max(0, shuffled.findIndex(work => work.slug === launchSlug));
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const rotation = Math.floor((day - Date.UTC(2026, 9, 15)) / (3 * 86400000));
  return shuffled[positiveMod(launchIndex + rotation, shuffled.length)];
}

function utcWeekIndex(date) {
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((day - Date.UTC(1970, 0, 4)) / (7 * 86400000));
}

function positiveMod(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

function stableHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
