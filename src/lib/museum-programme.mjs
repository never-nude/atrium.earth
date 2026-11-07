import { HOMEPAGE_PREVIEW_LIMIT } from './featured-selection.mjs';

// Curated-calendar automation: reuse existing editorial choices and approved
// objects. This is deterministic scheduling, with no live AI or model calls.

const DAY = 86_400_000;
const MONDAY_EPOCH = Date.UTC(1970, 0, 5);
export const PROGRAMME_FOCUS_WEEKS = 4;
export const PROGRAMME_SECTIONS = Object.freeze(['exhibitions', 'comparisons', 'galleries', 'ar-vr', 'wings']);
export const PROGRAMME_LAYOUTS = Object.freeze([
  Object.freeze({ key: 'exhibition-first', sectionOrder: PROGRAMME_SECTIONS }),
]);
export const GENERAL_HERO_PROMPT = 'Turn the work to compare its front, sides and back.';

const positiveMod = (value, modulo) => ((value % modulo) + modulo) % modulo;
const uniqueBy = (items, key) => [...new Map(items.map(item => [key(item), item])).values()];

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Parse a calendar day without accepting normalized impossible dates or times. */
export function parseProgrammeDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error('Programme date must be a real UTC date in YYYY-MM-DD form.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid programme date: ${value}`);
  }
  return date;
}

/** A week is Monday–Sunday in UTC, including dates crossing a year boundary. */
export function programmeCalendar(value) {
  const date = typeof value === 'string' ? parseProgrammeDate(value) : value;
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('A valid programme date is required.');
  const midnight = new Date(date.getTime());
  midnight.setUTCHours(0, 0, 0, 0);
  const dayIndex = (midnight.getUTCDay() + 6) % 7;
  const monday = new Date(midnight.getTime() - dayIndex * DAY);
  return {
    dayKey: midnight.toISOString().slice(0, 10),
    weekKey: monday.toISOString().slice(0, 10),
    dayIndex,
    weekIndex: Math.floor((monday.getTime() - MONDAY_EPOCH) / (7 * DAY)),
  };
}

/** Caller supplies its reviewed, scope-filtered pool; no wider fallback enters it. */
export function rotateContextWork(eligibleReviewedWorks, date, salt = 'context') {
  const { weekIndex } = programmeCalendar(date);
  const pool = uniqueBy(eligibleReviewedWorks ?? [], work => work.slug)
    .filter(work => typeof work.slug === 'string' && work.slug)
    .sort((a, b) => stableHash(`${salt}:${a.slug}`) - stableHash(`${salt}:${b.slug}`) || a.slug.localeCompare(b.slug));
  return pool.length ? pool[positiveMod(weekIndex, pool.length)] : null;
}

function geographicKey(work) {
  return work.wing && work.wing !== 'unfiled' ? work.wing : work.geography || 'unfiled';
}

/** Membership review belongs to the caller; this checks only public delivery. */
export function isPreviewBudgetEligible(work, previews) {
  const bytes = previews?.[work?.slug]?.bytes;
  return Boolean(work && typeof work.slug === 'string' && work.slug
    && !work.hidden && work.hasPreview === true
    && Number.isFinite(bytes) && bytes > 0 && bytes <= HOMEPAGE_PREVIEW_LIMIT);
}

function takeVaried(candidates, queue, count, seed) {
  const available = [...candidates];
  for (let slot = 0; slot < count && available.length; slot += 1) {
    const geographyCounts = new Map();
    for (const work of queue) {
      const key = geographicKey(work);
      geographyCounts.set(key, (geographyCounts.get(key) ?? 0) + 1);
    }
    available.sort((a, b) => (
      (geographyCounts.get(geographicKey(a)) ?? 0) - (geographyCounts.get(geographicKey(b)) ?? 0)
      || stableHash(`${seed}:${a.slug}`) - stableHash(`${seed}:${b.slug}`)
      || a.slug.localeCompare(b.slug)
    ));
    queue.push(available.shift());
  }
}

