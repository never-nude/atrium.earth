import { wings, type Wing, type WingId } from '../data/wings';
import { workBySlug, works, type Work } from './catalog';

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
  const preferred = wing.featured
    .map((slug) => workBySlug(slug))
    .find((work): work is Work => Boolean(work?.hasPreview));
  return preferred ?? worksForWing(wing.id).find((work) => work.hasPreview) ?? worksForWing(wing.id)[0];
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
