export const NEWEST_COUNT = 24;

/**
 * Newest public imports, independent of their batch's original publication date.
 * Always the NEWEST_COUNT most recent works (fewer only when the catalog has
 * fewer), however large the latest batch is.
 */
export function buildNewestWorks(records, publicWorks) {
  const published = new Map(publicWorks.map((work) => [work.slug, work]));
  const candidates = records.flatMap((record, order) => {
    const work = published.get(record.slug);
    if (!work || record.hidden || record.exclude_from_additions) return [];
    const timestamp = typeof record.ingested_at === 'string'
      && validDay(record.ingested_at.slice(0, 10))
      ? Date.parse(record.ingested_at) : Number.NaN;
    const day = validDay(record.ingested);
    const explicit = typeof record.ingest_batch === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.ingest_batch);
    const batchDay = validDay(record.ingested_at?.slice(0, 10)) || day;
    return [{
      work,
      batch: explicit ? record.ingest_batch : batchDay ? `added-${batchDay}` : null,
      importedAt: Number.isFinite(timestamp) ? timestamp : day ? Date.parse(`${day}T00:00:00Z`) : -Infinity,
      catalogIndex: Number.isFinite(record.index) ? record.index : order,
      order,
    }];
  });
  candidates.sort((a, b) => b.importedAt - a.importedAt || b.catalogIndex - a.catalogIndex || b.order - a.order);
  const seen = new Set();
  const unique = candidates.filter(({ work }) => {
    if (seen.has(work.slug)) return false;
    seen.add(work.slug);
    return true;
  });
  return unique.slice(0, NEWEST_COUNT).map(({ work }) => work);
}

/** Group only published works. Membership lives in the catalog, never in a second list. */
export function buildAdditionBatches(records, publicWorks, metadata = {}) {
  const published = new Map(publicWorks.map((work) => [work.slug, work]));
  const batches = new Map();
  const seen = new Set();
  for (const [index, record] of records.entries()) {
    const work = published.get(record.slug);
    // A published work can opt out of the Newest Additions rail and batch pages
    // (for example, one restored quietly after a hold) without losing its ingest record.
    if (!work || record.hidden || record.exclude_from_additions || seen.has(record.slug)) continue;
    const day = validDay(record.ingested_at?.slice(0, 10)) || validDay(record.ingested);
    if (!day) continue;
    seen.add(record.slug);
    const explicit = typeof record.ingest_batch === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.ingest_batch);
    const id = explicit ? record.ingest_batch : `added-${day}`;
    const parsedTime = Date.parse(record.ingested_at);
    const addedAt = Number.isFinite(parsedTime) && record.ingested_at.startsWith(day) ? new Date(parsedTime).toISOString() : `${day}T00:00:00.000Z`;
    let batch = batches.get(id);
    if (!batch) {
      batch = { id, date: day, addedAt, lastIndex: index, legacy: !explicit, works: [] };
      batches.set(id, batch);
    }
    // An intentional continuation keeps the original batch's place in the archive.
    if (addedAt < batch.addedAt) { batch.addedAt = addedAt; batch.date = day; }
    batch.lastIndex = index;
    batch.works.push(work);
  }
  return [...batches.values()].sort((a, b) => b.addedAt.localeCompare(a.addedAt) || b.lastIndex - a.lastIndex || a.id.localeCompare(b.id)).map((batch) => {
    const copy = metadata[batch.id] || {};
    const members = new Map(batch.works.map((work) => [work.slug, work]));
    const preferred = (copy.highlightSlugs || []).map((slug) => members.get(slug)).filter(Boolean);
    const highlights = [...new Map([...preferred, ...batch.works].map((work) => [work.slug, work])).values()].slice(0, 4);
    return {
      ...batch,
      title: copy.title || `Added ${formatAdditionDate(batch.date)}`,
      summary: copy.summary || 'Sculpture newly available to explore in three dimensions.',
      highlights,
    };
  });
}

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
}

export function formatAdditionDate(day) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
}
