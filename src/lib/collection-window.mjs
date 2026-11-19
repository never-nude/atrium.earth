import { makerFacetMatches } from './maker-groups.mjs';

// The browser receives catalogue metadata, never a hidden DOM card per work.
export const COLLECTION_PAGE_SIZE = 60;
export const COLLECTION_CHUNK_SIZE = 120;
export const COLLECTION_FILTER_KEYS = ['wing', 'era', 'place', 'material', 'size'];
export const COLLECTION_STATE_KEYS = ['q', 'maker', ...COLLECTION_FILTER_KEYS, 'sort', 'saved', 'density'];
export const COLLECTION_INDEX_FIELDS = ['slug', 'title', 'search', 'year', 'wing', 'era', 'place', 'material', 'maker', 'makerLabel', 'catalogIndex', 'ingested', 'size'];
export const DEFAULT_COLLECTION_SORT = 'date-latest';
export const WORK_SORT_OPTIONS = [
  ['date-latest', 'Artwork date, newest first'],
  ['date', 'Artwork date, earliest first'],
  ['newest', 'Date added, newest first'],
  ['added-earliest', 'Date added, oldest first'],
  ['title', 'Title A–Z'],
  ['title-desc', 'Title Z–A'],
  ['maker', 'Maker A–Z'],
  ['maker-desc', 'Maker Z–A'],
];
const sorts = new Set(WORK_SORT_OPTIONS.map(([value]) => value));
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function resolveWorkSort(value, fallback = DEFAULT_COLLECTION_SORT) {
  return sorts.has(value) ? value : fallback;
}

function compareKnown(a, b, compare) {
  if (a == null || a === '') return b == null || b === '' ? 0 : 1;
  if (b == null || b === '') return -1;
  return compare(a, b);
}

const makerName = record => record.makerLabel === 'Maker not yet recorded' ? '' : record.makerLabel;
const compareWorks = {
  'date-latest': (a, b) => compareKnown(a.year, b.year, (x, y) => y - x),
  date: (a, b) => compareKnown(a.year, b.year, (x, y) => x - y),
  newest: (a, b) => compareKnown(a.ingested, b.ingested, (x, y) => y.localeCompare(x)) || b.catalogIndex - a.catalogIndex,
  'added-earliest': (a, b) => compareKnown(a.ingested, b.ingested, (x, y) => x.localeCompare(y)) || a.catalogIndex - b.catalogIndex,
  title: (a, b) => collator.compare(a.title, b.title),
  'title-desc': (a, b) => collator.compare(b.title, a.title),
  maker: (a, b) => compareKnown(makerName(a), makerName(b), collator.compare),
  'maker-desc': (a, b) => compareKnown(makerName(a), makerName(b), (x, y) => collator.compare(y, x)),
};

export function workComparator(sort) {
  const compare = compareWorks[resolveWorkSort(sort)];
  return (a, b) => compare(a, b) || a.catalogIndex - b.catalogIndex || a.slug.localeCompare(b.slug);
}

export function workCardSortValues(card) {
  const year = card.dataset.year?.trim();
  return {
    slug: card.querySelector('a[href]')?.getAttribute('href') || '',
    title: card.querySelector('h3')?.textContent?.trim() || '',
    makerLabel: card.dataset.makerLabel || '',
    year: year && Number.isFinite(Number(year)) ? Number(year) : null,
    catalogIndex: Number(card.dataset.studioIndex) || 0,
    ingested: card.dataset.studioIngested || '',
  };
}

export function normalizeCollectionText(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

export function packCollectionIndex(records) {
  return { version: 1, chunkSize: COLLECTION_CHUNK_SIZE, columns: COLLECTION_INDEX_FIELDS, works: records.map(record => COLLECTION_INDEX_FIELDS.map(key => record[key] ?? '')) };
}

export function unpackCollectionIndex(payload) {
  if (payload?.version !== 1 || payload.chunkSize !== COLLECTION_CHUNK_SIZE || JSON.stringify(payload.columns) !== JSON.stringify(COLLECTION_INDEX_FIELDS) || !Array.isArray(payload.works)) throw new Error('Unsupported collection index');
  const slugs = new Set();
  return payload.works.map((row, index) => {
    if (!Array.isArray(row) || row.length !== COLLECTION_INDEX_FIELDS.length || row.some(value => typeof value !== 'string' && typeof value !== 'number')) throw new Error('Invalid collection record');
    const record = Object.fromEntries(COLLECTION_INDEX_FIELDS.map((key, i) => [key, row[i]]));
    if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(record.slug) || slugs.has(record.slug)) throw new Error('Invalid or repeated work identity');
    slugs.add(record.slug);
    const year = String(record.year).trim();
    return { ...record, index, year: year && Number.isFinite(Number(year)) ? Number(year) : null, catalogIndex: Number(record.catalogIndex) || index,
      search: normalizeCollectionText(`${record.search} ${record.title} ${record.makerLabel}`),
      facets: Object.fromEntries(COLLECTION_FILTER_KEYS.map(key => [key, String(record[key] || '')])),
      chunk: Math.floor(index / COLLECTION_CHUNK_SIZE) };
  });
}

export function readCollectionState(search) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const state = Object.fromEntries(['q', 'maker', ...COLLECTION_FILTER_KEYS].map(key => [key, params.get(key) || '']));
  return { ...state, sort: resolveWorkSort(params.get('sort')), saved: params.get('saved') === '1', density: params.get('density') === 'compact' ? 'compact' : 'grid' };
}

export function writeCollectionState(search, state) {
  const params = new URLSearchParams(search);
  for (const key of COLLECTION_STATE_KEYS) params.delete(key);
  for (const key of ['q', 'maker', ...COLLECTION_FILTER_KEYS]) if (String(state[key] || '').trim()) params.set(key, String(state[key]).trim());
  if (resolveWorkSort(state.sort) !== DEFAULT_COLLECTION_SORT) params.set('sort', state.sort);
  if (state.saved) params.set('saved', '1');
  if (state.density === 'compact') params.set('density', 'compact');
  return params;
}

export function selectCollectionWindow(records, state, { saved = new Set(), offset = 0, limit = COLLECTION_PAGE_SIZE } = {}) {
  const terms = normalizeCollectionText(state.q).split(' ').filter(Boolean);
  const matches = records.filter(record => terms.every(term => record.search.includes(term))
    && makerFacetMatches(record.maker, state.maker)
    && (!state.saved || saved.has(record.pathname))
    && COLLECTION_FILTER_KEYS.every(key => !state[key] || (key === 'material' ? record.facets.material.split(/\s+/).includes(state[key]) : record.facets[key] === state[key])));
  matches.sort(workComparator(state.sort));
  const start = Math.max(0, Math.trunc(Number(offset) || 0));
  const size = Math.max(1, Math.trunc(Number(limit) || COLLECTION_PAGE_SIZE));
  return { total: matches.length, records: matches.slice(start, start + size), offset: start, hasMore: matches.length > start + size };
}

export function collectionPagePath(entrance, page) {
  const root = `/${String(entrance).replace(/^\/+|\/+$/g, '')}/`;
  const number = Math.max(1, Math.trunc(Number(page) || 1));
  return number === 1 ? root : `${root}page/${number}/`;
}

export function collectionPageNumber(pathname) {
  const page = /\/(?:collection|ar-vr)\/page\/([1-9]\d*)\/?$/.exec(pathname)?.[1];
  return page ? Number(page) : 1;
}
