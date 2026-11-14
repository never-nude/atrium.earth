const slugPattern = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/u;
const plain = (value, max = 600) => typeof value === 'string' && value.trim().length > 0
  && value.length <= max && !/[<>]/u.test(value);
const check = (condition, message) => { if (!condition) throw new Error(`Curated visit: ${message}`); };

/** Validate a prepared edition against existing exhibition evidence, without I/O. */
export function validateCuratedVisit(visit, { exhibitionSlug, works, captions, previews }) {
  check(visit && slugPattern.test(visit.id || ''), 'invalid edition identity');
  check(slugPattern.test(exhibitionSlug || ''), 'invalid exhibition identity');
  for (const key of ['title', 'summary', 'rationale', 'closing']) check(plain(visit[key]), `invalid ${key}`);
  check(visit.durationMinutes === 5, 'this six-stop edition must use the five-minute estimate');
  check(visit.provenance?.authorship === 'ai-authored', 'authorship must be explicit');
  check(visit.provenance.unattendedGeneration === false, 'unattended generation is not connected');
  const prepared = visit.provenance.preparedAt;
  check(/^\d{4}-\d{2}-\d{2}$/u.test(prepared || '')
    && Number.isFinite(Date.parse(`${prepared}T00:00:00Z`))
    && new Date(`${prepared}T00:00:00Z`).toISOString().slice(0, 10) === prepared, 'invalid edition date');
  check(plain(visit.provenance.method), 'missing edition method');
  check(Array.isArray(visit.stops) && visit.stops.length === 6, 'exactly six stops are required');
  check(Array.isArray(visit.facts) && visit.facts.length >= 6, 'source facts are required');
  const bySlug = new Map(works.map(work => [work.slug, work]));
  const factById = new Map();
  for (const fact of visit.facts) {
    check(slugPattern.test(fact.id || '') && !factById.has(fact.id), 'duplicate or invalid fact identity');
    const work = bySlug.get(fact.workSlug);
    check(work && plain(fact.text, 500), `${fact.id}: unknown work or empty fact`);
    check(typeof captions[work.slug] === 'string' && captions[work.slug].includes(fact.text), `${fact.id}: fact is not an existing caption excerpt`);
    check(fact.sourceRef === `v3-content:wallTexts/${exhibitionSlug}/captions/${work.slug}`, `${fact.id}: source reference mismatch`);
    const sources = [work.sourceRecordUrl, work.sourceUrl, ...(work.relatedSourceRecordUrls || [])].filter(Boolean);
    check(sources.includes(fact.recordUrl), `${fact.id}: record URL is outside the object's existing sources`);
    let url;
    try { url = new URL(fact.recordUrl); } catch { /* invalid URLs fail below */ }
    check(url?.protocol === 'https:' && !url.username && !url.password, `${fact.id}: source URL must be public HTTPS`);
    factById.set(fact.id, fact);
  }
  const stopIds = new Set(), selected = new Set();
  for (const [index, stop] of visit.stops.entries()) {
    check(slugPattern.test(stop.id || '') && !stopIds.has(stop.id), 'duplicate or invalid stop identity');
    stopIds.add(stop.id);
    const work = bySlug.get(stop.workSlug), bytes = previews?.[stop.workSlug]?.bytes;
    check(work && !selected.has(stop.workSlug), `${stop.id}: duplicate or non-exhibition work`);
    check(work.hasPreview && work.modelGlb && Number.isSafeInteger(bytes) && bytes > 0 && bytes <= 15 * 1024 * 1024, `${stop.id}: a small existing 3D preview is required`);
    selected.add(stop.workSlug);
    for (const key of ['title', 'prompt', 'reading', 'whyHere']) check(plain(stop[key], 500), `${stop.id}: invalid ${key}`);
    check(Array.isArray(stop.factIds) && stop.factIds.length > 0
      && new Set(stop.factIds).size === stop.factIds.length
      && stop.factIds.every(id => factById.has(id)), `${stop.id}: fact IDs must resolve uniquely`);
    check(stop.factIds.some(id => factById.get(id).workSlug === stop.workSlug), `${stop.id}: no evidence for this object`);
    check(index === visit.stops.length - 1 ? stop.nextConnection === '' : plain(stop.nextConnection, 300), `${stop.id}: invalid next-stop connection`);
  }
  return visit;
}

/** URL handoffs accept only this prepared edition and a complete 1-based stop. */
export function visitPositionFromSearch(search, visit) {
  const params = new URLSearchParams(search);
  if (params.getAll('visit').length !== 1 || params.getAll('stop').length > 1 || params.getAll('exhibition').length > 1) return null;
  if (params.get('visit') !== visit.id) return null;
  if (visit.exhibitionSlug && params.has('exhibition') && params.get('exhibition') !== visit.exhibitionSlug) return null;
  const raw = params.get('stop') || '1';
  if (!/^[1-9]\d*$/u.test(raw)) return null;
  const position = Number(raw);
  return Number.isSafeInteger(position) && position <= visit.stops.length ? position - 1 : null;
}

export function visitRecordQuery(exhibitionSlug, visitId, position) {
  return new URLSearchParams({ exhibition: exhibitionSlug, visit: visitId, stop: String(position + 1) }).toString();
}
