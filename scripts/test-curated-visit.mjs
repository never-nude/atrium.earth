import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCuratedVisit, visitPositionFromSearch, visitRecordQuery } from '../src/lib/curated-visit.mjs';

const read = name => JSON.parse(fs.readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const editions = read('curated-visits'), content = read('v3-content'), records = read('catalog'), previews = read('previews');
assert.equal(editions.schema, 'atrium-curated-visits/1');
const exhibitionSlug = 'the-work-of-the-surface';
const exhibition = content.wallTexts[exhibitionSlug];
const visit = editions.visits[exhibitionSlug];
const works = records.filter(work => !work.hidden && exhibition.workSlugs.includes(work.slug)).map(work => ({
  ...work, hasPreview: Boolean(previews[work.slug]?.url), modelGlb: previews[work.slug]?.url,
  sourceRecordUrl: work.source_record_url, sourceUrl: work.source_url, relatedSourceRecordUrls: work.related_source_record_urls,
}));
const captions = Object.fromEntries(exhibition.captions.map(caption => [caption.slug, caption.text]));
const context = { exhibitionSlug, works, captions, previews };
const before = JSON.stringify({ visit, works, captions, previews });
assert.equal(validateCuratedVisit(visit, context), visit);
assert.equal(visit.stops.length, 6);
assert.equal(exhibition.workSlugs.length, 60, 'The full exhibition has 60 works after deinstalling its former lead');
const retiredLead = 'europe/eduardo-chillida-how-profound-is-the-air';
assert.ok(!exhibition.workSlugs.includes(retiredLead));
assert.ok(!captions[retiredLead]);
assert.ok(!visit.stops.some(stop => stop.workSlug === retiredLead));
assert.ok(!read('featured-works').works.some(entry => entry.slug === retiredLead));
assert.ok(records.some(work => work.slug === retiredLead && !work.hidden));
assert.equal(new Set(visit.stops.map(stop => stop.workSlug)).size, 6);
assert.ok(visit.stops.reduce((sum, stop) => sum + previews[stop.workSlug].bytes, 0) < 12 * 1024 * 1024, 'The six existing previews keep the short route small');
assert.equal(visit.provenance.unattendedGeneration, false);
assert.ok(!/exposure|texture|influenced|inspired/iu.test(visit.stops.map(stop => `${stop.prompt} ${stop.reading}`).join(' ')), 'Looking prompts do not invent controls or historical influence');

let rejected = 0;
function invalid(change, override = {}) {
  const edition = structuredClone(visit); change(edition);
  assert.throws(() => validateCuratedVisit(edition, { ...context, ...override })); rejected += 1;
}
invalid(edition => { edition.stops.pop(); });
invalid(edition => { edition.stops[1].workSlug = edition.stops[0].workSlug; });
invalid(edition => { edition.stops[0].workSlug = 'outside-the-exhibition'; });
invalid(edition => { edition.stops[1].id = edition.stops[0].id; });
invalid(edition => { edition.stops[0].factIds = ['invented-fact']; });
invalid(edition => { edition.stops[0].factIds = [edition.stops[1].factIds[0]]; });
invalid(edition => { edition.facts[0].text = 'An unsupported historical claim.'; });
invalid(edition => { edition.facts[0].recordUrl = 'https://unrelated.example/object'; });
invalid(edition => { edition.facts[0].sourceRef = 'some-other-caption'; });
invalid(edition => { edition.facts[1].id = edition.facts[0].id; });
invalid(edition => { edition.stops[0].nextConnection = ''; });
invalid(edition => { edition.stops[5].nextConnection = 'A seventh work'; });
invalid(edition => { edition.provenance.unattendedGeneration = true; });
invalid(edition => { edition.provenance.preparedAt = '2026-02-30'; });
invalid(edition => { edition.provenance.authorship = 'live-ai'; });
invalid(edition => { edition.stops[0].prompt = '<button>Unsupported markup</button>'; });
const oversized = structuredClone(previews);
oversized[visit.stops[0].workSlug].bytes = 15 * 1024 * 1024 + 1;
invalid(() => {}, { previews: oversized });
invalid(() => {}, { works: works.map(work => work.slug === visit.stops[0].workSlug ? { ...work, hasPreview: false } : work) });

const handoff = { ...visit, exhibitionSlug };
for (let position = 0; position < 6; position += 1) {
  const query = visitRecordQuery(exhibitionSlug, visit.id, position);
  assert.equal(visitPositionFromSearch(query, handoff), position);
  assert.equal(new URLSearchParams(query).get('exhibition'), exhibitionSlug);
}
assert.equal(visitPositionFromSearch(`?visit=${visit.id}`, handoff), 0);
for (const stop of ['0', '-1', '7', '1.5', 'Infinity', '1junk', '01']) {
  assert.equal(visitPositionFromSearch(`?visit=${visit.id}&stop=${stop}`, handoff), null);
}
assert.equal(visitPositionFromSearch(`?visit=unknown-edition&stop=1`, handoff), null);
assert.equal(visitPositionFromSearch(`?visit=${visit.id}&stop=1&exhibition=other`, handoff), null);
for (const duplicate of [
  `visit=${visit.id}&visit=${visit.id}&stop=1`,
  `visit=${visit.id}&stop=1&stop=2`,
  `visit=${visit.id}&stop=1&exhibition=${exhibitionSlug}&exhibition=${exhibitionSlug}`,
]) assert.equal(visitPositionFromSearch(duplicate, handoff), null, 'Duplicate context parameters are rejected');
assert.equal(JSON.stringify({ visit, works, captions, previews }), before, 'The guide never mutates object, preview or exhibition records');
console.log(`Curated visit passed: six existing works, seven caption facts, 60 exhibition works, ${rejected} rejected editions, bounded URL handoffs and unchanged records.`);
