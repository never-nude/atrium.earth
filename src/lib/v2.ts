import { facets, recentlyPrepared, workBySlug, works, type Work } from './catalog';

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
    summary: 'Eleven bodies caught between one position and the next: turning, falling, wrestling, dancing, resisting, and walking.',
    invitation: 'Move around each figure. Look for the point where balance becomes effort—and where still material begins to feel alive.',
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
    summary: 'Across time and place, sculpture has made authority visible. These works project command through scale, stillness, gaze, material, and ritual form.',
    invitation: 'Meet each figure at eye level, then circle it. Notice how the impression of authority changes from the front, side, and back.',
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
    summary: 'Objects made for prayer, protection, remembrance, and passage—encountered here not as a single tradition, but as many distinct ways of giving form to belief.',
    invitation: 'Slow down. Explore the gestures, attributes, cavities, surfaces, and signs that made these works meaningful in their original settings.',
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
    summary: 'A missing limb, an isolated head, a surviving relief, a cast of a distant original. Sculpture often reaches us incomplete—and asks the imagination to finish the encounter.',
    invitation: 'Zoom into edges and breaks. Switch to wireframe. The absent parts are not empty; they shape how every surviving part is seen.',
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
    summary: 'Ten works that reward close looking. Incised lines, shallow relief, drilled depth, modeled clay, and carved pattern carry histories that disappear at thumbnail size.',
    invitation: 'Bring the camera close enough to lose the whole object. Move the light across the surface, then reveal the wireframe beneath it.',
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

export const featuredWork = workBySlug('michelangelo/david') ?? works[0];
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
