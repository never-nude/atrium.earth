import { worldCollection } from '../../lib/world-collection.ts';
import { withBase } from '../../lib/urls';

const reasons: Record<string, string> = {
  'origin-not-recorded': 'No geographic or sufficiently specific cultural origin recorded.',
  'uncertain-origin': 'The available origin is uncertain or gives unresolved alternatives.',
  'unresolved-geography': 'The geography cannot be assigned to a defensible map point.',
  'unresolved-original-location': 'The recorded original location cannot be assigned to a defensible map point.',
  'cast-manufacture-not-established': 'The manufacture location of this cast is unestablished.',
  'holding-only': 'The location describes a holding institution.',
  'reconstruction-origin-unresolved': 'The record describes a reconstruction with unresolved origin.',
  'conflicting-origin-fields': 'The recorded origin fields conflict.',
};

export function GET() {
  const works = worldCollection.works.filter(work => work.placeId === null).map(work => ({
    title: work.title, slug: work.slug, url: withBase(work.url), reason: work.originReason,
  }));
  return Response.json({
    mapped: worldCollection.totalCount - works.length,
    unmapped: works.length,
    reasons,
    works,
  });
}
