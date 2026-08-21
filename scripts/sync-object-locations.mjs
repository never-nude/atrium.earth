import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const catalog = JSON.parse(await fs.readFile(path.join(root, 'src/data/catalog.json'), 'utf8'));
const overrides = JSON.parse(await fs.readFile(path.join(root, 'src/data/object-location-overrides.json'), 'utf8'));
const smkTranslations = JSON.parse(await fs.readFile(path.join(root, 'src/data/smk-origin-translations.json'), 'utf8')).works || {};
const previousLocations = await fs.readFile(path.join(root, 'src/data/object-locations.json'), 'utf8')
  .then((text) => JSON.parse(text).works || {})
  .catch(() => ({}));
const asOf = process.env.LOCATION_AS_OF || new Date().toISOString().slice(0, 10);

const clean = (value) => String(value ?? '').trim();
const unique = (values) => [...new Set(values.flat().map(clean).filter(Boolean))];
const publicWorks = catalog.filter((work) => !work.hidden);
function currentTypeFor(value) {
  const text = clean(value);
  if (!text || text === 'Not documented by source') return 'undocumented';
  if (/not (?:currently )?on (?:view|display)|reserves|in storage|\bstorage\b/i.test(text)) return 'not_on_view';
  if (/\bon (?:view|display)\b|\bexhibition room\b|(?:^|[—,])\s*(?:room|gallery|level|floor|wing|case|hall)\b/i.test(text)) return 'display';
  return 'holding';
}
const output = Object.fromEntries(publicWorks.map((work) => {
  const current = clean(work.displayed_at) || clean(work.current_location) || clean(work.museum) || 'Not documented by source';
  return [work.slug, {
    current,
    current_type: currentTypeFor(current),
    source_url: (clean(work.source_record_url) || clean(work.source_url)).replace(/^http:/, 'https:'),
    checked: asOf,
    ...(previousLocations[work.slug] || {}),
  }];
}));

async function fetchJson(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) return response.json();
    const retryable = response.status === 403 || response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 3) throw new Error(`${response.status} ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 400 * (2 ** attempt)));
  }
  throw new Error(`unreachable fetch state for ${url}`);
}

async function mapConcurrent(items, limit, worker) {
  let next = 0;
  const failures = [];
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try {
        await worker(items[index]);
      } catch (error) {
        failures.push(`${items[index].slug}: ${error.message}`);
      }
    }
  }));
  return failures;
}

function smkObjectNumber(work) {
  for (const url of [work.source_record_url, work.source_url].map(clean)) {
    let match = url.match(/[?&]object_number=([^&#]+)/i);
    if (match) return decodeURIComponent(match[1]);
    match = url.match(/smk-(kas\d+)/i);
    if (match) return match[1].toUpperCase();
    match = url.match(/\/(?:image|3d)\/((?:KAS|DEP|KMS)[^?&#/]+)/i);
    if (match) return decodeURIComponent(match[1]).toUpperCase();
  }
  return /^(?:KAS|DEP|KMS)/i.test(clean(work.accession)) ? clean(work.accession).toUpperCase() : '';
}

function metObjectId(work) {
  for (const url of [work.source_record_url, work.source_url].map(clean)) {
    const match = url.match(/(?:objects\/|object\/|[?&]searchField=All&.*?)(\d{4,})/i) || url.match(/\b(\d{5,})\b/);
    if (match) return match[1];
  }
  return '';
}

function miaObjectId(work) {
  for (const url of [work.source_record_url, work.source_url].map(clean).filter((url) => /artsmia\.org/i.test(url))) {
    const match = url.match(/(?:art\/|id\/)(\d+)(?:\/|$)/i) || url.match(/\b(\d{3,})\b/);
    if (match) return match[1];
  }
  return '';
}

function smithsonianDocumentUrl(work) {
  const explicit = clean(work.source_record_url);
  if (/3d-api\.si\.edu\/content\/document\//i.test(explicit)) return explicit;
  for (const url of [work.source_url, work.source_record_url].map(clean)) {
    const match = decodeURIComponent(url).match(/([0-9a-f]{8}-[0-9a-f-]{27,36})/i);
    if (match) return `https://3d-api.si.edu/content/document/3d_package:${match[1]}/document.json`;
  }
  return '';
}

