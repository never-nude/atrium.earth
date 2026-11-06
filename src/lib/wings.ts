import { wings, type Wing, type WingId } from '../data/wings';
import { featuredWorks, works, type Work } from './catalog';
import previews from '../data/previews.json';
import { isPreviewBudgetEligible, rotateContextWork } from './museum-programme.mjs';
import { programmeDate } from './museum-date.mjs';

export type WingRouteId = WingId | 'unfiled';

export type WingSummary = {
  wing: Wing;
  count: number;
  featured?: Work;
};

export function wingRoute(id: WingRouteId): string {
  return `/wings/${id}/`;
}

export function wingById(id: string): Wing | undefined {
  return wings.find((wing) => wing.id === id);
}

export function worksForWing(id: WingRouteId): Work[] {
  return works.filter((work) => work.wing === id);
}

export function featuredWorkForWing(wing: Wing): Work | undefined {
  // A new weekly entrance from the reviewed collection; the chronological
  // arrangement and membership of the wing itself stay consistent.
  const eligible = featuredWorks.filter((work) => work.wing === wing.id && isPreviewBudgetEligible(work, previews));
  return rotateContextWork(eligible, programmeDate, `wing:${wing.id}`) ?? undefined;
}

export const wingSummaries: WingSummary[] = wings.map((wing) => ({
  wing,
  count: worksForWing(wing.id).length,
  featured: featuredWorkForWing(wing),
}));

let reportPrinted = false;

/** Print the non-fatal build audit requested by the Wings brief. */
export function logWingBuildReport(): void {
  if (reportPrinted) return;
  reportPrinted = true;

  const unfiled = worksForWing('unfiled');
  console.log('\nAtrium wing assignment report');
  console.table([
    ...wingSummaries.map(({ wing, count }) => ({ wing: wing.name, count })),
    { wing: 'Unfiled', count: unfiled.length },
  ]);

  if (!unfiled.length) {
    console.log('Unfiled works: none\n');
    return;
  }

  console.warn('Unfiled works (build continues):');
  for (const work of unfiled) {
    console.warn(
      `- ${work.slug} | region=${work.collection || '(root)'} | place=${work.geography || '(empty)'}`,
    );
  }
  console.log('');
}
