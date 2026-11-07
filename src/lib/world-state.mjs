import { timeStops } from './world-time.mjs';

export const UNPLACED = '__unplaced__';
const integerYear = text => typeof text === 'string' && /^-?[1-9]\d*$/u.test(text)
  && Number.isSafeInteger(Number(text)) ? Number(text) : null;

/** Invalid URL fields fall back independently; invalid date pairs use all time. */
export function readWorldState(search, { places = [], dateMin, dateMax } = {}) {
  const query = new URLSearchParams(search);
  const one = key => query.getAll(key).length === 1 ? query.get(key) : null;
  const known = new Set(places.map(place => typeof place === 'string' ? place : place.id));
  const requestedPlace = one('place');
  const place = requestedPlace === UNPLACED || known.has(requestedPlace) ? requestedPlace : '';
  const stops = timeStops(dateMin, dateMax);
  const from = integerYear(one('from')), to = integerYear(one('to'));
  const validPeriod = from !== null && to !== null && from <= to && from >= stops[0] && to <= stops.at(-1);
  const all = !validPeriod || (from === stops[0] && to === stops.at(-1));
  return { place, mode: one('mode') === 'map' ? 'map' : 'globe', all,
    from: all ? stops[0] : from, to: all ? stops.at(-1) : to };
}

/** Create a same-origin handoff; no stale query/fragment or arbitrary destination. */
export function worldContinueUrl(detailUrl, state, context, base = 'https://atrium.earth/') {
  const origin = new URL(base);
  let destination;
  try { destination = new URL(detailUrl || '/world/', origin); } catch { destination = new URL('/world/', origin); }
  if (destination.origin !== origin.origin) destination = new URL('/world/', origin);
  destination.search = ''; destination.hash = '';
  const candidate = new URLSearchParams();
  if (typeof state.place === 'string' && state.place) candidate.set('place', state.place);
  if (!state.all) { candidate.set('from', String(state.from)); candidate.set('to', String(state.to)); }
  candidate.set('mode', state.mode);
  const valid = readWorldState(candidate, context);
  if (valid.place) destination.searchParams.set('place', valid.place);
  if (!valid.all) { destination.searchParams.set('from', String(valid.from)); destination.searchParams.set('to', String(valid.to)); }
  destination.searchParams.set('mode', valid.mode);
  return `${destination.pathname}${destination.search}`;
}
