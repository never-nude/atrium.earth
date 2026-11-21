import programmes from '../data/museum-programmes.json';
import spatialManifest from '../../public/spatial-museum/collection-manifest.json';
import { featuredWorks, inlinePreviewMap as previews, homepageFeaturedWorks, type Work } from './catalog';
import { exhibitions, pairings, type V3Exhibition, type V3Pairing } from './v3';
import { buildMuseumProgramme } from './museum-programme.mjs';
import { programmeDate } from './museum-date.mjs';
import { isWithinInitialPreviewBudget } from './viewer-preview.mjs';

export type ProgrammeLayout = 'exhibition-first';
export type ProgrammeSection = 'wings' | 'galleries' | 'ar-vr' | 'comparisons' | 'exhibitions';
export type MuseumRoom = typeof spatialManifest.rooms[number];
export type MuseumProgramme = {
  focus: V3Exhibition;
  focusIntro: string;
  hero: Work;
  heroPrompt: string;
  heroQueue: Work[];
  exhibitions: V3Exhibition[];
  pairings: V3Pairing[];
  room: MuseumRoom | null;
  layout: ProgrammeLayout;
  sectionOrder: ProgrammeSection[];
  accent: string;
  weekKey: string;
  dayKey: string;
};

// The homepage has a curator-selected edition; the general programme engine
// keeps its tested rotation behaviour for other callers and future editions.
const scheduled = buildMuseumProgramme({
  date: programmeDate,
  programmes: { ...programmes, focuses: programmes.focuses.filter(focus => focus.exhibitionId === 'what-survives') },
  exhibitions: exhibitions.filter(exhibition => !exhibition.orderedGallery),
  homepageWorks: homepageFeaturedWorks,
  previews,
  pairings,
  rooms: spatialManifest.rooms,
});
// Discobolus is approved for this curated edition. The rotation continues to use its own review pool.
const selectedHero = featuredWorks.find(work => work.slug === 'discobolus'
  && work.hasPreview && isWithinInitialPreviewBudget(work.modelBytes));
const result = {
  ...scheduled,
  hero: selectedHero ?? scheduled.hero,
  heroPrompt: selectedHero ? 'Turn the work to compare its front, sides and back.' : scheduled.heroPrompt,
};
export const currentProgramme = result as MuseumProgramme;
export { programmeDate };
