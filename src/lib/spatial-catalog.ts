import { featuredWorks, isFeaturedWork, works, workBySlug, type Work } from './catalog';

export const arVrWorks = works.filter(work => work.spatialAccess.enabled);
export const arVrCount = arVrWorks.length;
export const arVrVerifiedCount = arVrWorks.filter(work => work.spatialAccess.verified).length;
export const arVrApproximateCount = arVrWorks.filter(work => work.spatialAccess.status === 'approximate').length;
export const arVrUnknownCount = arVrWorks.filter(work => work.spatialAccess.status === 'unknown').length;

// Cards distinguish verified, estimated and unknown dimensions; thumbnails are not to scale.
const candidates = ['michelangelo/david', 'modern/dubuffet-la-chiffonniere', 'europe/venus-of-willendorf-nhmw-44-686'];
export const arVrFeatured = candidates.map(slug => workBySlug(slug))
  .filter((work): work is Work => Boolean(work?.spatialAccess.enabled && isFeaturedWork(work)));
for (const work of featuredWorks) {
  if (arVrFeatured.length >= 3) break;
  if (work.spatialAccess.enabled && !arVrFeatured.some(candidate => candidate.slug === work.slug)) arVrFeatured.push(work);
}
