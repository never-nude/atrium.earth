export const wingIds = ['europe', 'asia', 'africa', 'americas', 'oceania'] as const;
export type WingId = (typeof wingIds)[number];

export type Wing = {
  id: WingId;
  name: string;
  blurb: string;
  featured: string[];
  match: { region?: string[]; place?: string[]; slugs?: string[] };
};

// Geographic collection scopes: periods, religions, makers and holding
// institutions cannot establish a primary regional home.
export const wings: Wing[] = [
  {
    id: 'europe', name: 'Europe',
    blurb: 'Works with a documented European origin or cultural scope, from antiquity to the present.',
    featured: ['michelangelo/david', 'rodin/the-thinker'],
    match: { region: ['europe'], place: ['Europe'] },
  },
  {
    id: 'asia', name: 'Asia',
    blurb: 'Works from East, South, Southeast, Central and West Asia, across periods and traditions.',
    featured: ['asia/shiva-nataraja-after-conservation-mia', 'asia/cosmic-buddha'],
    match: { region: ['asia'], place: ['Asia'] },
  },
  {
    id: 'africa', name: 'Africa',
    blurb: 'Works from across Africa, including Egypt and North Africa, across periods and traditions.',
    featured: ['egyptian/portrait-of-nefertiti-smk-cast', 'sub-saharan-africa/seated-figure-middle-niger'],
    match: { region: ['africa', 'sub-saharan-africa', 'north-africa', 'egyptian'], place: ['Africa', 'Sub-Saharan Africa'] },
  },
  {
    id: 'americas', name: 'Americas',
    blurb: 'Works from North, Central and South America and the Caribbean, across periods and traditions.',
    featured: ['americas/zemi-cohoba-stand'],
    match: { region: ['americas'], place: ['Americas', 'North America', 'South America'] },
  },
  {
    id: 'oceania', name: 'Oceania',
    blurb: 'Works from Australia and the Pacific, including Melanesia, Micronesia and Polynesia.',
    featured: ['oceania/moai-kava-kava-mnhn-chile'],
    match: { region: ['oceania'], place: ['Oceania'] },
  },
];

export function isWingId(value: unknown): value is WingId {
  return wingIds.includes(value as WingId);
}
