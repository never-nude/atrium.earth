const text = value => typeof value === 'string' ? value.trim() : '';
const key = value => text(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[’']/gu, ' ').replace(/&/gu, ' and ').replace(/[^a-z0-9]+/gu, ' ').trim().replace(/\s+/gu, ' ');
const unknown = { start: null, end: null };
const uncertainty = /\b(?:or|possibly|probably|perhaps|uncertain|unconfirmed|unrecorded|unknown|unverified|unidentified|not (?:yet )?(?:known|recorded|established|documented|confirmed))\b|\?/iu;
const holdingOrCapture = /\b(?:museum|musee|museu|museo|institute|library|foundation|university|smithsonian|abbey|church|monastery|cathedral|gallery|galleries|collection|collections|captur(?:e|ed)|scan(?:ned|ning)?|photogrammetry|display(?:ed)?|held|holding|installed|installation|studio|artist|nationality|inspired)\b/iu;
const production = /\b(?:made|manufactur(?:e|ed)|production|produced|casting|cast in|cast at|workshop|foundry)\b/iu;

function castRecord(record) {
  return /^KAS\d/iu.test(text(record.accession))
    || /\b(?:plaster cast|royal cast collection)\b/iu.test(`${record.title ?? ''} ${record.material ?? ''} ${record.scan_source ?? ''}`);
}

// These two existing catalogue records explicitly date the captured casts in
// their object-specific notes. Bind the exceptions to that evidence; a cast's
// title or an ancient prototype date alone can never establish production time.
const reviewedCastDates = {
  'europe/apollo-olympia-ashmolean-cast-c75757': {
    label: '1851–1900', accession: 'CG.A.59',
    source: 'https://www.ashmolean.org/node/4052691',
    evidence: 'The Ashmolean dates its cast to 1851–1900',
  },
  'europe/dancing-satyr-krakow-cast-rz11-2a7661': {
    label: '19th century', accession: 'Rz 11',
    source: 'https://muzea.malopolska.pl/en/objects-list/2274',
    evidence: 'A nineteenth-century teaching cast',
  },
};

function castProductionDateSupported(record, label) {
  if (/\bcast(?:ing)?\b/iu.test(label)) return true;
  const reviewed = reviewedCastDates[record.slug];
  return Boolean(reviewed && label === reviewed.label
    && text(record.accession) === reviewed.accession
    && text(record.source_record_url).replace(/\/+$/u, '') === reviewed.source
    && text(record.note).includes(reviewed.evidence));
}

function aliasIndex(places, countryField = false) {
  const index = new Map();
  for (const place of places) {
    for (const alias of [...(place.aliases ?? []), ...(countryField ? place.countryFieldAliases ?? [] : [])]) {
      const normalized = key(alias);
      if (!normalized) continue;
      if (index.has(normalized) && index.get(normalized)?.id !== place.id) index.set(normalized, null);
      else if (!index.has(normalized)) index.set(normalized, place);
    }
  }
  return index;
}

function placeFromLabel(value, index) {
  // A documented country can remain known when only the exact findspot is unknown.
  const label = text(value).replace(/[,;]\s*exact findspot (?:is )?unknown\.?$/iu, '').trim();
  if (!label || uncertainty.test(label) || holdingOrCapture.test(key(label)) || /\b(?:after|prototype|composition)\b/iu.test(label)) return null;
  const direct = index.get(key(label));
  if (direct) return direct;
  const plain = label.replace(/\([^)]*\)/gu, '').trim();
  if (index.get(key(plain))) return index.get(key(plain));
  const parts = plain.split(/[,;/]+/u).map(part => key(part)
    .replace(/^(?:made in|manufactured in|produced in|cast in|from|present day) /u, '')).filter(Boolean);
  const matches = new Map();
  for (const part of parts) {
    const exact = index.get(part);
    if (exact) { matches.set(exact.id, exact); continue; }
    // An explicit country at the end of a geographic description supports only
    // its broad country point, never a guessed city within it.
    for (const [alias, place] of index) {
      if (place?.precision === 'country' && alias.length > 3 && part.endsWith(` ${alias}`)) matches.set(place.id, place);
    }
  }
  const countries = [...matches.values()].filter(place => place.precision === 'country');
  if (countries.length > 1) return null;
  if (countries.length === 1) {
    return [...matches.values()].some(place => place.region !== countries[0].region && place.region !== 'Transregional') ? null : countries[0];
  }
  return matches.size === 1 ? [...matches.values()][0] : null;
}

/** Resolve recorded origin, never normalized folder/title fallbacks or holdings. */
function resolveOrigin(record, { general, countries }) {
  if (/\b(?:digital reconstruction|virtual material study)\b/iu.test(`${record.title ?? ''} ${record.material ?? ''}`)) {
    return { placeId: null, reason: 'reconstruction-origin-unresolved' };
  }
  const countryLabel = text(record.origin_country);
  const geography = text(record.geography);
  const original = text(record.original_location);
  if (countryLabel && uncertainty.test(countryLabel)) return { placeId: null, reason: 'uncertain-origin' };
  const country = countryLabel ? placeFromLabel(countryLabel, countries) : null;
  if (castRecord(record) && !country && !production.test(`${geography} ${original}`)) {
    return { placeId: null, reason: 'cast-manufacture-not-established' };
  }
  if (geography && uncertainty.test(geography.replace(/[,;]\s*exact findspot (?:is )?unknown\.?$/iu, ''))) {
    return { placeId: null, reason: 'uncertain-origin' };
  }
  const geographicalPlace = placeFromLabel(geography, general);
  if (country && geographicalPlace && country.id !== geographicalPlace.id
    && country.region !== geographicalPlace.region && geographicalPlace.region !== 'Transregional') {
    return { placeId: null, reason: 'conflicting-origin-fields' };
  }
  // A second explicit country is a conflict even when both share a continent.
  if (country && geographicalPlace?.precision === 'country' && country.precision === 'country'
    && country.id !== geographicalPlace.id) return { placeId: null, reason: 'conflicting-origin-fields' };
  if (country) return { placeId: country.id, reason: 'explicit-origin-country' };
  if (geographicalPlace) return { placeId: geographicalPlace.id, reason: 'explicit-geography' };
  // Do not rescue an ambiguous populated geography field using another field.
  if (geography) return { placeId: null, reason: 'unresolved-geography' };
  const holdings = [record.museum, record.current_location, record.displayed_at].map(key).filter(Boolean);
  if (original && holdings.includes(key(original))) return { placeId: null, reason: 'holding-only' };
  const originalPlace = placeFromLabel(original, general);
  return originalPlace ? { placeId: originalPlace.id, reason: 'explicit-original-location' }
    : { placeId: null, reason: original ? 'unresolved-original-location' : 'origin-not-recorded' };
}

export function resolveWorldOrigin(record, placesData) {
  const places = placesData.places ?? placesData;
  return resolveOrigin(record, { general: aliasIndex(places), countries: aliasIndex(places, true) });
}

function eraSign(value) { return /^(?:BCE|BC)$/iu.test(value ?? '') ? -1 : 1; }

function numericSpan(value) {
  const single = value.match(/^(\d{1,6})\s*(BCE|BC|CE|AD)?$/iu);
  if (single) {
    const year = Number(single[1]) * eraSign(single[2]);
    return year === 0 ? null : { start: year, end: year };
  }
  const range = value.match(/^(\d{1,6})\s*(BCE|BC|CE|AD)?\s*[-–—]\s*(\d{1,6})\s*(BCE|BC|CE|AD)?$/iu);
  if (!range) return null;
  const firstSign = eraSign(range[2] || range[4]);
  const lastSign = eraSign(range[4] || range[2]);
  const first = Number(range[1]) * firstSign;
  let last = Number(range[3]);
  if (firstSign > 0 && lastSign > 0 && range[3].length === 2 && first >= 1000) last += Math.floor(first / 100) * 100;
  last *= lastSign;
  if (!first || !last) return null;
  return { start: Math.min(first, last), end: Math.max(first, last) };
}

/** Interpret only the recorded production label; year_sort is never date evidence. */
export function worldDateSpan(record) {
  const label = text(record.year);
  if (!label || uncertainty.test(label)
    || /\b(?:after|before|acquir(?:ed|ed on)|acquisition|accessioned|discovered|excavated|published|publication|scanned|captured|original|prototype|modeled|modelled|conceived|composition|reconstruction|copy|style)\b/iu.test(label)) return { ...unknown };
  // Historical KAS/prototype dates must not become dates of an undated cast.
  if (castRecord(record) && !castProductionDateSupported(record, label)) return { ...unknown };
  const events = label.match(/\b(?:cast|casting|carved|made|created|completed)\b/giu) ?? [];
  if (events.length > 1) return { ...unknown };
  let value = label.replace(/\b(?:cast|casting|carved|made|created|completed)\b/giu, '')
    .replace(/\b(?:circa|approximately|approx\.?|ca\.?|c\.)\s*/giu, '')
    .replace(/(?<=\d),(?=\d{3}\b)/gu, '')
    .replace(/\bto\b/giu, '–').trim().replace(/^[-,:;\s]+|[-,:;\s]+$/gu, '');
  const numeric = numericSpan(value);
  if (numeric) return numeric;
  // Century qualifiers remain in dateLabel. Full-century envelopes avoid
  // inventing precise early/middle/late cutoffs that the source never supplies.
  value = value.replace(/\b(?:early|late|mid|middle|first half of|second half of|first half|second half|first quarter|second quarter|third quarter|fourth quarter)\b[-\s]*/giu, '');
  value = value.replace(/^the\s+/iu, '');
  const century = value.match(/^(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–—]\s*(\d{1,2})(?:st|nd|rd|th)?)?\s+centur(?:y|ies)\s*(BCE|BC|CE|AD)?$/iu);
  if (century) {
    const a = Number(century[1]), b = Number(century[2] || century[1]);
    if (!a || !b) return { ...unknown };
    if (eraSign(century[3]) < 0) return { start: -Math.max(a, b) * 100, end: -(Math.min(a, b) - 1) * 100 - 1 };
    const start = Math.max(1, (Math.min(a, b) - 1) * 100);
    const centuryEnd = Math.max(a, b) * 100 - 1;
    // An existing object's recorded ingest date is an upper bound, not its
    // production year. This keeps an open current-century label out of the future.
    const recordedBy = text(record.ingested || record.ingested_at).match(/^(\d{4})-/u);
    const end = recordedBy && Number(recordedBy[1]) >= start ? Math.min(centuryEnd, Number(recordedBy[1])) : centuryEnd;
    return { start, end };
  }
  // A named archaeological period with one explicit numeric span is retained
  // as that broad interval, not replaced by its midpoint or sort year.
  if (/\b(?:dynasty|period)\b/iu.test(value)) {
    const suffix = value.match(/(?:^|[,;]\s*)((?:\d{1,6}\s*(?:BCE|BC|CE|AD)?\s*[-–—]\s*)\d{1,6}\s*(?:BCE|BC|CE|AD)?)$/iu);
    if (suffix) return numericSpan(suffix[1]) ?? { ...unknown };
  }
  return { ...unknown };
}

