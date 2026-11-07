import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildWorldCollection, resolveWorldOrigin, worldDateSpan } from '../src/lib/world-collection.mjs';

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const placesData = read('../src/data/world-places.json');
const records = read('../src/data/catalog.json');
const corrections = read('../src/data/identity-corrections.json');
const origin = record => resolveWorldOrigin(record, placesData).placeId;
const span = year => worldDateSpan({ year });

assert.equal(origin({ geography: 'Florence, Italy' }), 'italy');
assert.equal(origin({ geography: 'Jaina Island region, Campeche, Mexico' }), 'mexico');
assert.equal(origin({ geography: 'Korea; exact findspot unknown' }), 'korea-region');
assert.equal(origin({ geography: 'Rapa Nui (Chile)' }), 'rapa-nui');
assert.equal(origin({ geography: 'Benin, Nigeria' }), 'nigeria');
assert.equal(origin({ geography: 'Côte d’Ivoire' }), origin({ geography: "Cote d'Ivoire" }));
assert.equal(origin({ geography: 'Georgia' }), null, 'An ambiguous name does not imply the country rather than a US state.');
assert.equal(origin({ origin_country: 'Georgia' }), 'georgia', 'The explicit country field resolves that ambiguity.');
for (const geography of ['Congo', 'Turkey or Syria', 'Egypt (possibly)', 'France; Copenhagen, Denmark', 'Gabon / Equatorial Guinea / Cameroon (Fang region)', 'Central Asia (Sogdiana) or Tibet']) {
  assert.equal(origin({ geography }), null, geography);
}
for (const geography of ['Musée du Louvre, France', 'Minneapolis Institute of Art, USA', 'The Royal Cast Collection, Copenhagen, Denmark', 'Captured in London, England', 'France (artist nationality)']) {
  assert.equal(origin({ geography }), null, geography);
}
assert.equal(origin({ original_location: 'Metropolitan Museum of Art, New York, USA' }), null);
assert.equal(origin({ original_location: 'Paris, France', museum: 'Paris, France' }), null);
assert.equal(origin({ title: 'Athena', collection: 'greek', artist: 'French artist', culture: 'Greek' }), null, 'No title, nationality, culture or folder fallback.');
assert.equal(origin({ title: 'SMK plaster cast', accession: 'KAS123', geography: 'Copenhagen, Denmark' }), null, 'A cast holding is not a manufacture origin.');
assert.equal(origin({ title: 'SMK plaster cast', accession: 'KAS123', geography: 'Rome; Malpieri workshop', origin_country: 'Italy' }), 'italy');
assert.equal(origin({ origin_country: 'Italy', geography: 'France' }), null);
assert.equal(origin({ title: 'Digital Reconstruction', geography: 'France' }), null);

assert.deepEqual(span('1501–1504'), { start: 1501, end: 1504 });
assert.deepEqual(span('1900–01'), { start: 1900, end: 1901 });
assert.deepEqual(span('883–859 BCE'), { start: -883, end: -859 });
assert.deepEqual(span('50 BCE–50 CE'), { start: -50, end: 50 });
assert.deepEqual(span('c. 28,000–25,000 BCE'), { start: -28000, end: -25000 });
assert.deepEqual(span('6th–7th century'), { start: 500, end: 699 });
assert.deepEqual(span('13th century'), { start: 1200, end: 1299 });
assert.deepEqual(span('6th–5th century BCE'), { start: -600, end: -401 });
assert.deepEqual(span('Second half of the 12th century'), { start: 1100, end: 1199 });
assert.deepEqual(worldDateSpan({ year: '21st century', ingested: '2026-11-02' }), { start: 2000, end: 2026 });
assert.deepEqual(worldDateSpan({ title: 'SMK plaster cast', year: '1852–1870 cast' }), { start: 1852, end: 1870 });
assert.deepEqual(worldDateSpan({ title: 'X (plaster cast)', year: '2nd century CE' }), { start: null, end: null }, 'A cast title cannot turn a generic prototype century into production evidence.');
assert.deepEqual(worldDateSpan({ title: 'X (plaster cast)', year: '1852–1870' }), { start: null, end: null }, 'Modern-looking dates also need a production-event basis.');
assert.deepEqual(worldDateSpan({ title: 'Ancient statue', accession: 'KAS123', year: '2nd century' }), { start: null, end: null });
for (const year of ['modeled 1880; cast 1900–1901', '1897 cast; after the 1497–1500 original', 'production date unknown; acquired 1909', 'Cast date unrecorded', 'after 1880', 'before 1887', '1936 composition; scanned example undated', '2022 (published)', 'Date not yet recorded', '']) {
  assert.deepEqual(span(year), { start: null, end: null }, year);
}
assert.deepEqual(worldDateSpan({ year: '', year_sort: 1909 }), { start: null, end: null }, 'Sort values never supply missing dates.');

