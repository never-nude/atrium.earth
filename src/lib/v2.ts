import { facets, featuredWorkForDate, recentlyPrepared, workBySlug, works, type Work } from './catalog';

export type V2Exhibition = {
  slug: string;
  number: string;
  title: string;
  shortTitle: string;
  kicker: string;
  summary: string;
  invitation: string;
  accent: string;
  works: Work[];
};

type ExhibitionSeed = Omit<V2Exhibition, 'works'> & { workSlugs: string[] };

const seeds: ExhibitionSeed[] = [
  {
    slug: 'bodies-in-motion',
    number: '01',
    title: 'Bodies in Motion',
    shortTitle: 'Motion',
    kicker: 'Gesture, force, balance',
    summary: 'Eleven works that use posture, balance, and composition to describe movement: throwing, falling, wrestling, dancing, and walking.',
    invitation: 'Compare each work from the front, side, and back. Notice how a shift in weight, a raised arm, or a supporting element makes the movement readable.',
    accent: '#b9a7ff',
    workSlugs: [
      'discobolus',
      'the-wrestlers',
      'greek/terracotta-dancer-msr',
      'michelangelo/dying-slave',
      'michelangelo/rebellious-slave',
      'laocoon',
      'rodin/the-walking-man',
      'modern/figure-of-a-dancer-leonard-smithsonian',
      'greek/lying-wounded-warrior-aphaia-smk-cast',
      'americas/girl-skating-eberle-smithsonian',
      'borghese-gladiator',
    ],
  },
  {
    slug: 'power-and-presence',
    number: '02',
    title: 'Power & Presence',
    shortTitle: 'Power',
    kicker: 'Rulers, protectors, ancestors',
    summary: 'Across time and place, sculpture has represented authority through scale, posture, material, costume, and religious or political symbols.',
    invitation: 'Compare the works from several angles. Look for the visual choices that establish status: scale, facial expression, gesture, surface, and supporting figures.',
    accent: '#ff7a5c',
    workSlugs: [
      'head-of-gudea',
      'egyptian/portrait-of-nefertiti-smk-cast',
      'egyptian/goddess-sekhmet-mia',
      'augustus-of-prima-porta',
      'roman/bust-of-trajan-msr',
      'michelangelo/moses',
      'sub-saharan-africa/nkisi-power-figure',
      'sub-saharan-africa/ancestor-figure-teke',
      'americas/white-ogre-tihu-katsina-figure',
      'asia/standing-buddha-radiate-combined-halo',
    ],
  },
  {
    slug: 'sacred-forms',
    number: '03',
    title: 'Sacred Forms',
    shortTitle: 'Sacred',
    kicker: 'Devotion, protection, passage',
    summary: 'Works associated with prayer, protection, remembrance, and passage. They come from distinct traditions and should be understood in relation to their original settings.',
    invitation: 'Use the object records alongside the models. Look for attributes, materials, inscriptions, cavities, and signs of use that help explain each work’s function.',
    accent: '#76a7ff',
    workSlugs: [
      'horus-protecting-nectanebo-ii',
      'egyptian/false-door-irienakhet-mia',
      'asia/cosmic-buddha',
      'asia/bodhisattva-avalokiteshvara-gwaneum-smithsonian',
      'asia/ganesha-mia',
      'americas/zemi-cohoba-stand',
      'sub-saharan-africa/gelede-helmet-mask',
      'sub-saharan-africa/kongo-maternity-figure',
      'michelangelo/pieta',
      'donatello/saint-george',
    ],
  },
  {
    slug: 'what-survives',
    number: '04',
    title: 'What Survives',
    shortTitle: 'Fragments',
    kicker: 'Fragments, casts, afterlives',
    summary: 'A missing limb, an isolated head, a surviving relief, and a cast after a distant original. These works show how sculpture is changed by damage, copying, and collection history.',
    invitation: 'Examine edges, breaks, joins, and casts. Missing sections and later restorations can be as important to interpretation as the surviving form.',
    accent: '#e8d8bd',
    workSlugs: [
      'belvedere-torso',
      'adolescent-torso',
      'greek/athena-parthenos-fragment-smk-cast',
      'greek/selene-horse-head-parthenon-smk-cast',
      'renaissance/head-of-saint-john-baptist-bode-threedscans',
      'ancient-near-east/assyrian-eagle-headed-demon-fitzwilliam',
      'head-from-farnese-hercules-type',
      'greek/head-of-a-giant-smk-cast',
      'bronze-horse-head-herculaneum',
      'egyptian/head-of-merytaten-smk-cast',
    ],
  },
  {
    slug: 'the-work-of-the-surface',
    number: '05',
    title: 'The Work of the Surface',
    shortTitle: 'Surface',
    kicker: 'Carving, relief, ornament',
    summary: 'Ten works in which shallow relief, incised lines, drilled depth, modeled clay, and painted or carved ornament carry essential information.',
    invitation: 'Zoom in and adjust the lighting to make shallow carving, texture, and changes of depth easier to see. Use wireframe as a viewing aid, not as a substitute for the object record.',
    accent: '#c9a5ff',
    workSlugs: [
      'assyrian/ashurnasirpal-lion-hunt',
      'sub-saharan-africa/kongo-tusk-relief-nmafa-74-20-1',
      'asia/bayon-naval-battle-relief-cast-guimet-threedscans',
      'asia/cosmic-buddha',
      'michelangelo/battle-of-the-centaurs',
      'michelangelo/tondo-pitti',
      'americas/underwater-panther-vessel-quapaw-mia',
      'asia/jue-wine-vessel-mia-commons',
      'sub-saharan-africa/helmet-mask-four-faces',
      'asia/minai-bowl-courtly-scene-mia',
    ],
  },
];

function resolveWorks(slugs: string[]): Work[] {
  return slugs.map((slug) => workBySlug(slug)).filter((work): work is Work => Boolean(work));
}

export const exhibitions: V2Exhibition[] = seeds.map(({ workSlugs, ...seed }) => ({
  ...seed,
  works: resolveWorks(workSlugs),
}));

// Rotates every Sunday: the weekly deploy cron rebuilds the site, and
// featuredWorkForDate picks deterministically from the Sunday-anchored week index.
// Owner's pick for the rest of the week of 2026-07-12; expires on its own when the
// Sunday 2026-07-19 rebuild lands (this line can be deleted any time after that).
const pinnedUntil = Date.UTC(2026, 6, 19);
export const featuredWork = (Date.now() < pinnedUntil ? workBySlug('discobolus') : undefined) ?? featuredWorkForDate();
export const collectionCount = works.length;
export const newToCollection = recentlyPrepared(10);
export const v2Facets = facets;

export function v2WorkRoute(work: Work | string): string {
  const slug = typeof work === 'string' ? work : work.slug;
  return `/v2/works/${slug}/`;
}

export function v2ExhibitionRoute(exhibition: V2Exhibition | string): string {
  const slug = typeof exhibition === 'string' ? exhibition : exhibition.slug;
  return `/v2/exhibitions/${slug}/`;
}

export function exhibitionBySlug(slug: string): V2Exhibition | undefined {
  return exhibitions.find((exhibition) => exhibition.slug === slug);
}

export function neighborsFor(work: Work): { previous: Work; next: Work } {
  const index = works.findIndex((candidate) => candidate.slug === work.slug);
  const safeIndex = index < 0 ? 0 : index;
  return {
    previous: works[(safeIndex - 1 + works.length) % works.length],
    next: works[(safeIndex + 1) % works.length],
  };
}

export { works };
