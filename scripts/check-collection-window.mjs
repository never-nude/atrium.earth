import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { unpackCollectionIndex, COLLECTION_CHUNK_SIZE, COLLECTION_PAGE_SIZE } from '../src/lib/collection-window.mjs';
import { createCollectionCard } from '../src/lib/collection-card.mjs';

// Verify the delivered HTTP or built static package, without a browser/models.
const fromDist = process.argv[2] === '--dist';
const base = new URL(fromDist ? 'https://atrium.earth/' : process.argv[2] || 'http://localhost:4321');
async function read(path) {
  if (fromDist) return readFile(resolve('dist', `.${path}${path.endsWith('/') ? 'index.html' : ''}`), 'utf8');
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, path);
  return response.text();
}
const indexText = await read('/collection/data/index.json');
const revision = JSON.parse(indexText).revision;
assert.match(revision,/^[a-f0-9]{16}$/);
const packedIndex = JSON.parse(indexText);
const records = unpackCollectionIndex(packedIndex);
assert.ok(records.length > COLLECTION_PAGE_SIZE);
assert.equal(new Set(records.map(record => record.slug)).size, records.length);
const byPath = new Map(records.map(record => [`/works/${record.slug}/`, record]));
const allCards = new Set();
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.style = {}; }
  set innerHTML(_) { throw new Error('Unsafe card rendering'); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  append(...children) { this.children.push(...children); }
}
const document = { createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }) };
for (let chunk = 0; chunk < Math.ceil(records.length / COLLECTION_CHUNK_SIZE); chunk += 1) {
  const payload = JSON.parse(await read(`/collection/data/${chunk}.json`));
  assert.equal(payload.version, 1);
  assert.equal(payload.revision, revision, 'Index and every card chunk share one content revision');
  assert.equal(payload.chunk, chunk);
  assert.equal(payload.cards.length, Math.min(COLLECTION_CHUNK_SIZE, records.length - chunk * COLLECTION_CHUNK_SIZE));
  for (const card of payload.cards) {
    const pathname = new URL(card.href, base).pathname;
    const record = byPath.get(pathname);
    assert.ok(record, `Known public identity: ${pathname}`);
    assert.equal(record.chunk, chunk);
    assert.ok(!allCards.has(pathname), `Unique card: ${pathname}`);
    allCards.add(pathname);
    assert.equal(card.caption, record.title);
    assert.equal(card.attributes.search, packedIndex.works[record.index][2]);
    assert.equal(card.attributes.size || '', record.size);
    assert.ok(card.alt.includes(card.title), `Full title retained: ${pathname}`);
    assert.ok(!Object.keys(card).some(key => /model|source|recovery/i.test(key)));
    const rendered = createCollectionCard(document, card, { spatial: true });
    assert.equal(rendered.dataset.studioPeekAvailable, String(card.attributes.studioPeekAvailable));
    assert.equal(rendered.children[0].attributes.href, card.href);
  }
}
assert.equal(allCards.size, records.length);
const checked = [];
for (const mode of ['collection', 'ar-vr']) {
  const count = mode === 'ar-vr' ? records.filter(record => record.size).length : records.length;
  const pages = Math.ceil(count / COLLECTION_PAGE_SIZE);
  for (const page of [1, 2, pages]) {
    const path = page === 1 ? `/${mode}/` : `/${mode}/page/${page}/`;
    const html = await read(path);
    const cards = (html.match(/\bdata-v3-card(?=[\s>])/g) || []).length;
    assert.equal(cards, Math.min(COLLECTION_PAGE_SIZE, count - (page - 1) * COLLECTION_PAGE_SIZE), `${path} bounded SSR`);
    assert.equal(/rel="prev"/.test(html), page > 1, `${path} previous page`);
    assert.equal(/rel="next"/.test(html), page < pages, `${path} next page`);
    assert.match(html, new RegExp(`rel="canonical" href="https://atrium\\.earth/${mode}/"`));
    if (page > 1) {
      assert.equal(/<option\b/.test(html), false, `${path} excludes repeated global facet options`);
      assert.equal(/<[^>]*\sdata-studio-explorer(?=[\s=>])/.test(html), false, `${path} stays a lean progressive page`);
      assert.ok(html.includes(`href="/${mode}/"`), `${path} links to full collection search`);
    }
    checked.push({ path, cards, bytes: Buffer.byteLength(html), tags: (html.match(/<[a-z][a-z0-9-]*(?=[\s>])/gi) || []).length });
  }
}
console.log(JSON.stringify({ publicRecords: records.length, uniqueCards: allCards.size, indexBytes: Buffer.byteLength(indexText), indexGzipBytes: gzipSync(indexText).byteLength, checked }, null, 2));