const publicWorks = records.filter(record => !record.hidden).map(record => ({
  slug: record.slug, title: corrections[record.slug]?.title || record.title,
  maker: record.artist, displayDate: corrections[record.slug]?.catalog?.year || record.year,
  route: `/works/${record.slug}/`, thumbnailImage: `/previews/renders/${record.slug}/thumb.webp`,
}));
const world = buildWorldCollection({ records, publicWorks, placesData, corrections });
assert.equal(world.totalCount, records.filter(record => !record.hidden).length);
assert.equal(new Set(world.works.map(work => work.slug)).size, world.totalCount);
assert.ok(!world.works.some(work => work.slug === 'asia/ganesha-mia'), 'The consolidated hidden alternate stays out.');
assert.ok(world.works.some(work => work.slug === 'asia/ganesha-java-mia'));
const byId = new Map(world.places.map(place => [place.id, place]));
const rawBySlug = new Map(records.map(record => [record.slug, record]));
const allowedRegions = ['Europe', 'Africa', 'Asia', 'Americas', 'Oceania', 'Transregional'];
for (const place of placesData.places) {
  assert.ok(Number.isFinite(place.lat) && Math.abs(place.lat) <= 90, place.id);
  assert.ok(Number.isFinite(place.lon) && Math.abs(place.lon) <= 180, place.id);
  assert.ok(allowedRegions.includes(place.region));
  assert.ok(['country', 'region'].includes(place.precision));
  assert.match(place.color, /^#[0-9a-f]{6}$/iu);
}
assert.equal(new Set(placesData.places.map(place => place.id)).size, placesData.places.length);
for (const work of world.works) {
  assert.ok(work.placeId === null || byId.has(work.placeId));
  assert.equal(work.start === null, work.end === null);
  if (work.start !== null) assert.ok(Number.isFinite(work.start) && Number.isFinite(work.end) && work.start <= work.end);
  assert.ok(work.url.startsWith('/works/'));
  const record = rawBySlug.get(work.slug);
  assert.equal(work.dateLabel, corrections[work.slug]?.catalog?.year || record.year || 'Date not yet recorded');
}
assert.equal(world.unplacedCount, world.works.filter(work => work.placeId === null).length);
assert.equal(world.undatedCount, world.works.filter(work => work.start === null).length);
assert.equal(world.dateMin, Math.min(...world.works.filter(work => work.start !== null).map(work => work.start)));
assert.equal(world.dateMax, Math.max(...world.works.filter(work => work.end !== null).map(work => work.end)));
const datedCasts = [];
for (const raw of records) {
  const record = { ...raw, ...(corrections[raw.slug]?.catalog ?? {}) };
  if (record.hidden) continue;
  const isCast = /^KAS\d/iu.test(record.accession ?? '')
    || /\b(?:plaster cast|royal cast collection)\b/iu.test(`${record.title ?? ''} ${record.material ?? ''} ${record.scan_source ?? ''}`);
  if (isCast && worldDateSpan(record).start !== null) datedCasts.push(record);
}
assert.deepEqual(datedCasts.map(record => record.slug), ['europe/apollo-olympia-ashmolean-cast-c75757', 'europe/dancing-satyr-krakow-cast-rz11-2a7661']);
assert.deepEqual(worldDateSpan(datedCasts[0]), { start: 1851, end: 1900 });
assert.deepEqual(worldDateSpan(datedCasts[1]), { start: 1800, end: 1899 });
for (const record of datedCasts) {
  assert.deepEqual(worldDateSpan({ ...record, note: '' }), { start: null, end: null }, 'Removing reviewed production evidence fails closed.');
  assert.deepEqual(worldDateSpan({ ...record, source_record_url: 'https://example.org/unrelated' }), { start: null, end: null });
  assert.deepEqual(worldDateSpan({ ...record, year: '2nd century CE' }), { start: null, end: null });
}
const thinker = world.works.find(work => work.slug === 'rodin/the-thinker');
assert.equal(thinker.placeId, null); assert.equal(thinker.start, null);
const david = world.works.find(work => work.slug === 'michelangelo/david');
assert.equal(david.placeId, 'italy'); assert.deepEqual([david.start, david.end], [1501, 1504]);
const museumOnly = world.works.find(work => work.slug === 'sub-saharan-africa/seated-figure-middle-niger');
assert.equal(museumOnly.placeId, null, 'The Met holding cannot supply an origin absent from raw fields.');
assert.deepEqual([museumOnly.start, museumOnly.end], [1200, 1299]);

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const entry of Object.values(value)) freeze(entry); }
  return value;
}
const fixture = freeze({
  records: [{ slug: 'shown', title: 'Shown', geography: 'Italy', year: '1900' }, { slug: 'hidden', hidden: true, geography: 'France', year: '2000' }],
  publicWorks: [{ slug: 'shown', title: 'Shown', displayDate: '1900', route: '/works/shown/', thumbnailImage: '/previews/shown.webp' }, { slug: 'hidden', route: '/works/hidden/' }],
  placesData: structuredClone(placesData),
});
const snapshot = JSON.stringify(fixture);
const result = buildWorldCollection(fixture);
assert.equal(result.totalCount, 1); assert.equal(result.works[0].placeId, 'italy');
assert.equal(JSON.stringify(fixture), snapshot);
const corrected = buildWorldCollection({ ...fixture, corrections: { shown: { catalog: { geography: 'China' } } } });
assert.equal(corrected.works[0].placeId, 'china', 'Existing identity corrections override inherited geography.');
const empty = buildWorldCollection({ records: [], publicWorks: [], placesData });
assert.equal(empty.dateMin, null); assert.equal(empty.dateMax, null);

console.log(JSON.stringify({ passed: true, total: world.totalCount, placed: world.totalCount - world.unplacedCount,
  unplaced: world.unplacedCount, dated: world.totalCount - world.undatedCount, undated: world.undatedCount,
  places: world.places.length, dateMin: world.dateMin, dateMax: world.dateMax, originReasons: world.originReasons }, null, 2));
