import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupMakerFacet, makerFacetMatches } from '../src/lib/maker-groups.mjs';

const records = JSON.parse(readFileSync(new URL('../src/data/catalog.json', import.meta.url)));
const corrections = JSON.parse(readFileSync(new URL('../src/data/identity-corrections.json', import.meta.url)));
const catalogSource = readFileSync(new URL('../src/lib/catalog.ts', import.meta.url), 'utf8');
// Exercise the catalogue's actual tokeniser so changes cannot strand these
// explicit aliases. This evaluates only the small trusted pure valueKey body.
const body = /function valueKey\(value: string\): string \{([\s\S]*?)\n\}/.exec(catalogSource)?.[1];
assert.ok(body, 'Locate the actual publicDataset facet tokeniser');
const facetValue = new Function('value', body);
const labels = new Set(records.filter(work => !work.hidden).map(work => ({ ...work, ...corrections[work.slug]?.catalog })).map(work => String(work.artist || '').replace(/\s+/g, ' ').trim()));

const reviewed = [
  ['Auguste Rodin', 'auguste-rodin', 'Auguste Rodin'],
  ['Rodin', 'auguste-rodin', 'Auguste Rodin'],
  ['Auguste Rodin (1840–1917)', 'auguste-rodin', 'Auguste Rodin'],
  ['Auguste Rodin; cast by Alexis Rudier Foundry', 'auguste-rodin', 'Auguste Rodin'],
  ['Auguste Rodin; source mesh by ArtNerd3D', 'auguste-rodin', 'Auguste Rodin'],
  ['Auguste Rodin; source mesh by Scan The World', 'auguste-rodin', 'Auguste Rodin'],
  ['Michelangelo', 'michelangelo', 'Michelangelo'],
  ['Michelangelo Buonarroti', 'michelangelo', 'Michelangelo'],
  ['Antonio Canova', 'antonio-canova', 'Antonio Canova'],
  ['Antonio Canova (1757–1822)', 'antonio-canova', 'Antonio Canova'],
  ['Antonio Canova; source mesh remix by 3DLadnik after Scan The World', 'antonio-canova', 'Antonio Canova'],
  ['Bertel Thorvaldsen', 'bertel-thorvaldsen', 'Bertel Thorvaldsen'],
  ['Bertel Thorvaldsen (1770–1844)', 'bertel-thorvaldsen', 'Bertel Thorvaldsen'],
];

test('all reviewed aliases come from actual public labels and use current facet tokens', () => {
  for (const [label, value, display] of reviewed) {
    assert.ok(labels.has(label), `Reviewed label still exists: ${label}`);
    const token = facetValue(label);
    assert.deepEqual(groupMakerFacet(token, label), { value, label: display });
    assert.equal(makerFacetMatches(token, value), true);
  }
});

test('saved exact alias queries match the same reviewed artist group in either direction', () => {
  for (const [label, canonical] of reviewed) {
    const legacy = facetValue(label);
    assert.equal(makerFacetMatches(canonical, legacy), true);
    assert.equal(makerFacetMatches(legacy, canonical), true);
    for (const [otherLabel, otherCanonical] of reviewed) {
      if (canonical === otherCanonical) assert.equal(makerFacetMatches(facetValue(otherLabel), legacy), true);
    }
  }
  assert.equal(makerFacetMatches('auguste-rodin', 'antonio-canova'), false);
});

test('uncertain attribution, later execution, collaboration and conservation credits stay separate', () => {
  const separate = [
    ['Auguste Rodin (source attribution)', 'auguste-rodin'],
    ['After Michelangelo', 'michelangelo'],
    ['After Michelangelo Buonarroti', 'michelangelo'],
    ['Michelangelo Buonarroti; plaster cast after the original', 'michelangelo'],
    ['Unknown individual cast maker, after a Renaissance marble formerly attributed to Michelangelo Buonarroti', 'michelangelo'],
    ['After Antonio Canova', 'antonio-canova'],
    ['Unknown cast maker, after Antonio Canova', 'antonio-canova'],
    ['Unknown Roman sculptor; restored by Antonio Canova', 'antonio-canova'],
    ['After Bertel Thorvaldsen', 'bertel-thorvaldsen'],
    ['Bertel Thorvaldsen (composition); Georg Christian Freund (assistant on posthumous marble)', 'bertel-thorvaldsen'],
    ['Bertel Thorvaldsen (composition); marble execution maker unconfirmed', 'bertel-thorvaldsen'],
    ['Bertel Thorvaldsen (composition); unidentified assistant (posthumous marble)', 'bertel-thorvaldsen'],
    ['Bertel Thorvaldsen, with Johann Scholl', 'bertel-thorvaldsen'],
    ['Bertel Thorvaldsen; carved by Lukas Ahorn', 'bertel-thorvaldsen'],
    ['Georg Christian Freund, after Bertel Thorvaldsen', 'bertel-thorvaldsen'],
    ['Possibly David Ivanovitch Jensen, after Bertel Thorvaldsen', 'bertel-thorvaldsen'],
  ];
  for (const [label, canonical] of separate) {
    assert.ok(labels.has(label), `Qualifier fixture remains a public credit: ${label}`);
    const token = facetValue(label);
    assert.deepEqual(groupMakerFacet(token, label), { value: token, label });
    assert.equal(makerFacetMatches(token, canonical), false, label);
    assert.equal(makerFacetMatches(canonical, token), false, label);
    assert.equal(makerFacetMatches(token, token), true);
  }
  for (const label of ['Workshop of Auguste Rodin', 'Attributed to Antonio Canova', 'Follower of Michelangelo', 'Imitation of Bertel Thorvaldsen']) {
    const token = facetValue(label);
    assert.deepEqual(groupMakerFacet(token, label), { value: token, label });
  }
});

test('unknown makers remain exact, blank selection means all, and grouping never edits credits', () => {
  const credit = Object.freeze({ value: 'unknown-maker-17', label: 'Unknown maker; conservation by A. Example' });
  assert.deepEqual(groupMakerFacet(credit.value, credit.label), credit);
  assert.equal(makerFacetMatches(credit.value, credit.value), true);
  assert.equal(makerFacetMatches(credit.value, 'unknown-maker'), false);
  assert.equal(makerFacetMatches(credit.value, ''), true);
  assert.equal(makerFacetMatches('Auguste-Rodin', 'auguste-rodin'), false, 'No fuzzy case folding of caller tokens');
  const result = groupMakerFacet('auguste-rodin-1840-1917', 'Auguste Rodin (1840–1917)');
  result.label = 'changed';
  assert.equal(groupMakerFacet('auguste-rodin', 'Auguste Rodin').label, 'Auguste Rodin', 'Returned facets do not mutate the reviewed registry');
});
