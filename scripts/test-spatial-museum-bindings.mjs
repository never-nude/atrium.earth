// The static gallery is built separately from Astro. Its embedded serving URLs
// must stay aligned when a byte-identical preview moves to the model CDN.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const museum = path.join(root, 'public/spatial-museum');
const manifest = JSON.parse(readFileSync(path.join(museum, 'collection-manifest.json'), 'utf8'));
const previews = JSON.parse(readFileSync(path.join(root, 'src/data/previews.json'), 'utf8'));
const html = readFileSync(path.join(museum, 'index.html'), 'utf8');
const sources = Object.fromEntries(readdirSync(path.join(museum, 'assets')).filter(file => file.endsWith('.js')).map(file => [file, readFileSync(path.join(museum, 'assets', file), 'utf8')]));

function localModuleReferences(source) {
  return [...source.matchAll(/(["'`])((?:\.\/|assets\/|\/spatial-museum\/assets\/)[a-zA-Z0-9_.-]+\.js)(\?[^"'`\s]*)?\1/g)];
}

function normalizedModule(source) {
  return source.replace(/(["'`])((?:\.\/|assets\/|\/spatial-museum\/assets\/)[a-zA-Z0-9_.-]+\.js)\?gallery=[a-f0-9]{12}\1/g, '$1$2$1');
}

function graphVersion(modules) {
  const hash = createHash('sha256');
  for (const file of Object.keys(modules).sort()) hash.update(file).update('\0').update(normalizedModule(modules[file])).update('\0');
  return hash.digest('hex').slice(0, 12);
}

function verifyRuntimeGraph(modules, entryHtml) {
  const entry = [...entryHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]);
  assert.equal(entry.length, 1, 'The static museum must have exactly one runtime entry');
  const entryUrl = new URL(entry[0], 'https://atrium.earth');
  assert.equal(entryUrl.origin, 'https://atrium.earth', 'The museum runtime must be local');
  assert.match(entryUrl.pathname, /^\/spatial-museum\/assets\/[a-zA-Z0-9_-]+\.js$/, 'Unexpected runtime entry path');
  const version = graphVersion(modules);
  assert.equal(entryUrl.search, `?gallery=${version}`, 'Museum entry graph digest is stale or mixed');
  assert.ok(Object.hasOwn(modules, path.basename(entryUrl.pathname)), 'Museum entry module is missing');
  const referenced = new Set([path.basename(entryUrl.pathname)]);
  let references = 0;
  for (const [file, source] of Object.entries(modules)) {
    for (const [, , specifier, query = ''] of localModuleReferences(source)) {
      const target = path.basename(specifier);
      assert.ok(Object.hasOwn(modules, target), `Referenced local module is missing: ${file} → ${target}`);
      assert.equal(query, `?gallery=${version}`, `Bare or mismatched gallery dependency: ${file} → ${specifier}${query}`);
      referenced.add(target); references++;
    }
  }
  assert.deepEqual([...referenced].sort(), Object.keys(modules).sort(), 'The complete local module graph must be referenced');
  return { entryFile: path.basename(entryUrl.pathname), version, references };
}

const graph = verifyRuntimeGraph(sources, html);
const runtime = sources[graph.entryFile];

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

// The runtime imports helpers from its own entry through Three and the gallery
// engine. Versioning only HTML creates a second module/app instance via bare
// dependency URLs, including a cached app with retired model bindings.
const bareGraph = Object.fromEntries(Object.entries(sources).map(([file, source]) => [file, normalizedModule(source)]));
assert.throws(() => verifyRuntimeGraph(bareGraph, html), /Bare or mismatched gallery dependency/);
const owner = Object.keys(sources).find(file => localModuleReferences(sources[file]).length);
const dependency = localModuleReferences(sources[owner])[0][0];
const bareDependency = { ...sources, [owner]: sources[owner].replace(dependency, normalizedModule(dependency)) };
assert.throws(() => verifyRuntimeGraph(bareDependency, html), /Bare or mismatched gallery dependency/);
const mixedVersion = { ...sources, [owner]: sources[owner].replace(dependency, dependency.replace(graph.version, '0'.repeat(12))) };
assert.throws(() => verifyRuntimeGraph(mixedVersion, html), /Bare or mismatched gallery dependency/);
const changedGraph = { ...sources, [owner]: sources[owner] + '\n' };
assert.throws(() => verifyRuntimeGraph(changedGraph, html), /entry graph digest is stale/);

console.log(`Static museum bindings passed: all ${works.length} works / ${urlCopies} model URL copies; ${Object.keys(sources).length} modules / ${graph.references} dependency/preload references use graph ${graph.version}; model and module-cache drift regressions are rejected.`);
