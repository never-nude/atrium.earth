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
for (const geography of ['Congo', 'Turkey or Syria', 'Egypt (possibly)', 'France; Copenhagen, Denmark', 'Nigeria / Benin', 'Central Asia (Sogdiana) or Tibet']) {
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
assert.equal(origin({ geography: 'Gabon / Equatorial Guinea / Cameroon (Fang region)' }), 'fang-region');
assert.equal(origin({ geography: 'Nigeria / Benin', culture: 'Yoruba' }), 'yoruba-region');
assert.equal(origin({ geography: 'Gandhara (present-day Afghanistan or Pakistan)', culture: 'Gandharan' }), 'gandhara');
assert.equal(origin({ geography: 'Italy (Etruscan; exact workshop unknown)' }), 'italy');
assert.equal(origin({ culture: 'Ancient Roman' }), 'mediterranean');
assert.equal(origin({ culture: 'Roman', geography: 'Possibly Smyrna, Ionia' }), null);
assert.equal(origin({ title: 'SMK plaster cast', culture: 'Ancient Roman' }), null);

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
assert.ok(world.works.some(work => work.slug === 'asia/ganesha-mia'), 'The restored Minneapolis Ganesha has its own entry.');
assert.ok(world.works.some(work => work.slug === 'asia/ganesha-java-mia'));
const byId = new Map(world.places.map(place => [place.id, place]));
const rawBySlug = new Map(records.map(record => [record.slug, record]));

// Restore these records on the reviewed evidence without relaxing the
// general geography, competing countries, or current holdings checks.
const recoveredOrigins = {
  'americas/zuni-owl-jug-yale': 'united-states-of-america',
  'oceania/hoa-hakananai-a-british-museum': 'rapa-nui',
  'europe/vendel-i-helmet-5a810a': 'sweden',
  'europe/vendel-xii-helmet-8c297f': 'sweden',
  'europe/vendel-xiv-helmet-be9b5b': 'sweden',
  'asia/supports-with-addorsed-figures-cleveland-2011-144-8dec5f': 'tibetan-plateau',
  'asia/piggy-bank-14bfd1': 'indonesia',
  'asia/raft-cup-cleveland-1977-7-a254ff': 'china',
  'asia/monster-caryatid-cleveland-1957-357-70d852': 'china',
  'europe/ceremonial-cross-of-count-liudolf-cleveland-1931-461': 'germany',
  'michelangelo/bearded-captive-smk-cast': 'italy',
  'roman/ciste-a-cordoni-hassle-96979-hst': 'italy',
  'egyptian/false-door-irienakhet-mia': 'egypt',
};
const worksBySlug = new Map(world.works.map(work => [work.slug, work]));
for (const [slug, placeId] of Object.entries(recoveredOrigins)) {
  assert.equal(worksBySlug.get(slug)?.placeId, placeId, slug);
  assert.equal(worksBySlug.get(slug)?.originReason, 'reviewed-origin', slug);
}
for (const slug of [
  'roman/aesculapius-allard-pierson-35-902763',
  'europe/stockholm-jousting-helmet-a4eea3',
  'europe/dancing-satyr-krakow-cast-rz11-2a7661',
  'europe/marcellus-as-hermes-historical-germanicus-plaster-cast-bed74a',
]) {
  assert.equal(worksBySlug.get(slug)?.placeId, null, slug);
  assert.equal(worksBySlug.get(slug)?.originReason, 'reviewed-origin-uncertain', slug);
}
const zuni = rawBySlug.get('americas/zuni-owl-jug-yale');
assert.equal(origin({ ...zuni, accession: 'Different accession' }), null);
assert.equal(origin({ ...zuni, source_record_url: 'https://example.org/different-object' }), null);
assert.equal(origin({ ...zuni, origin_country: 'Mexico' }), null, 'A conflicting origin revision revokes the reviewed exception.');
assert.equal(origin({ ...zuni, title: 'Digital Reconstruction' }), null, 'The existing reconstruction guard applies first.');
const vendel = rawBySlug.get('europe/vendel-i-helmet-5a810a');
assert.equal(origin({ ...vendel, slug: 'europe/unreviewed-helmet' }), null, 'Institution-like findspot wording needs record-specific evidence.');
const beardedCaptive = rawBySlug.get('michelangelo/bearded-captive-smk-cast');
assert.equal(origin({ ...beardedCaptive, slug: 'michelangelo/unreviewed-cast' }), null, 'A cast destination does not establish a manufacture site.');

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
const middleNiger = world.works.find(work => work.slug === 'sub-saharan-africa/seated-figure-middle-niger');
assert.equal(middleNiger.placeId, 'middle-niger', 'The published Met culture and country support the region.');
assert.equal(middleNiger.originReason, 'primary-record-cultural-region');
assert.deepEqual([middleNiger.start, middleNiger.end], [1200, 1299]);
const middleNigerRecord = rawBySlug.get(middleNiger.slug);
assert.equal(origin({ ...middleNigerRecord, source_url: '' }), null, 'The Met holding alone does not establish origin.');
assert.equal(origin({ ...middleNigerRecord, accession: 'Unverified accession' }), null);

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

// Physical creation dates from the new collection records remain usable even
// when a separate attribution or prototype has a different date in the context.
for (const [slug, expected] of [
  ['europe/triton-and-nymph-after-tilgner-mirbach', { start: 1981, end: 1981 }],
  ['europe/nymph-with-scorpion-bartolini-louvre', { start: 1835, end: 1845 }],
  ['americas/clytie-rinehart-met', { start: 1872, end: 1872 }],
  ['europe/bather-or-nymph-at-bath-nga', { start: 1700, end: 1799 }],
]) {
  const record = records.find(work => work.slug === slug);
  assert.ok(record, `Missing dated physical object: ${slug}`);
  assert.deepEqual(worldDateSpan(record), expected, `Physical creation span: ${slug}`);
}
