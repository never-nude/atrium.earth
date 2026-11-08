import { readWorldState, worldContinueUrl, UNPLACED } from './world-state.mjs';
import { workOverlapsPeriod } from './world-time.mjs';

const one = (query, key) => query.getAll(key).length === 1 ? query.get(key) : null;
const local = (base, route) => `${base === '/' ? '' : base.replace(/\/$/, '')}${route}`;
const entrySlug = entry => typeof entry === 'string' ? entry : entry.slug || entry.workSlug;

/** Only known exhibition/edition membership can replace the ordinary neighbours. */
export function exhibitionJourney(search, currentSlug, exhibitions, visits, base = '/') {
  const query = new URLSearchParams(search);
  const exhibition = exhibitions.find(item => item.slug === one(query, 'exhibition'));
  if (!exhibition) return null;
  const visit = visits.find(item => item.exhibition === exhibition.slug && item.id === one(query, 'visit'));
  const guideRequested = query.has('visit');
  if (guideRequested && !visit) return null;
  const order = visit ? visit.stops : exhibition.works;
  const index = order.findIndex(item => entrySlug(item) === currentSlug);
  if (index < 0 || (visit && one(query, 'stop') !== String(index + 1))) return null;
  const href = (item, position) => {
    const params = new URLSearchParams({ exhibition: exhibition.slug });
    if (visit) { params.set('visit', visit.id); params.set('stop', String(position + 1)); }
    return `${local(base, `/works/${entrySlug(item)}/`)}?${params}`;
  };
  const backParams = visit ? `?${new URLSearchParams({visit:visit.id,stop:String(index + 1)})}` : '';
  return {
    label: `${visit ? visit.title : exhibition.title} · ${visit ? 'Stop' : 'Work'} ${index + 1} of ${order.length}`,
    returnLabel: visit ? 'Return to guided visit' : 'Return to exhibition',
    returnHref: `${local(base, `/exhibitions/${exhibition.slug}/`)}${backParams}${visit ? '#curated-visit' : order[index].anchor || `#stop-${index + 1}`}`,
    previous: index > 0 ? { href:href(order[index-1], index-1), title:order[index-1].title } : null,
    next: index + 1 < order.length ? { href:href(order[index+1], index+1), title:order[index+1].title } : null,
  };
}

export function worldWorkHref(workUrl, state, context, pageUrl) {
  const href = worldContinueUrl(workUrl, state, context, pageUrl);
  return `${href}${href.includes('?') ? '&' : '?'}origin=world`;
}

/** Match the explorer's exact eligibility and reviewed-first ordering. */
export function worldJourney(search, currentSlug, data, pageUrl, base = '/') {
  const query = new URLSearchParams(search);
  if (one(query, 'origin') !== 'world') return null;
  const state = readWorldState(query, data);
  const placed = new Set(data.places.map(place => place.id));
  const featured = new Set(data.featured);
  const order = data.works.filter(work => workOverlapsPeriod(work,state.from,state.to,state.all))
    .filter(work => state.place === UNPLACED ? !placed.has(work.placeId) : state.place ? work.placeId === state.place : placed.has(work.placeId))
    .sort((a,b) => Number(featured.has(b.slug)) - Number(featured.has(a.slug)) || a.title.localeCompare(b.title));
  const index = order.findIndex(work => work.slug === currentSlug);
  if (index < 0) return null;
  const place = data.places.find(place => place.id === state.place);
  const back = worldContinueUrl(local(base,'/world/'), state, data, pageUrl);
  const neighbour = position => position < 0 || position >= order.length ? null : {
    href:worldWorkHref(order[position].url,state,data,pageUrl), title:order[position].title,
  };
  return {
    label: `${state.place === UNPLACED ? 'Origin uncertain' : place?.label || 'World explorer'} · Work ${index + 1} of ${order.length}`,
    returnLabel: 'Return to your world selection', returnHref:`${back}#world-results`,
    previous:neighbour(index-1), next:neighbour(index+1),
  };
}
