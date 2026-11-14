import { makerFacetMatches } from './maker-groups.mjs';

// The browser receives catalogue metadata, never a hidden DOM card per work.
export const COLLECTION_PAGE_SIZE = 60;
export const COLLECTION_CHUNK_SIZE = 120;
export const COLLECTION_FILTER_KEYS = ['wing', 'era', 'place', 'material', 'size'];
export const COLLECTION_STATE_KEYS = ['q', 'maker', ...COLLECTION_FILTER_KEYS, 'sort', 'saved', 'density'];
export const COLLECTION_INDEX_FIELDS = ['slug', 'title', 'search', 'year', 'wing', 'era', 'place', 'material', 'maker', 'makerLabel', 'catalogIndex', 'ingested', 'size'];
const sorts = new Set(['curator', 'title', 'maker', 'date', 'newest']);
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

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
  return { ...state, sort: sorts.has(params.get('sort')) ? params.get('sort') : 'curator', saved: params.get('saved') === '1', density: params.get('density') === 'compact' ? 'compact' : 'grid' };
}

export function writeCollectionState(search, state) {
  const params = new URLSearchParams(search);
  for (const key of COLLECTION_STATE_KEYS) params.delete(key);
  for (const key of ['q', 'maker', ...COLLECTION_FILTER_KEYS]) if (String(state[key] || '').trim()) params.set(key, String(state[key]).trim());
  if (sorts.has(state.sort) && state.sort !== 'curator') params.set('sort', state.sort);
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
  const sort = sorts.has(state.sort) ? state.sort : 'curator';
  if (sort !== 'curator') matches.sort((a, b) => {
    if (sort === 'newest') return a.ingested !== b.ingested ? b.ingested.localeCompare(a.ingested) : b.catalogIndex - a.catalogIndex || a.index - b.index;
    if (sort === 'date') return (a.year ?? Infinity) - (b.year ?? Infinity) || a.index - b.index;
    return collator.compare(sort === 'maker' ? a.makerLabel : a.title, sort === 'maker' ? b.makerLabel : b.title) || a.index - b.index;
  });
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