function buildHeroQueue(homepageWorks, previews, focusSlugs, weekKey) {
  // Homepage approval is a separate existing review. The caller supplies only
  // homepageFeaturedWorks, never all featured works or newly imported records.
  const eligible = uniqueBy(homepageWorks ?? [], work => work.slug)
    .filter(work => isPreviewBudgetEligible(work, previews));
  if (!eligible.length) throw new Error('The museum programme needs a homepage-approved hero within the 15 MiB preview budget.');
  const queueLength = Math.min(7, eligible.length);
  const queue = [];
  const inFocus = eligible.filter(work => focusSlugs.has(work.slug));
  takeVaried(inFocus, queue, Math.min(4, inFocus.length, queueLength), `${weekKey}:focus`);
  const outsideFocus = eligible.filter(work => !focusSlugs.has(work.slug));
  takeVaried(outsideFocus, queue, queueLength - queue.length, `${weekKey}:collection`);
  if (queue.length < queueLength) {
    const selected = new Set(queue.map(work => work.slug));
    takeVaried(eligible.filter(work => !selected.has(work.slug)), queue, queueLength - queue.length, `${weekKey}:remaining`);
  }
  return queue;
}

function overlap(slugs, focusSlugs) {
  return new Set((slugs ?? []).filter(slug => focusSlugs.has(slug))).size;
}

/**
 * Assemble existing approved content for one date. No clock, network, model,
 * taxonomy inference or input mutation occurs here. The homepage section order
 * stays fixed; selected members and ordering inside sections can change.
 */
export function buildMuseumProgramme({ date, programmes, exhibitions, homepageWorks, previews, pairings = [], rooms = [] }) {
  const calendar = programmeCalendar(date);
  const availableExhibitions = uniqueBy(exhibitions ?? [], exhibition => exhibition.slug)
    .filter(exhibition => Array.isArray(exhibition.works) && exhibition.works.length > 0);
  if (!availableExhibitions.length) throw new Error('The museum programme needs an existing exhibition with works.');
  const bySlug = new Map(availableExhibitions.map(exhibition => [exhibition.slug, exhibition]));
  const configuredFocuses = programmes?.focuses ?? [];
  const focuses = configuredFocuses.length
    ? configuredFocuses.filter(focus => bySlug.has(focus.exhibitionId))
    : availableExhibitions.map(exhibition => ({ exhibitionId: exhibition.slug, focusIntro: exhibition.invitation || '' }));
  if (!focuses.length) throw new Error('No configured programme focus matches an existing exhibition.');
  const anchor = programmeCalendar(programmes?.anchorMonday ?? '2026-11-02');
  const cycleWeek = calendar.weekIndex - anchor.weekIndex;
  const focusPeriod = Math.floor(cycleWeek / PROGRAMME_FOCUS_WEEKS);
  const focusConfig = focuses[positiveMod(focusPeriod, focuses.length)];
  const focus = bySlug.get(focusConfig.exhibitionId);
  const focusSlugs = new Set(focus.works.map(work => work.slug));
  const heroQueue = buildHeroQueue(homepageWorks, previews, focusSlugs, calendar.weekKey);
  const hero = heroQueue[calendar.dayIndex % heroQueue.length];
  const focusIntro = focusConfig.focusIntro || focus.invitation || '';
  const layout = PROGRAMME_LAYOUTS[0];
  const orderedPairings = [...pairings].sort((a, b) => (
    overlap([b.a?.slug, b.b?.slug], focusSlugs) - overlap([a.a?.slug, a.b?.slug], focusSlugs)
    || stableHash(`${calendar.weekKey}:${a.a?.slug}:${a.b?.slug}:${a.title}`) - stableHash(`${calendar.weekKey}:${b.a?.slug}:${b.b?.slug}:${b.title}`)
    || String(a.title).localeCompare(String(b.title))
  ));
  const orderedRooms = [...rooms].sort((a, b) => (
    overlap(b.slugs, focusSlugs) - overlap(a.slugs, focusSlugs)
    || stableHash(`${calendar.weekKey}:room:${a.id}`) - stableHash(`${calendar.weekKey}:room:${b.id}`)
    || String(a.id).localeCompare(String(b.id))
  ));
  return {
    focus,
    focusIntro,
    hero,
    heroPrompt: focusSlugs.has(hero.slug) && focusIntro ? focusIntro : GENERAL_HERO_PROMPT,
    heroQueue,
    exhibitions: [focus, ...availableExhibitions.filter(exhibition => exhibition.slug !== focus.slug)],
    pairings: orderedPairings,
    room: orderedRooms[0] ?? null,
    layout: layout.key,
    sectionOrder: [...layout.sectionOrder],
    accent: [focus.accent, focusConfig.accent].find(accent => /^#[a-f\d]{6}$/iu.test(accent ?? '')) ?? '#c9a5ff',
    weekKey: calendar.weekKey,
    dayKey: calendar.dayKey,
  };
}
