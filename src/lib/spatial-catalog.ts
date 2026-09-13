import { works, workBySlug, type Work } from './catalog';

export const arVrWorks = works.filter(work => work.spatialEligibility.enabled);
export const arVrCount = arVrWorks.length;

// Distinct recorded sizes, with each card labelled; thumbnails are not to scale.
const candidates = ['michelangelo/david', 'asia/guardian-nio-open-mouth-cleveland', 'europe/venus-of-willendorf-nhmw-44-686'];
export const arVrFeatured = candidates.map(slug => workBySlug(slug))
  .filter((work): work is Work => Boolean(work?.spatialEligibility.enabled));
