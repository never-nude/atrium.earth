import assert from 'node:assert/strict';
import { shortWorkTitle } from '../src/lib/work-titles.ts';

const cases = [
  ['Apollo Belvedere (SMK Plaster Cast, KAS353)', 'Apollo Belvedere'],
  ['Apollo (cast (restored arm)) Belvedere', 'Apollo Belvedere'],
  ['  Kero\u00a0 (beaker)   ', 'Kero'],
  ['Base for a Water Pipe (Huqqa) with Poetry and Flowers', 'Base for a Water Pipe with Poetry and Flowers'],
  ['Venus (cast) (reduced copy)', 'Venus'],
  ['Venus — (plaster cast)', 'Venus'],
  ['Venus / (plaster cast)', 'Venus'],
  ['Venus(cast)and Cupid', 'Venus and Cupid'],
  ['(Sleeping Child)', 'Sleeping Child'],
  ['(Sleeping Child (study))', 'Sleeping Child'],
  ['() ( )', 'Untitled work'],
  ['', 'Untitled work'],
  ['Venus (unfinished qualifier', 'Venus (unfinished qualifier'],
  ['Venus (cast) (unfinished qualifier', 'Venus (unfinished qualifier'],
  ['Laocoön and His Sons', 'Laocoön and His Sons'],
  ['Untitled (Woman and Child)', 'Untitled'],
];

for (const [source, expected] of cases) {
  assert.equal(shortWorkTitle(source), expected, source);
}

const record = Object.freeze({ title: 'The Thinker (Copenhagen Cast)' });
assert.equal(shortWorkTitle(record.title), 'The Thinker');
assert.equal(record.title, 'The Thinker (Copenhagen Cast)');
console.log(`Thumbnail title helper passed: ${cases.length} title cases and unchanged source identification.`);
