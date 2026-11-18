import { exhibitionLeadForDate, isPreviewBudgetEligible, rotateContextWork } from './museum-programme.mjs';

/** One set of artwork identities across every editorial slot on the homepage. */
export function selectHomepageWorks({ programme, reviewed, previews, date, roomWorks, spatialWorks, wings, newestWorks }) {
  const reviewedSlugs = new Set(reviewed.map(work => work.slug));
  const used = new Set([programme.hero.slug]);
  function reserve(work) {
    if (!work || used.has(work.slug)) return undefined;
    used.add(work.slug);
    return work;
  }
  // Curator-selected lead for What Survives, subject to existing homepage
  // approval and preview-size checks, with the normal lead as fallback.
  const iznikLead = programme.focus.slug === 'what-survives'
    ? programme.focus.works.find(work => work.slug === 'asia/iznik-jug-english-mounts-fitzwilliam'
      && reviewedSlugs.has(work.slug) && isPreviewBudgetEligible(work, previews) && !used.has(work.slug))
    : null;
  const lead = reserve(iznikLead ?? exhibitionLeadForDate(programme.focus, reviewedSlugs, previews, date, used));
  if (!lead) throw new Error(`Homepage exhibition ${programme.focus.slug} needs a distinct reviewed lead within the auto-start budget.`);

  // Curator-selected homepage comparison. Keep the existing editorial ordering
  // as fallback if either seated figure is already reserved for another slot.
  const seatedPair = programme.pairings.find(({ a, b }) =>
    new Set([a.slug, b.slug]).has('rodin/the-thinker')
    && new Set([a.slug, b.slug]).has('sub-saharan-africa/seated-figure-middle-niger')
    && !used.has(a.slug) && !used.has(b.slug));
  const pair = seatedPair ?? programme.pairings.find(({ a, b }) => !used.has(a.slug) && !used.has(b.slug));
  if (pair) {
    reserve(pair.a);
    reserve(pair.b);
  }
  const teasers = programme.exhibitions.filter(exhibition => exhibition.slug !== programme.focus.slug)
    .slice(0, 2)
    .map(exhibition => ({ exhibition, work: reserve(exhibitionLeadForDate(exhibition, reviewedSlugs, previews, date, used)) }));

  const roomWork = reserve(roomWorks.find(work => reviewedSlugs.has(work.slug) && !used.has(work.slug)));
  const spatialWork = reserve(spatialWorks.find(work => !used.has(work.slug)));
  const wingCards = wings.map(({ wing, count }) => ({
    wing,
    count,
    featured: reserve(rotateContextWork(
      reviewed.filter(work => work.wing === wing.id && !used.has(work.slug) && isPreviewBudgetEligible(work, previews)),
      date, `wing:${wing.id}`,
    )),
  }));
  const newest = [];
  for (const work of newestWorks) {
    if (reserve(work)) newest.push(work);
    if (newest.length === 4) break;
  }
  return { lead, pair, teasers, roomWork, spatialWork, wingCards, newest, usedSlugs: [...used] };
}
