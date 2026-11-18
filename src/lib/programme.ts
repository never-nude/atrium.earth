import programmes from '../data/museum-programmes.json';
import spatialManifest from '../../public/spatial-museum/collection-manifest.json';
import { inlinePreviewMap as previews, homepageFeaturedWorks, type Work } from './catalog';
import { exhibitions, pairings, type V3Exhibition, type V3Pairing } from './v3';
import { buildMuseumProgramme } from './museum-programme.mjs';
import { programmeDate } from './museum-date.mjs';

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

const result = buildMuseumProgramme({
  date: programmeDate,
  // Owner-selected homepage exhibition; retain the normal calendar configuration
  // and its rotation rules for other programme callers.
  programmes: { ...programmes, focuses: programmes.focuses.filter(focus => focus.exhibitionId === 'what-survives') },
  exhibitions:
  homepageWorks: homepageFeaturedWorks,
  previews,
  pairings,
  rooms: spatialManifest.rooms,
});
export const currentProgramme = result as MuseumProgramme;
export { programmeDate };
