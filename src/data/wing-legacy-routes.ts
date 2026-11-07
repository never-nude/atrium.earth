// Retired entrances remain useful to existing bookmarks. They point to all
// relevant regional wings instead of assigning a whole historical world to one.
export const legacyWingRoutes = {
  'near-east': {
    name: 'Egypt & the Ancient Near East',
    line: 'Egypt and the Ancient Near East are now explored through Africa and Asia. Choose a regional wing below, or use the globe to follow places through time.',
    destinations: ['africa', 'asia'],
  },
  'greece-rome': {
    name: 'Greece & Rome',
    line: 'Greek and Roman works now sit within their regional wings. Their histories reach across Europe, Africa and Asia; documented regional origins guide each work’s primary home.',
    destinations: ['europe', 'africa', 'asia'],
  },
  'americas-oceania': {
    name: 'The Americas & Oceania',
    line: 'The Americas and Oceania now have separate wings, giving each region its own entrance. The works and their individual pages remain available.',
    destinations: ['americas', 'oceania'],
  },
} as const;
export type LegacyWingId = keyof typeof legacyWingRoutes;
