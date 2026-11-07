// The static gallery is built separately from Astro. Its embedded serving URLs
// must stay aligned when a byte-identical preview moves to the model CDN.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const museum = path.join(root, 'public/spatial-museum');
const manifest = JSON.parse(readFileSync(path.join(museum, 'collection-manifest.json'), 'utf8'));
const previews = JSON.parse(readFileSync(path.join(root, 'src/data/previews.json'), 'utf8'));
const html = readFileSync(path.join(museum, 'index.html'), 'utf8');
const entry = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]);
assert.equal(entry.length, 1, 'The static museum must have exactly one runtime entry');
const entryUrl = new URL(entry[0], 'https://atrium.earth');
assert.equal(entryUrl.origin, 'https://atrium.earth', 'The museum runtime must be local');
assert.match(entryUrl.pathname, /^\/spatial-museum\/assets\/[a-zA-Z0-9_-]+\.js$/, 'Unexpected runtime entry path');
const runtimeBody = readFileSync(path.join(root, 'public', entryUrl.pathname));
const runtime = runtimeBody.toString('utf8');
if (entryUrl.searchParams.has('models')) {
  assert.equal(entryUrl.searchParams.get('models'), createHash('sha256').update(runtimeBody).digest('hex').slice(0, 12), 'Museum model-binding cache version is stale');
}

function embeddedWorks(source) {
  const records = [];
  for (const match of source.matchAll(/"works"\s*:\s*\[/g)) {
    const start = match.index + match[0].lastIndexOf('[');
    let depth = 0, quoted = false, escaped = false, end = -1;
    for (let index = start; index < source.length; index++) {
      const character = source[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === '[') depth++;
      else if (character === ']' && --depth === 0) { end = index + 1; break; }
    }
    assert.ok(end > start, 'An embedded gallery work array is incomplete');
    const works = JSON.parse(source.slice(start, end));
    assert.ok(works.every(work => typeof work.slug === 'string' && typeof work.modelUrl === 'string'), 'Unexpected embedded gallery work records');
    records.push(...works);
  }
  assert.ok(records.length > 0, 'No embedded gallery model bindings found');
  return records;
}

function verifyBindings(records, data, previewMap) {
  assert.ok(Array.isArray(data.rooms) && data.rooms.length > 0, 'Museum rooms are missing');
  const slugs = data.rooms.flatMap(room => {
    assert.equal(room.slugs.length, room.count, `Room count differs: ${room.id}`);
    return room.slugs;
  });
  assert.equal(slugs.length, data.works, 'Museum manifest work count differs');
  assert.equal(new Set(slugs).size, slugs.length, 'Museum manifest has duplicate work slugs');
  assert.equal(records.length, data.works, 'Embedded gallery model count differs');
  assert.equal(new Set(records.map(work => work.slug)).size, records.length, 'Embedded gallery has duplicate model bindings');
  assert.deepEqual(records.map(work => work.slug).sort(), [...slugs].sort(), 'Manifest and embedded gallery membership differ');
  for (const work of records) {
    const preview = previewMap[work.slug];
    assert.ok(preview && typeof preview.url === 'string', `Missing current preview: ${work.slug}`);
    const expected = new URL(preview.url, 'https://atrium.earth').href;
    assert.equal(work.modelUrl, expected, `Static gallery preview URL drift: ${work.slug}`);
    assert.equal(work.bytes, preview.bytes, `Static gallery preview byte drift: ${work.slug}`);
  }
}

function verifyEveryModelUrl(source, records, previewMap) {
  // Composition/source-label records duplicate the room model bindings. Check
  // every compiled URL copy so an alternate gallery path cannot retain drift.
  const allowed = new Set(records.map(work => new URL(previewMap[work.slug].url, 'https://atrium.earth').href));
  const urls = [...source.matchAll(/"modelUrl"\s*:\s*("(?:[^"\\]|\\.)*")/g)].map(match => JSON.parse(match[1]));
  assert.ok(urls.length >= records.length, 'Compiled composition model URLs are missing');
  for (const url of urls) assert.ok(allowed.has(url), `Compiled gallery model URL drift: ${url}`);
  return urls.length;
}

const works = embeddedWorks(runtime);
verifyBindings(works, manifest, previews);
const urlCopies = verifyEveryModelUrl(runtime, works, previews);

// Ensure the gate detects the actual migration regression and related drift,
// rather than merely finding some model-like strings in the generated bundle.
const stale = structuredClone(works);
stale[0].modelUrl = 'https://atrium.earth/models/previews/retired/preview.glb';
assert.throws(() => verifyBindings(stale, manifest, previews), /preview URL drift/);
const changedBytes = structuredClone(works);
changedBytes[0].bytes++;
assert.throws(() => verifyBindings(changedBytes, manifest, previews), /preview byte drift/);
assert.throws(() => verifyBindings(works.slice(1), manifest, previews), /model count differs/);
const duplicated = [...works.slice(1), works[1]];
assert.throws(() => verifyBindings(duplicated, manifest, previews), /duplicate model bindings/);
assert.throws(() => embeddedWorks('const missing = [];'), /No embedded gallery model bindings/);
const firstUrl = JSON.stringify(works[0].modelUrl);
const staleComposition = runtime.replace(`"modelUrl":${firstUrl}`, '"modelUrl":"https://atrium.earth/models/previews/retired/preview.glb"');
assert.notEqual(staleComposition, runtime, 'Stale compiled URL fixture was not applied');
assert.throws(() => verifyEveryModelUrl(staleComposition, works, previews), /Compiled gallery model URL drift/);

console.log(`Static museum bindings passed: all ${works.length} gallery works and ${urlCopies} compiled URL copies match current previews and room membership; URL/byte/cache drift regressions are rejected.`);
