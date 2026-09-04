export const wingIds = [
  'near-east',
  'greece-rome',
  'europe',
  'asia',
  'africa',
  'americas-oceania',
] as const;

export type WingId = (typeof wingIds)[number];

export type Wing = {
  id: WingId;
  name: string;
  blurb: string;
  featured: string[];
  match: {
    region?: string[];
    place?: string[];
    slugs?: string[];
  };
};

// Root-level records predate the collection-folder convention. Keeping their
// routing here makes the exception visible and lets every future foldered work
// file itself automatically through `match.region`.
const nearEastLegacySlugs = [
  'aphrodite-holding-winged-eros',
  'cleopatra-v-tryphaena',
  'cypriot-limestone-priest',
  'figure-of-a-man-with-an-oryx',
  'head-of-a-female-or-goddess-wearing-a-necklace',
  'head-of-a-male-or-female-figure',
  'head-of-a-ruler',
  'head-of-gudea',
  'horus-protecting-nectanebo-ii',
  'limestone-figure-of-a-woman',
  'limestone-funerary-stele-cypriot-capital',
  'limestone-head-of-a-bearded-man',
  'limestone-statue-of-herakles',
  'limestone-votive-relief-banquet-scenes',
  'marble-anthropoid-sarcophagus-74-51-2452',
  'marble-anthropoid-sarcophagus-74-51-2454',
  'princess-from-amarna',
  'silver-bowl-isis-medallion',
  'sphinx',
  'statue-of-ur-ningirsu',
];

const classicalLegacySlugs = [
  'adolescent-torso',
  'antinoos-farnese',
  'aphrodite-anadyomene',
  'apollo-belvedere',
  'apollo-lykeios',
  'aristippos-of-cyrene',
  'artemision-bronze',
  'athena-lemnia',
  'athena-pallas-giustiniani',
  'attis',
  'augustus-of-prima-porta',
  'barberini-faun',
  'bearded-hercules-head',
  'belvedere-torso',
  'borghese-gladiator',
  'bronze-figure-boy-eastern-dress',
  'bronze-horse-head-herculaneum',
  'bust-of-marcus-aurelius',
  'capitoline-venus',
  'capitoline-wolf',
  'castor-and-pollux',
  'crouching-venus',
  'cybele-ra-34-i',
  'cycladic-marble-female-figure',
  'diadoumenos-bust',
  'diana-ra-34-h',
  'dionysos-farnese',
  'discobolus',
  'doryphoros',
  'doryphoros-torso',
  'dying-gaul',
  'dying-niobid',
  'eros-flying',
  'final-neolithic-marble-female-figure',
  'galeria-valeria-eutropia',
  'ganymede',
  'germanicus',
  'head-from-farnese-hercules-type',
  'head-of-maxence',
  'herakles-lansdowne',
  'hermes-antinoos-from-belvedere',
  'hestia',
  'juno-ludovisi',
  'kneeling-youth',
  'laocoon',
  'lion',
  'ludovisi-gaul',
  'lying-lion',
  'marble-capital-sphinx',
  'marble-sarcophagus-lions-antelope',
  'marble-stele-youth-and-little-girl',
  'medici-faun',
  'menippos',
  'narcissus-and-echo-puteal',
  'old-fisherman',
  'penelope',
  'porcellino',
  'portrait-of-antinoos',
  'portrait-of-homer',
  'pudicity',
  'strangford-shield',
  'thalia',
  'the-wrestlers',
  'venus-de-milo',
  'vulcan',
  'young-bacchus-bronze',
  // This work now has a folder, but remains here to document the intended
  // Anatolian Neolithic grouping. Its catalog override takes precedence.
  'ancient-near-east/stargazer-cleveland',
];

const europeanLegacySlugs = [
  'arch-keystone-470788',
  'block-470953',
  'corbel-25-120-599',
  'corbel-25-120-601',
  'corbel-25-120-602',
  'development-of-a-bottle-in-space',
  'diana-of-villa-bartholoni',
  'entombment-of-christ',
  'lintel-470947',
  'pandora-james-pradier',
  'perseus-with-head-of-medusa',
  'pieta-with-donors',
  'relief-agnus-dei-and-cherub',
  'spandrel',
  'spandrel-sections-of-an-arch',
  'tomb-effigy-ermengol-ix',
  'tomb-of-ermengol-x',
  'ugolino-and-his-sons',
  'voussoir-472190',
];