/** Project public metadata only. Source objects, assets and geography remain unchanged. */
export function buildWorldCollection({ records, publicWorks, placesData, corrections = {} }) {
  const placeDefinitions = placesData.places ?? placesData;
  const originIndexes = { general: aliasIndex(placeDefinitions), countries: aliasIndex(placeDefinitions, true) };
  const publicBySlug = new Map(publicWorks.map(work => [work.slug, work]));
  const originReasons = {};
  const works = [];
  for (const originalRecord of records) {
    const correction = corrections[originalRecord.slug] ?? {};
    const record = { ...originalRecord, ...(correction.catalog ?? {}) };
    const publicWork = publicBySlug.get(record.slug);
    if (record.hidden || !publicWork) continue;
    const origin = resolveOrigin(record, originIndexes);
    originReasons[origin.reason] = (originReasons[origin.reason] ?? 0) + 1;
    const date = worldDateSpan(record);
    works.push({
      slug: record.slug,
      title: text(publicWork.title || correction.title || record.title),
      maker: text(publicWork.maker || record.artist),
      dateLabel: text(publicWork.displayDate || record.year) || 'Date not yet recorded',
      start: date.start,
      end: date.end,
      placeId: origin.placeId,
      thumbnail: publicWork.thumbnailImage,
      url: publicWork.route,
      sourceLabel: text(publicWork.sourceMuseum || record.source_institution) || 'Catalogue record',
      sourceUrl: text(publicWork.sourceRecordUrl || record.source_record_url || publicWork.sourceUrl || record.source_url),
    });
  }
  const used = new Set(works.map(work => work.placeId).filter(Boolean));
  const places = placeDefinitions.filter(place => used.has(place.id)).map(({ id, label, lat, lon, region, color, precision }) => ({ id, label, lat, lon, region, color, precision }));
  const dated = works.filter(work => work.start !== null && work.end !== null);
  return {
    places,
    works,
    unplacedCount: works.filter(work => work.placeId === null).length,
    undatedCount: works.length - dated.length,
    totalCount: works.length,
    dateMin: dated.length ? Math.min(...dated.map(work => work.start)) : null,
    dateMax: dated.length ? Math.max(...dated.map(work => work.end)) : null,
    originReasons,
  };
}