const smkWorks = publicWorks.filter((work) => /SMK/i.test(clean(work.source_institution)) && smkObjectNumber(work));
const smkCache = new Map();
const smkFailures = await mapConcurrent(smkWorks, 12, async (work) => {
  const objectNumber = smkObjectNumber(work);
  let record = smkCache.get(objectNumber);
  if (!record) {
    const payload = await fetchJson(`https://api.smk.dk/api/v1/art?object_number=${encodeURIComponent(objectNumber)}`);
    record = payload.items?.[0];
    if (!record) throw new Error(`no SMK record for ${objectNumber}`);
    smkCache.set(objectNumber, record);
  }
  const originals = Array.isArray(record.original) ? record.original : [];
  const provenance = unique(originals.flatMap((entry) => entry.object_history_note || []));
  const owners = unique(originals.flatMap((entry) => entry.current_owner || []));
  const nonGeographicSmkRecords = new Set([
    'lorenzi/portrait-of-michelangelo',
    'egyptian/portrait-of-pharaoh-amasis-smk-cast',
    'michelangelo/battle-of-the-centaurs',
    'michelangelo/madonna-of-the-stairs',
    'michelangelo/moses',
    'michelangelo/risen-christ',
    'michelangelo/medici-madonna',
    'michelangelo/dusk',
    'michelangelo/dawn',
    'michelangelo/lorenzo-duke-of-urbino',
    'michelangelo/giuliano-duke-of-nemours',
    'michelangelo/night',
    'neoclassical/marie-antoinette-1783-smk-cast',
    'neoclassical/venus-italica-canova-smk-kas-793',
  ]);
  delete output[work.slug].origin;
  delete output[work.slug].origin_type;
  if (provenance.length && !nonGeographicSmkRecords.has(work.slug)) {
    output[work.slug].origin = `Provenance: ${clean(smkTranslations[work.slug]) || provenance.join(' / ')}`;
    output[work.slug].origin_type = 'provenance';
  }
  if (owners.length) {
    const catalogHolding = clean(work.displayed_at) || clean(work.current_location) || clean(work.museum);
    output[work.slug].current = catalogHolding && !/\bSMK\b|Royal Cast Collection|National Gallery of Denmark/i.test(catalogHolding)
      ? catalogHolding
      : owners.join(' / ');
    output[work.slug].current_type = currentTypeFor(output[work.slug].current);
  }
  output[work.slug].source_url = `https://api.smk.dk/api/v1/art?object_number=${encodeURIComponent(objectNumber)}`;
  output[work.slug].checked = asOf;
});

// The Met retired object 854724 from its public API. Keep that catalog record's
// conservative fallback instead of turning the expected 404 into a soft error.
const unavailableMetSlugs = new Set(['cycladic-marble-female-figure']);
const metWorks = publicWorks.filter((work) => (
  /Metropolitan Museum|\bThe Met\b/i.test(clean(work.source_institution))
  && metObjectId(work)
  && !unavailableMetSlugs.has(work.slug)
));
const metFailures = await mapConcurrent(metWorks, 3, async (work) => {
  const objectId = metObjectId(work);
  const record = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`);
  const components = unique([
    record.locus,
    record.locale,
    record.city,
    record.county,
    record.state,
    record.subregion,
    record.region,
    record.country,
    record.river,
  ]);
  delete output[work.slug].origin;
  delete output[work.slug].origin_type;
  if (components.length) {
    const relation = clean(record.geographyType) || 'Geography (relationship unspecified)';
    output[work.slug].origin = `${relation}: ${components.join('; ')}`;
    output[work.slug].origin_type = clean(record.geographyType) || 'geography_unspecified';
  }
  output[work.slug].current = clean(record.GalleryNumber)
    ? `Metropolitan Museum of Art, New York — Gallery ${clean(record.GalleryNumber)}`
    : 'Metropolitan Museum of Art, New York — gallery not listed';
  output[work.slug].current_type = clean(record.GalleryNumber) ? 'display' : 'holding';
  output[work.slug].source_url = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`;
  output[work.slug].checked = asOf;
});

const miaWorks = publicWorks.filter((work) => /Minneapolis Institute of Art/i.test(clean(work.source_institution)) && miaObjectId(work));
const miaFailures = await mapConcurrent(miaWorks, 10, async (work) => {
  const objectId = miaObjectId(work);
  const record = await fetchJson(`https://search.artsmia.org/id/${objectId}`);
  if (!record) throw new Error(`no Mia record for ${objectId}`);
  const room = clean(record.room);
  if (room) {
    output[work.slug].current = /^G\d+$/i.test(room)
      ? `Minneapolis Institute of Art, Minneapolis — Gallery ${room.slice(1)}`
      : `Minneapolis Institute of Art, Minneapolis — ${room.toLowerCase() === 'not on view' ? 'not on view' : room}`;
    output[work.slug].current_type = room.toLowerCase() === 'not on view' ? 'not_on_view' : 'display';
  }
  output[work.slug].source_url = `https://search.artsmia.org/id/${objectId}`;
  output[work.slug].checked = asOf;
});

