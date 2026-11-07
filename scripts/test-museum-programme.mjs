import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildFeaturedSelection, HOMEPAGE_PREVIEW_LIMIT } from '../src/lib/featured-selection.mjs';
import {
  buildMuseumProgramme, isPreviewBudgetEligible, parseProgrammeDate, programmeCalendar, rotateContextWork,
  GENERAL_HERO_PROMPT, PROGRAMME_LAYOUTS, PROGRAMME_SECTIONS,
} from '../src/lib/museum-programme.mjs';

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const programmes = read('../src/data/museum-programmes.json');
const programmesBefore = JSON.stringify(programmes);
const content = read('../src/data/v3-content.json');
const review = read('../src/data/featured-works.json');
const reviewBefore = JSON.stringify(review);
const previews = read('../src/data/previews.json');
const renders = new Set(read('../src/data/renders.json'));
const visible = read('../src/data/catalog.json').filter(work => !work.hidden)
  .map(work => ({ ...work, hasPreview: Boolean(previews[work.slug]?.url) }));
const bySlug = new Map(visible.map(work => [work.slug, work]));
const reviewed = buildFeaturedSelection(review, visible, renders);
const approved = new Set(review.works.filter(work => work.homepage).map(work => work.slug));
const homepageWorks = reviewed.filter(work => approved.has(work.slug));
const eligible = homepageWorks.filter(work => previews[work.slug]?.bytes > 0 && previews[work.slug].bytes <= HOMEPAGE_PREVIEW_LIMIT);
const baseExhibitionSource = fs.readFileSync(new URL('../src/lib/v2.ts', import.meta.url), 'utf8');
const baseAccents = new Map([...baseExhibitionSource.matchAll(/\bslug: '([^']+)'[\s\S]*?\baccent: '(#[a-f\d]{6})'/gu)].map(match => [match[1], match[2]]));
const exhibitions = [
  ...Object.entries(content.wallTexts).map(([slug, entry]) => ({
    slug, invitation: entry.invitation, accent: baseAccents.get(slug),
    works: entry.workSlugs.map(slug => bySlug.get(slug)).filter(Boolean),
  })),
  content.newExhibition, ...content.additionalExhibitions,
].map(exhibition => ({
  ...exhibition,
  works: exhibition.works.map(work => bySlug.get(work.slug)).filter(Boolean),
}));
const pairings = content.pairings.filter(pair => reviewed.some(work => work.slug === pair.a) && reviewed.some(work => work.slug === pair.b))
  .map(pair => ({ ...pair, a: bySlug.get(pair.a), b: bySlug.get(pair.b) }));
const colourPair = pairings.find(pair => pair.a.slug === 'modern/saint-phalle-firebird-stravinsky'
  && pair.b.slug === 'americas-oceania/jeff-koons-play-doh');
const rejectedPair = pairings.find(pair => pair.a.slug === 'egyptian/portrait-of-nefertiti-smk-cast'
  && pair.b.slug === 'roman/bust-of-augustus-oak-crown-msr');
const homepagePairings = pairings.filter(pair => pair !== rejectedPair
  && [pair.a, pair.b].every(work => eligible.includes(work)));
const rooms = read('../public/spatial-museum/collection-manifest.json').rooms;
const inputs = { programmes, exhibitions, homepageWorks, previews, pairings, rooms };
const day = value => new Date(value);
const forDate = value => buildMuseumProgramme({ ...inputs, date: day(value) });
const DAY = 86_400_000;
const key = programme => ({
  focus: programme.focus.slug, hero: programme.hero.slug, heroPrompt: programme.heroPrompt, queue: programme.heroQueue.map(work => work.slug),
  exhibitions: programme.exhibitions.map(exhibition => exhibition.slug),
  pairings: programme.pairings.map(pair => `${pair.a.slug}:${pair.b.slug}`),
  room: programme.room?.id, layout: programme.layout, sections: programme.sectionOrder,
  accent: programme.accent, week: programme.weekKey, day: programme.dayKey,
});
const overlap = (slugs, focus) => new Set(slugs.filter(slug => focus.has(slug))).size;

assert.equal(programmes.schema, 'atrium-museum-programmes/1');
assert.equal(programmes.focuses.length, 8);
assert.deepEqual(new Set(programmes.focuses.map(focus => focus.exhibitionId)), new Set(exhibitions.map(exhibition => exhibition.slug)));
assert.deepEqual(programmes.layouts, PROGRAMME_LAYOUTS);
assert.equal(PROGRAMME_LAYOUTS.length, 1);
assert.deepEqual(PROGRAMME_SECTIONS, ['exhibitions', 'comparisons', 'galleries', 'ar-vr', 'wings']);
for (const focus of programmes.focuses) {
  assert.ok(focus.focusIntro.split(/\s+/u).length <= 30);
  assert.ok(!/[<>\n]/u.test(focus.focusIntro));
  assert.equal(focus.accent, undefined, 'Programme records do not duplicate exhibition color identities.');
}
assert.equal(reviewed.length, 250, 'The explicit featured membership remains unchanged.');
assert.ok(eligible.length >= 7);
assert.ok(colourPair, 'The vivid comparison resolves from the existing reviewed catalogue.');
assert.ok(rejectedPair, 'Excluding a homepage pairing preserves its catalogue entry.');
assert.ok(homepagePairings.includes(colourPair));

for (const invalid of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-11-6', '2026-11-06T00:00:00Z', '', ' 2026-11-06']) {
  assert.throws(() => parseProgrammeDate(invalid));
}
assert.equal(parseProgrammeDate('2028-02-29').toISOString(), '2028-02-29T00:00:00.000Z');
assert.deepEqual(programmeCalendar('2026-11-08'), { dayKey: '2026-11-08', weekKey: '2026-11-02', dayIndex: 6, weekIndex: 2965 });
assert.equal(programmeCalendar(day('2026-11-08T19:00:00-05:00')).weekKey, '2026-11-09', 'UTC, rather than local Sunday, determines the week.');
assert.equal(programmeCalendar('2026-12-31').weekKey, '2026-12-28');
assert.equal(programmeCalendar('2027-01-01').weekKey, '2026-12-28');
assert.equal(programmeCalendar('2027-01-04').weekKey, '2027-01-04');
assert.throws(() => programmeCalendar(new Date('invalid')));

const beforeMidnight = forDate('2026-11-05T23:59:59.999Z');
const afterMidnight = forDate('2026-11-06T00:00:00.000Z');
assert.equal(beforeMidnight.focus, afterMidnight.focus);
assert.deepEqual(beforeMidnight.heroQueue, afterMidnight.heroQueue);
assert.notEqual(beforeMidnight.hero.slug, afterMidnight.hero.slug);
assert.deepEqual(key(afterMidnight), key(forDate('2026-11-06T23:59:59.999Z')));
assert.equal(forDate('2026-11-08T23:59:59.999Z').weekKey, '2026-11-02');
assert.equal(forDate('2026-11-09T00:00:00.000Z').weekKey, '2026-11-09');
assert.equal(forDate('2026-11-08T23:59:59.999Z').focus.slug, forDate('2026-11-09T00:00:00.000Z').focus.slug);
assert.notDeepEqual(forDate('2026-11-02').heroQueue, forDate('2026-11-09').heroQueue, 'Daily heroes get a fresh weekly queue inside the same exhibition period.');
assert.equal(forDate('2026-12-31T23:59:59Z').focus.slug, forDate('2027-01-01T00:00:00Z').focus.slug);

const focusIds = new Set();
const layoutKeys = new Set();
const anchor = parseProgrammeDate(programmes.anchorMonday).getTime();
for (let week = 0; week < 32; week += 1) {
  const monday = new Date(anchor + week * 7 * DAY);
  const programme = buildMuseumProgramme({ ...inputs, date: monday });
  focusIds.add(programme.focus.slug);
  assert.equal(programme.focus.slug, programmes.focuses[Math.floor(week / 4)].exhibitionId, 'Each existing exhibition owns four complete UTC weeks.');
  layoutKeys.add(programme.layout);
  assert.deepEqual(programme.sectionOrder, PROGRAMME_SECTIONS, 'Whole homepage sections never reshuffle.');
  assert.equal(programme.sectionOrder.length, 5);
  assert.equal(programme.exhibitions[0], programme.focus);
  assert.equal(programme.accent, programme.focus.accent, 'The canonical exhibition owns its accent.');
  assert.equal(programme.exhibitions.length, 8);
  assert.equal(new Set(programme.exhibitions).size, 8);
  assert.deepEqual(new Set(programme.exhibitions), new Set(exhibitions));
  assert.equal(programme.heroQueue.length, 7);
  assert.equal(new Set(programme.heroQueue.map(work => work.slug)).size, 7);
  const focus = new Set(programme.focus.works.map(work => work.slug));
  const focusEligible = eligible.filter(work => focus.has(work.slug));
  const focusSlots = Math.min(4, focusEligible.length);
  assert.ok(programme.heroQueue.slice(0, focusSlots).every(work => focus.has(work.slug)));
  if (eligible.filter(work => !focus.has(work.slug)).length >= 7 - focusSlots) {
    assert.ok(programme.heroQueue.slice(focusSlots).every(work => !focus.has(work.slug)));
  }
  const dailyHeroes = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const daily = buildMuseumProgramme({ ...inputs, date: new Date(monday.getTime() + offset * DAY) });
    dailyHeroes.push(daily.hero.slug);
    assert.equal(daily.focus, programme.focus);
    assert.equal(daily.layout, programme.layout);
    assert.equal(daily.hero, programme.heroQueue[offset]);
    assert.ok(approved.has(daily.hero.slug));
    assert.ok(previews[daily.hero.slug].bytes <= HOMEPAGE_PREVIEW_LIMIT);
    assert.ok(previews[daily.hero.slug].bytes > 0);
    assert.equal(daily.heroPrompt, focus.has(daily.hero.slug) ? daily.focusIntro : GENERAL_HERO_PROMPT);
  }
  assert.equal(new Set(dailyHeroes).size, 7);
  assert.deepEqual(new Set(programme.pairings), new Set(homepagePairings));
  assert.ok(!programme.pairings.includes(rejectedPair), 'The rejected pair stays out through every focus and week.');
  for (const pair of programme.pairings) {
    assert.ok([pair.a, pair.b].every(work => approved.has(work.slug) && isPreviewBudgetEligible(work, previews)));
  }
  const spotlighted = programme.focus.slug === 'the-work-of-the-surface';
  if (spotlighted) assert.equal(programme.pairings[0], colourPair);
  const pairScores = programme.pairings.slice(spotlighted ? 1 : 0).map(pair => overlap([pair.a.slug, pair.b.slug], focus));
  assert.deepEqual(pairScores, [...pairScores].sort((a, b) => b - a));
  assert.ok(rooms.includes(programme.room));
  assert.equal(overlap(programme.room.slugs, focus), Math.max(...rooms.map(room => overlap(room.slugs, focus))));
}
assert.equal(focusIds.size, 8);
assert.equal(layoutKeys.size, 1);
for (let offset = 0; offset < 28; offset += 1) {
  const programme = buildMuseumProgramme({ ...inputs, date: new Date(anchor + offset * DAY) });
  assert.equal(programme.focus.slug, 'the-work-of-the-surface');
  assert.equal(programme.pairings[0], colourPair, 'Colour Takes Shape leads throughout the current four-week focus.');
}
assert.equal(forDate('2026-11-29T23:59:59.999Z').focus.slug, 'the-work-of-the-surface');
assert.equal(forDate('2026-11-30T00:00:00.000Z').focus.slug, 'bodies-in-motion');
assert.equal(forDate('2026-11-01T23:59:59.999Z').focus.slug, 'michelangelo-and-rodin', 'The period before the anchor also spans four weeks.');
assert.equal(forDate('2026-11-02').focus.slug, forDate('2027-06-14').focus.slug, 'The eight-exhibition cycle returns after 32 weeks.');
assert.notDeepEqual(forDate('2026-11-02').heroQueue, forDate('2027-06-14').heroQueue, 'The returned focus gets a fresh weekly hero seed.');

// A single contextual work never forces seven copies: the broader approved pool
// fills the week, preferring geographic groups not already in the queue.
const sample = Array.from({ length: 12 }, (_, index) => ({ slug: `sample-${index}`, hasPreview: true, wing: index < 6 ? 'europe' : ['asia', 'africa', 'americas-oceania'][index % 3] }));
const samplePreviews = Object.fromEntries(sample.map(work => [work.slug, { bytes: HOMEPAGE_PREVIEW_LIMIT }]));
const sampleFocus = { slug: 'single', works: [sample[0]], invitation: 'Look closely.' };
const single = buildMuseumProgramme({ date: '2026-11-02', exhibitions: [sampleFocus], homepageWorks: sample, previews: samplePreviews });
assert.equal(single.heroQueue[0], sample[0]);
assert.equal(new Set(single.heroQueue).size, 7);
assert.equal(new Set(single.heroQueue.slice(0, 4).map(work => work.wing)).size, 4);
assert.deepEqual(single.pairings, []);
assert.equal(single.room, null);
assert.equal(single.focus, sampleFocus);
assert.equal(single.focusIntro, sampleFocus.invitation);
assert.equal(single.heroPrompt, sampleFocus.invitation);
const contextualPair = { title: 'Contextual pair', a: sample[0], b: sample[1] };
const chosenPair = { title: 'Editable spotlight title', a: sample[6], b: sample[7] };
const reversedExcluded = { title: 'Renamed and reversed excluded pair', a: sample[9], b: sample[8] };
const unapprovedPair = { title: 'Unapproved object', a: sample[0], b: { slug: 'outside-review', hasPreview: true } };
const largePair = { title: 'Oversized object', a: sample[0], b: sample[2] };
const comparisonConfig = {
  focuses: [{ exhibitionId: 'single', comparisonWorkSlugs: [sample[7].slug, sample[6].slug] }],
  comparisonExclusions: [[sample[8].slug, sample[9].slug]],
};
const comparisonInputs = {
  date: '2026-11-02', programmes: comparisonConfig, exhibitions: [sampleFocus], homepageWorks: sample,
  previews: { ...samplePreviews, 'outside-review': { bytes: 100 }, [sample[2].slug]: { bytes: HOMEPAGE_PREVIEW_LIMIT + 1 } },
  pairings: [contextualPair, chosenPair, reversedExcluded, unapprovedPair, largePair],
};
assert.deepEqual(buildMuseumProgramme(comparisonInputs).pairings, [chosenPair, contextualPair], 'Spotlights and exclusions follow unordered object identities, never titles; approval and preview budgets remain mandatory.');
assert.deepEqual(buildMuseumProgramme({ ...comparisonInputs, pairings: [contextualPair, reversedExcluded] }).pairings, [contextualPair], 'A missing spotlight safely falls back without admitting the excluded pair.');
assert.deepEqual(buildMuseumProgramme({ ...comparisonInputs, programmes: { ...comparisonConfig, comparisonExclusions: [...comparisonConfig.comparisonExclusions, [sample[6].slug, sample[7].slug]] } }).pairings, [contextualPair], 'An explicit exclusion wins over an editorial spotlight.');
assert.deepEqual(buildMuseumProgramme({ ...comparisonInputs, pairings: [reversedExcluded, unapprovedPair, largePair] }).pairings, [], 'An empty eligible comparison pool is not filled with excluded, unapproved or oversized works.');
const broaderHero = buildMuseumProgramme({ date: '2026-11-03', exhibitions: [sampleFocus], homepageWorks: sample, previews: samplePreviews });
assert.ok(!sampleFocus.works.includes(broaderHero.hero));
assert.equal(broaderHero.heroPrompt, 'Turn the work to compare its front, sides and back.');
const noReshuffle = buildMuseumProgramme({ date: '2026-11-09', programmes: { layouts: [{ key: 'exhibition-first', sectionOrder: [...PROGRAMME_SECTIONS].reverse() }] }, exhibitions: [sampleFocus], homepageWorks: sample, previews: samplePreviews });
assert.deepEqual(noReshuffle.sectionOrder, PROGRAMME_SECTIONS, 'Configuration cannot opt a week back into section reshuffling.');
const accentConfig = { focuses: [{ exhibitionId: 'single', accent: '#c0d0e0' }] };
const canonicalAccent = buildMuseumProgramme({ date: '2026-11-02', programmes: accentConfig, exhibitions: [{ ...sampleFocus, accent: '#a0b0c0' }], homepageWorks: sample, previews: samplePreviews });
assert.equal(canonicalAccent.accent, '#a0b0c0');
const fallbackAccent = buildMuseumProgramme({ date: '2026-11-02', programmes: accentConfig, exhibitions: [{ ...sampleFocus, accent: 'invalid' }], homepageWorks: sample, previews: samplePreviews });
assert.equal(fallbackAccent.accent, '#c0d0e0');
assert.equal(isPreviewBudgetEligible(sample[0], samplePreviews), true, 'The exact 15 MiB boundary is eligible.');
assert.equal(isPreviewBudgetEligible({ ...sample[0], hidden: true }, samplePreviews), false);
assert.equal(isPreviewBudgetEligible({ ...sample[0], hasPreview: false }, samplePreviews), false);
assert.equal(isPreviewBudgetEligible({ slug: sample[0].slug }, samplePreviews), false);
assert.equal(isPreviewBudgetEligible(null, samplePreviews), false);
for (const bytes of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, HOMEPAGE_PREVIEW_LIMIT + 1]) {
  assert.equal(isPreviewBudgetEligible(sample[0], { [sample[0].slug]: { bytes } }), false);
}
const small = buildMuseumProgramme({ date: '2026-11-08', exhibitions: [sampleFocus], homepageWorks: sample.slice(0, 3), previews: samplePreviews });
assert.equal(small.heroQueue.length, 3, 'A reduced approved pool stays small rather than padding with duplicates or unreviewed works.');
assert.equal(new Set(small.heroQueue).size, 3);
assert.ok(small.heroQueue.includes(small.hero));
const overBudget = { ...samplePreviews, 'sample-0': { bytes: HOMEPAGE_PREVIEW_LIMIT + 1 }, 'sample-1': { bytes: 0 } };
const budgeted = buildMuseumProgramme({ date: '2026-11-02', exhibitions: [sampleFocus], homepageWorks: [...sample, sample[2]], previews: overBudget });
assert.ok(!budgeted.heroQueue.some(work => work.slug === 'sample-0' || work.slug === 'sample-1'));
assert.equal(new Set(budgeted.heroQueue.map(work => work.slug)).size, 7);
assert.throws(() => buildMuseumProgramme({ date: '2026-11-02', exhibitions: [sampleFocus], homepageWorks: sample, previews: {} }));
assert.throws(() => buildMuseumProgramme({ date: '2026-11-02', exhibitions: [], homepageWorks: sample, previews: samplePreviews }));
const contextMonday = rotateContextWork(sample, '2026-11-02', 'a-wing');
assert.equal(contextMonday, rotateContextWork(sample, '2026-11-08', 'a-wing'));
assert.notEqual(contextMonday, rotateContextWork(sample, '2026-11-09', 'a-wing'));
assert.equal(rotateContextWork([], '2026-11-02', 'a-wing'), null);

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) freeze(item);
  }
  return value;
}
const immutable = freeze(structuredClone(inputs));
const snapshot = JSON.stringify(immutable);
const inputDate = day('2026-11-06T20:45:00Z');
const inputTime = inputDate.getTime();
buildMuseumProgramme({ ...immutable, date: inputDate });
rotateContextWork(immutable.homepageWorks, inputDate, 'immutable');
assert.equal(JSON.stringify(immutable), snapshot);
assert.equal(inputDate.getTime(), inputTime);
assert.equal(JSON.stringify(review), reviewBefore);

