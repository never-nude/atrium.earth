import { facets, works } from './catalog';

type Redirect = {
  from: string;
  to: string;
  status: 301 | 302;
  reason: string;
};

const facetRedirects: Redirect[] = [
  ...facets.makers
    .filter((facet) => facet.label !== 'Maker not yet recorded')
    .map((facet) => ({
      from: `/${facet.value}/`,
      to: `/collection/?maker=${encodeURIComponent(facet.value)}`,
      status: 301 as const,
      reason: 'Legacy maker collection route',
    })),
  ...facets.geography
    .filter((facet) => facet.label !== 'Unassigned geography')
    .map((facet) => ({
      from: `/${facet.value}/`,
      to: `/collection/?place=${encodeURIComponent(facet.value)}`,
      status: 301 as const,
      reason: 'Legacy geography collection route',
    })),
];

const legacyCollectionRedirects: Redirect[] = [
  { from: '/americas/', to: '/collection/?place=americas-and-oceania', status: 301, reason: 'Legacy collection route' },
  { from: '/asia/', to: '/collection/?place=asia', status: 301, reason: 'Legacy collection route' },
  { from: '/assyrian/', to: '/collection/?place=ancient-near-east', status: 301, reason: 'Legacy collection route' },
  { from: '/bouchardon/', to: '/collection/?maker=bouchardon', status: 301, reason: 'Legacy collection route' },
  { from: '/donatello/', to: '/collection/?maker=donatello', status: 301, reason: 'Legacy collection route' },
  { from: '/lorenzi/', to: '/collection/?maker=lorenzi', status: 301, reason: 'Legacy collection route' },
  { from: '/michelangelo/', to: '/collection/?maker=michelangelo', status: 301, reason: 'Legacy collection route' },
  { from: '/palmyra/', to: '/collection/?place=ancient-near-east', status: 301, reason: 'Legacy collection route' },
  { from: '/rodin/', to: '/collection/?maker=auguste-rodin', status: 301, reason: 'Legacy collection route' },
  { from: '/sub-saharan-africa/', to: '/collection/?place=sub-saharan-africa', status: 301, reason: 'Legacy collection route' },
  { from: '/verrocchio/', to: '/collection/?maker=verrocchio', status: 301, reason: 'Legacy collection route' },
];

const exactWorkRedirects: Redirect[] = works.map((work) => ({
  from: work.legacyRoute,
  to: work.route,
  status: 301,
  reason: 'Canonical work route',
}));

const redirects: Redirect[] = [
  {
    from: 'https://formgallery.org/*',
    to: 'https://atrium.earth/:splat',
    status: 301,
    reason: 'Canonical domain',
  },
  {
    from: 'https://www.formgallery.org/*',
    to: 'https://atrium.earth/:splat',
    status: 301,
    reason: 'Canonical domain',
  },
  {
    from: 'https://www.atrium.earth/*',
    to: 'https://atrium.earth/:splat',
    status: 301,
    reason: 'Canonical domain',
  },
  ...legacyCollectionRedirects,
  ...facetRedirects,
  ...exactWorkRedirects,
];

export const legacyRedirects: Redirect[] = [...new Map(redirects.map((redirect) => [redirect.from, redirect])).values()];

export function redirectForPath(path: string): Redirect | undefined {
  const normalized = path.endsWith('/') ? path : `${path}/`;
  return legacyRedirects.find((redirect) => redirect.from === normalized);
}