const smithsonianWorks = publicWorks.filter((work) => /Smithsonian/i.test(clean(work.source_institution)) && smithsonianDocumentUrl(work));
const smithsonianFailures = await mapConcurrent(smithsonianWorks, 10, async (work) => {
  const documentUrl = smithsonianDocumentUrl(work);
  const document = await fetchJson(documentUrl);
  const metadata = Array.isArray(document.metas) ? document.metas : Object.values(document.metas || {});
  const rawEntry = metadata.find((entry) => entry?.collection?.edanEntry)?.collection?.edanEntry;
  // Most Smithsonian 3D packages expose only an EDAN identifier. A full refresh
  // of those records requires an Open Access API key; absence is not a data error.
  if (!rawEntry) return;
  const entry = typeof rawEntry === 'string' ? JSON.parse(rawEntry) : rawEntry;
  const freetext = entry.content?.freetext || {};
  const placeFields = Array.isArray(freetext.place) ? freetext.place : [];
  const nameFields = Array.isArray(freetext.name) ? freetext.name : [];
  const topics = (Array.isArray(freetext.topic) ? freetext.topic : []).map((item) => clean(item.content));
  const made = unique(placeFields.filter((item) => /^(place made|made in)$/i.test(clean(item.label))).map((item) => item.content));
  const sites = unique(nameFields.filter((item) => /^site name$/i.test(clean(item.label))).map((item) => item.content));
  const places = unique(placeFields.filter((item) => /^place$/i.test(clean(item.label))).map((item) => item.content));
  const onView = unique(placeFields.filter((item) => /^on view$/i.test(clean(item.label))).map((item) => item.content));
  if (made.length) {
    output[work.slug].origin = `Made in: ${made.join(' / ')}`;
    output[work.slug].origin_type = 'made_in';
  } else if (sites.length && topics.some((topic) => /archaeology/i.test(topic))) {
    output[work.slug].origin = `Archaeological site: ${[...sites, ...places].join('; ')}`;
    output[work.slug].origin_type = 'archaeological_site';
  }
  if (onView.length) {
    output[work.slug].current = onView.join(' / ');
    output[work.slug].current_type = 'display';
  }
  output[work.slug].source_url = (clean(entry.content?.descriptiveNonRepeating?.record_link) || documentUrl).replace(/^http:/, 'https:');
  output[work.slug].checked = asOf;
});

const failureGroups = [
  ['SMK', smkFailures],
  ['Met', metFailures],
  ['Mia', miaFailures],
  ['Smithsonian', smithsonianFailures],
];
if (failureGroups.some(([, failures]) => failures.length)) {
  let missingPriorRecord = false;
  for (const [label, failures] of failureGroups) {
    if (!failures.length) continue;
    console.warn(`${label} refresh warnings (${failures.length}); preserving the last audited records:`);
    for (const failure of failures) {
      console.warn(`- ${failure}`);
      const slug = failure.split(': ')[0];
      if (!previousLocations[slug]) missingPriorRecord = true;
    }
  }
  if (missingPriorRecord || process.env.LOCATION_STRICT === '1') {
    throw new Error('Location refresh aborted; at least one failed record had no safe prior value (or strict mode was requested).');
  }
}

for (const [slug, override] of Object.entries(overrides.works || {})) {
  if (!output[slug]) throw new Error(`Location override refers to unknown or hidden slug: ${slug}`);
  output[slug] = {
    ...output[slug],
    ...override,
    // Manual records keep their last human-audited date until the override is
    // deliberately rechecked. Automated adapters set `checked` above on success.
    checked: clean(override.checked) || clean(previousLocations[slug]?.checked) || asOf,
  };
}

const payload = {
  schema: 'atrium-object-locations/1',
  as_of: asOf,
  works: output,
};
await fs.writeFile(path.join(root, 'src/data/object-locations.json'), `${JSON.stringify(payload, null, 2)}\n`);

const originCount = Object.values(output).filter((entry) => clean(entry.origin)).length;
console.log(`Locations written: ${Object.keys(output).length} current, ${originCount} source-documented origins.`);
