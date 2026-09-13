import { works, workBySlug, type Work } from './catalog';

export const arVrWorks = works.filter(work => work.spatialAccess.enabled);
export const arVrCount = arVrWorks.length;
export const arVrVerifiedCount = arVrWorks.filter(work => work.spatialAccess.verified).length;
export const arVrUnverifiedCount = arVrCount - arVrVerifiedCount;

// Cards distinguish measured references from default display sizes; thumbnails are not to scale.
const candidates = ['michelangelo/david', 'modern/dubuffet-la-chiffonniere', 'europe/venus-of-willendorf-nhmw-44-686'];
export const arVrFeatured = candidates.map(slug => workBySlug(slug))
  .filter((work): work is Work => Boolean(work?.spatialAccess.enabled));
