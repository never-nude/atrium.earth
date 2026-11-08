// Browsing aliases only. Object credits, cast identities and source records stay
// unchanged. These are exact reviewed publicDataset facet tokens, not fuzzy
// artist-name matching. Add uncertain/workshop/"after" credits separately.
const groups = [
  {
    value: 'auguste-rodin', label: 'Auguste Rodin',
    aliases: [
      'auguste-rodin', 'rodin', 'auguste-rodin-1840-1917',
      'auguste-rodin-cast-by-alexis-rudier-foundry',
      'auguste-rodin-source-mesh-by-artnerd3d',
      'auguste-rodin-source-mesh-by-scan-the-world',
    ],
  },
  {
    value: 'michelangelo', label: 'Michelangelo',
    aliases: ['michelangelo', 'michelangelo-buonarroti'],
  },
  {
    value: 'antonio-canova', label: 'Antonio Canova',
    aliases: [
      'antonio-canova', 'antonio-canova-1757-1822',
      // "after Scan The World" qualifies the digital remix, not the sculptor.
      'antonio-canova-source-mesh-remix-by-3dladnik-after-scan-the-world',
    ],
  },
  {
    value: 'bertel-thorvaldsen', label: 'Bertel Thorvaldsen',
    aliases: ['bertel-thorvaldsen', 'bertel-thorvaldsen-1770-1844'],
  },
];

const byAlias = new Map();
for (const group of groups) {
  for (const value of group.aliases) {
    if (byAlias.has(value)) throw new Error(`Duplicate reviewed maker facet alias: ${value}`);
    byAlias.set(value, Object.freeze({ value: group.value, label: group.label }));
  }
}

/** Accept the original publicDataset maker token and its unchanged full label. */
export function groupMakerFacet(originalFacetValue, label) {
  const group = byAlias.get(originalFacetValue);
  return group ? { ...group } : { value: originalFacetValue, label };
}

/** Both operands are facet tokens; saved exact aliases still select their group. */
export function makerFacetMatches(recordMaker, selectedValue) {
  if (!selectedValue) return true;
  if (typeof recordMaker !== 'string' || typeof selectedValue !== 'string') return false;
  return (byAlias.get(recordMaker)?.value || recordMaker) === (byAlias.get(selectedValue)?.value || selectedValue);
}