const americasOceaniaLegacySlugs = [
  'ancestor-figure-sawos',
  'mourning-victory-melvin-memorial',
  'outside-row-standing-horse',
];

// Order is policy: Egypt and the Near East precedes the classical and European
// rules; Greece & Rome precedes Europe. assignWing returns the first match.
export const wings: Wing[] = [
  {
    id: 'near-east',
    name: 'Egypt & the Ancient Near East',
    blurb: 'Egypt, Mesopotamia, Assyria, Persia, and the Levant, from the Old Kingdom to Palmyra.',
    featured: [
      'egyptian/portrait-of-nefertiti-smk-cast',
      'assyrian/winged-genius-mia',
    ],
    match: {
      region: ['egyptian', 'ancient-near-east', 'assyrian', 'palmyra'],
      place: ['Ancient Near East', 'Ancient Near East and Egypt'],
      slugs: nearEastLegacySlugs,
    },
  },
  {
    id: 'greece-rome',
    name: 'Greece & Rome',
    blurb: 'Aegean figurines, Archaic and Classical Greece, the Hellenistic world, and Rome. Originals and the casts made after them.',
    featured: [
      'roman/horse-marcus-aurelius-smk-cast',
      'laocoon',
    ],
    match: {
      region: ['greek', 'roman'],
      place: ['Mediterranean', 'Roman Italy', 'Smyrna, Roman Asia Minor'],
      slugs: classicalLegacySlugs,
    },
  },
  {
    id: 'europe',
    name: 'Europe',
    blurb: 'Everything European that is not Greek or Roman, from Paleolithic figurines through Romanesque, Renaissance, Baroque, and Rodin.',
    featured: [
      'michelangelo/david',
      'modern/the-kiss-rodin-musee-rodin-s-1002',
    ],
    match: {
      region: [
        'europe',
        'medieval',
        'renaissance',
        'michelangelo',
        'donatello',
        'verrocchio',
        'baroque',
        'neoclassical',
        'modern',
        'rodin',
        'bouchardon',
        'lorenzi',
      ],
      place: [
        'Europe',
        'France',
        'Italy',
        'Augsburg, Germany',
        'Île-de-France, France',
        'Lower Austria, Central Europe',
        'Venice, Italy',
      ],
      slugs: europeanLegacySlugs,
    },
  },
  {
    id: 'asia',
    name: 'Asia',
    blurb: 'China, Japan, India, the Khmer and Cham kingdoms, and the Islamic world.',
    featured: [
      'asia/shiva-nataraja-after-conservation-mia',
      'asia/cosmic-buddha',
    ],
    match: {
      region: ['asia'],
      place: ['Asia'],
    },
  },
  {
    id: 'africa',
    name: 'Africa',
    blurb: 'West and Central African figures, masks, posts, and carved ivory, mostly 19th and 20th century.',
    featured: [
      'sub-saharan-africa/nkisi-power-figure',
      'sub-saharan-africa/kongo-maternity-figure',
    ],
    match: {
      region: ['sub-saharan-africa'],
      place: ['Sub-Saharan Africa'],
    },
  },
  {
    id: 'americas-oceania',
    name: 'The Americas & Oceania',
    blurb: 'Moche and Nayarit ceramics, Mississippian and Taíno carving, Pacific ancestor poles and masks, and North American sculpture into the twentieth century.',
    featured: [
      'americas/key-marco-cat',
      'americas/bisj-ancestor-pole-1978-412-1251',
    ],
    match: {
      region: ['americas', 'oceania'],
      place: ['Americas and Oceania'],
      slugs: americasOceaniaLegacySlugs,
    },
  },
];

export function isWingId(value: unknown): value is WingId {
  return wingIds.includes(value as WingId);
}
