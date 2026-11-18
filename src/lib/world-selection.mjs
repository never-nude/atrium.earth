import { workOverlapsPeriod, formatWorldYear, timeStops } from './world-time.mjs';

export const WORLD_SELECTION_LIMIT = 12;
const slugPattern = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i;
const placePattern = /^[a-z0-9_-]+$/i;
const year = value => /^-?[1-9]\d*$/.test(value || '') && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const parameters = search => search instanceof URLSearchParams ? new URLSearchParams(search) : new URLSearchParams(search);

/** Keep the curator's existing order before alphabetic, unfeatured works. */
export function rankWorldWorks(works, featured = []) {
  const ranks = new Map(featured.map((slug, index) => [slug, index]));
  return [...works].sort((a, b) => (ranks.get(a.slug) ?? Infinity) - (ranks.get(b.slug) ?? Infinity)
    || a.title.localeCompare(b.title));
}

/** One documented-origin/date projection drives lights, cards and collection links. */
export function selectWorldWorks(works, places, state) {
  const counts = Object.fromEntries(places.map(place => [place.id, 0]));
  const eligible = works.filter(work => workOverlapsPeriod(work, state.from, state.to, state.all));
  let unplaced = 0;
  for (const work of eligible) {
    if (work.placeId && Object.hasOwn(counts, work.placeId)) counts[work.placeId]++;
    else unplaced++;
  }
  const results = eligible.filter(work => state.place === '__unplaced__' ? !Object.hasOwn(counts, work.placeId)
    : state.place ? work.placeId === state.place : Object.hasOwn(counts, work.placeId));
  return { results, counts, unplaced };
}

export function worldCollectionHref(destination, state, base = 'https://atrium.earth/') {
  const current = new URL(base);
  let url;
  try { url = new URL(destination || '/collection/', current); } catch { url = new URL('/collection/', current); }
  if (url.origin !== current.origin) url = new URL('/collection/', current);
  url.search = ''; url.hash = '';
  if (placePattern.test(state.place || '')) url.searchParams.set('origin', state.place);
  if (!state.all && Number.isSafeInteger(state.from) && Number.isSafeInteger(state.to)
    && state.from !== 0 && state.to !== 0 && state.from <= state.to) {
    url.searchParams.set('from', String(state.from));
    url.searchParams.set('to', String(state.to));
  }
  return `${url.pathname}${url.search}`;
}

export function hasWorldCollectionFilter(search) {
  return parameters(search).has('origin');
}

export function clearWorldCollectionFilter(search) {
  const params = parameters(search);
  for (const key of ['origin', 'from', 'to']) params.delete(key);
  return params;
}

/** Invalid or unavailable origin metadata must never silently show all works. */
export function readWorldCollectionFilter(search, data) {
  const params = parameters(search);
  if (!params.has('origin')) return null;
  if (!Array.isArray(data?.places) || !Array.isArray(data?.works)
    || !data.places.length || !Number.isFinite(data.dateMin) || !Number.isFinite(data.dateMax)
    || data.dateMin > data.dateMax) throw new Error('Origin metadata is unavailable');
  const known = new Set();
  for (const place of data.places) {
    if (!placePattern.test(place?.id || '') || typeof place.label !== 'string' || !place.label.trim()
      || known.has(place.id)) throw new Error('Origin metadata is invalid');
    known.add(place.id);
  }
  const id = params.get('origin');
  const place = data.places.find(item => item.id === id);
  if (params.getAll('origin').length !== 1 || !placePattern.test(id || '') || (!place && id !== '__unplaced__')) {
    throw new Error('This documented origin is unavailable');
  }
  const stops = timeStops(data.dateMin, data.dateMax);
  const hasPeriod = params.has('from') || params.has('to');
  const from = hasPeriod ? year(params.get('from')) : stops[0];
  const to = hasPeriod ? year(params.get('to')) : stops.at(-1);
  if (hasPeriod && (params.getAll('from').length !== 1 || params.getAll('to').length !== 1
    || from === null || to === null || from > to || from < stops[0] || to > stops.at(-1))) {
    throw new Error('This origin has an unavailable date range');
  }
  const slugs = new Set();
  const identities = new Set();
  for (const work of data.works) {
    if (typeof work?.slug !== 'string' || !slugPattern.test(work.slug)
      || identities.has(work.slug) || (work.placeId !== null && !known.has(work.placeId))
      || (work.start === null) !== (work.end === null)
      || (work.start !== null && (!Number.isFinite(work.start) || !Number.isFinite(work.end)
        || work.start > work.end))) throw new Error('Origin metadata is invalid');
    identities.add(work.slug);
  }
  const state = { place: id, from, to, all: !hasPeriod };
  const { results } = selectWorldWorks(data.works, data.places, state);
  for (const work of results) slugs.add(work.slug);
  return { ...state, label: place?.label || 'Origin uncertain or unrecorded', slugs,
    periodLabel: hasPeriod ? `${formatWorldYear(from)} — ${formatWorldYear(to)}` : 'All periods' };
}
