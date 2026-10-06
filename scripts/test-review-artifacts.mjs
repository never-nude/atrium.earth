import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { artifactPathFor, parseSlugList, validateArtifacts } from './validate-review-artifacts.mjs';

assert.deepEqual(parseSlugList('europe/a\nvenus-de-milo\nafrica/b\n'), ['europe/a', 'venus-de-milo', 'africa/b']);
assert.throws(() => parseSlugList('europe/a\neurope/a\n'), /Duplicate slug/);
assert.throws(() => parseSlugList('../bad\n'), /Invalid slug/);
assert.throws(() => parseSlugList('\n'), /empty/);
assert.deepEqual(parseSlugList('\n', { allowEmpty: true }), []);
assert.equal(artifactPathFor('orientation', 'europe/a'), 'europe__a.webp');
assert.equal(artifactPathFor('thumbnail', 'europe/a'), 'europe/a/thumb.webp');

const temp = await mkdtemp(path.join(os.tmpdir(), 'atrium-review-artifacts-'));
try {
  const slugs = ['europe/a', 'venus-de-milo', 'africa/b'];
  const sheets = path.join(temp, 'sheets');
  await mkdir(sheets, { recursive: true });
  for (const slug of slugs) await writeFile(path.join(sheets, artifactPathFor('orientation', slug)), 'sheet');
  assert.equal((await validateArtifacts({ slugs, root: sheets, kind: 'orientation' })).length, 3);
  await writeFile(path.join(sheets, 'extra.webp'), 'extra');
  await assert.rejects(validateArtifacts({ slugs, root: sheets, kind: 'orientation' }), /Unexpected/);

  const thumbs = path.join(temp, 'thumbs');
  for (const slug of slugs) {
    const file = path.join(thumbs, artifactPathFor('thumbnail', slug));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, 'thumb');
  }
  assert.equal((await validateArtifacts({ slugs, root: thumbs, kind: 'thumbnail' })).length, 3);
  await writeFile(path.join(thumbs, artifactPathFor('thumbnail', slugs[0])), '');
  await assert.rejects(validateArtifacts({ slugs, root: thumbs, kind: 'thumbnail' }), /Empty/);
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log('Review artifact validation: slug syntax, uniqueness, exact paths and non-empty outputs passed.');
