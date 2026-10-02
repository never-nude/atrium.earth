import { isWingId, wings, type WingId } from '../data/wings.ts';

export type WingAssignmentInput = {
  slug?: string;
  id?: string;
  wing?: string | null;
  region?: string | null;
  collection?: string | null;
  place?: string | null;
  geography?: string | null;
  data?: {
    wing?: string | null;
    region?: string | null;
    collection?: string | null;
    place?: string | null;
    geography?: string | null;
  };
};

function normalized(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('en');
}

function firstPopulated(...values: unknown[]): string {
  for (const value of values) {
    const candidate = normalized(value);
    if (candidate) return candidate;
  }
  return '';
}

function includes(values: string[] | undefined, candidate: string): boolean {
  if (!candidate) return false;
  return Boolean(values?.some((value) => normalized(value) === candidate));
}

/** Assign a work to the first matching wing. An explicit per-record override wins. */
export function assignWing(work: WingAssignmentInput): WingId | 'unfiled' {
  const data = work.data ?? {};
  const override = data.wing ?? work.wing;
  if (isWingId(override)) return override;
  if (override === 'unfiled') return 'unfiled';
  // A typo in a direct catalog edit must surface in the build report rather
  // than being silently masked by a later automatic match.
  if (normalized(override)) return 'unfiled';

  const slug = normalized(work.slug ?? work.id);
  const folderFromSlug = slug.includes('/') ? slug.split('/')[0] : '';
  const region = firstPopulated(
    data.region,
    data.collection,
    work.region,
    work.collection,
    folderFromSlug,
  );
  const place = firstPopulated(
    data.place,
    data.geography,
    work.place,
    work.geography,
  );

  for (const wing of wings) {
    if (
      includes(wing.match.region, region)
      || includes(wing.match.place, place)
      || includes(wing.match.slugs, slug)
    ) {
      return wing.id;
    }
  }

  return 'unfiled';
}