const dateModule = new URL('../src/lib/museum-date.mjs', import.meta.url).href;
const fixedDateCheck = spawnSync(process.execPath, ['--input-type=module', '-e', `
  const first = await import(${JSON.stringify(dateModule)});
  process.env.ATRIUM_PROGRAMME_DATE = '2000-01-01';
  const second = await import(${JSON.stringify(dateModule)});
  if (first.programmeDate !== second.programmeDate) process.exit(2);
  console.log(second.programmeDate.toISOString());
`], { encoding: 'utf8', env: { ...process.env, ATRIUM_PROGRAMME_DATE: '2026-11-06' } });
assert.equal(fixedDateCheck.status, 0, fixedDateCheck.stderr);
assert.equal(fixedDateCheck.stdout.trim(), '2026-11-06T00:00:00.000Z');
const invalidDateCheck = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(dateModule)});`], {
  encoding: 'utf8', env: { ...process.env, ATRIUM_PROGRAMME_DATE: '2026-02-30' },
});
assert.notEqual(invalidDateCheck.status, 0);
assert.match(invalidDateCheck.stderr, /Invalid programme date/u);

assert.equal(JSON.stringify(programmes), programmesBefore, 'Programme comparison decisions remain immutable.');
console.log(`Museum programme passed: 8 four-week focuses, 1 fixed layout, ${eligible.length} budgeted homepage-approved heroes; 32 UTC weeks, 28-day boundaries, comparison spotlights/exclusions and immutable inputs checked.`);
