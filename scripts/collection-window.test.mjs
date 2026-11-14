import test from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTION_PAGE_SIZE, COLLECTION_CHUNK_SIZE, COLLECTION_INDEX_FIELDS, packCollectionIndex, unpackCollectionIndex, readCollectionState, writeCollectionState, selectCollectionWindow, collectionPagePath, collectionPageNumber } from '../src/lib/collection-window.mjs';
import { createCollectionCard } from '../src/lib/collection-card.mjs';

function record(index, overrides = {}) {
  return { slug: `region/work-${index}`, title: `Work ${index}`, search: `Work ${index} sculpture`, year: 1900 + index, wing: 'europe', era: 'modern', place: 'france', material: 'bronze stone', maker: 'maker', makerLabel: 'Maker', catalogIndex: index, ingested: '2026-01-01', size: 'unknown', ...overrides };
}
function records(values) {
  return unpackCollectionIndex(packCollectionIndex(values)).map(value => ({ ...value, pathname: `/works/${value.slug}/` }));
}
const all = records(Array.from({ length: 3022 }, (_, index) => record(index)));
const state = readCollectionState('');

test('compact metadata exposes all 3,022 unique identities without DOM or model fields', () => {
  assert.equal(all.length, 3022);
  assert.equal(new Set(all.map(record => record.slug)).size, 3022);
  assert.equal(all[120].chunk, 1);
  assert.equal(COLLECTION_CHUNK_SIZE, 120);
  assert.ok(!COLLECTION_INDEX_FIELDS.some(key => /model|glb|source|recovery/i.test(key)));
  assert.throws(() => unpackCollectionIndex(packCollectionIndex([record(1), record(1)])), /repeated/);
  assert.throws(() => unpackCollectionIndex({ ...packCollectionIndex([record(1)]), version: 9 }), /Unsupported/);
});

test('pagination is bounded and reaches every record, including the final 22', () => {
  const first = selectCollectionWindow(all, state);
  assert.equal(first.total, 3022);
  assert.equal(first.records.length, COLLECTION_PAGE_SIZE);
  assert.equal(first.records.at(-1).slug, 'region/work-59');
  assert.equal(first.hasMore, true);
  const more = selectCollectionWindow(all, state, { limit: 120 });
  assert.equal(more.records.length, 120);
  const last = selectCollectionWindow(all, state, { offset: 3000 });
  assert.equal(last.records.length, 22);
  assert.equal(last.hasMore, false);
  const seen = Array.from({ length: 51 }, (_, page) => selectCollectionWindow(all, state, { offset: page * 60 }).records).flat();
  assert.equal(new Set(seen.map(record => record.slug)).size, 3022);
});

test('search reaches past the initial page and combines every term, accents and facets', () => {
  const collection = records([record(1), record(3001, { search: 'Éléphant du Bénin carved ivory', wing: 'africa', era: 'early-modern', place: 'benin', material: 'ivory wood', maker: 'unknown', makerLabel: 'Maker not yet recorded', size: 'verified' })]);
  const selected = selectCollectionWindow(collection, { ...state, q: 'elephant BENIN', wing: 'africa', era: 'early-modern', place: 'benin', material: 'ivory', maker: 'unknown', size: 'verified' });
  assert.equal(selected.records[0].slug, 'region/work-3001');
  assert.equal(selected.total, 1);
  assert.equal(selectCollectionWindow(collection, { ...state, q: 'elephant missing' }).total, 0);
  assert.equal(selectCollectionWindow(collection, { ...state, material: 'ivo' }).total, 0, 'Material facets match complete tokens');
  assert.equal(selectCollectionWindow(collection, { ...state, place: 'beni' }).total, 0, 'Other facets match exact values');
});

test('all sorts are stable, preserve unknown dates and retain numeric title order', () => {
  const collection = records([record(0, { title: 'Work 10', year: '', makerLabel: 'Zed', ingested: '2026-01-03' }), record(1, { title: 'Work 2', year: '-100', makerLabel: 'Alpha', ingested: '2026-01-02' }), record(2, { title: 'Work 2', year: '1500', makerLabel: 'Alpha', ingested: '2026-01-03' })]);
  const slugs = sort => selectCollectionWindow(collection, { ...state, sort }).records.map(record => record.slug);
  assert.deepEqual(slugs('curator'), ['region/work-0', 'region/work-1', 'region/work-2']);
  assert.deepEqual(slugs('title'), ['region/work-1', 'region/work-2', 'region/work-0']);
  assert.deepEqual(slugs('maker'), ['region/work-1', 'region/work-2', 'region/work-0']);
  assert.deepEqual(slugs('date'), ['region/work-1', 'region/work-2', 'region/work-0']);
  assert.deepEqual(slugs('newest'), ['region/work-2', 'region/work-0', 'region/work-1']);
  assert.deepEqual(slugs('unsupported'), slugs('curator'));
});

test('saved-only matches canonical work paths globally and keeps an empty state', () => {
  const saved = new Set(['/works/region/work-2999/']);
  assert.equal(selectCollectionWindow(all, { ...state, saved: true }, { saved }).records[0].slug, 'region/work-2999');
  assert.equal(selectCollectionWindow(all, { ...state, saved: true }).total, 0);
  assert.equal(selectCollectionWindow(all, { ...state, saved: true, q: 'missing' }, { saved }).total, 0);
});

test('URL state round-trips Collection/AR facets and density while preserving unrelated context', () => {
  const selected = { ...state, q: 'war & peace', maker: 'rodin', wing: 'europe', era: 'modern', place: 'france', material: 'bronze', size: 'approximate', sort: 'date', saved: true, density: 'compact' };
  const params = writeCollectionState('?unrelated=keep&q=old&sort=newest', selected);
  assert.deepEqual(readCollectionState(params), selected);
  assert.equal(params.get('unrelated'), 'keep');
  assert.equal(params.getAll('q').length, 1);
  const cleared = writeCollectionState(params, state);
  assert.equal(cleared.toString(), 'unrelated=keep');
  assert.equal(readCollectionState('?sort=not-a-sort&density=huge&saved=yes').sort, 'curator');
  assert.equal(readCollectionState('?density=huge&saved=yes').density, 'grid');
  assert.equal(readCollectionState('?saved=yes').saved, false);
});

test('progressive page URLs stay local and distinguish collection and AR routes', () => {
  assert.equal(collectionPagePath('/collection/', 1), '/collection/');
  assert.equal(collectionPagePath('/collection/', 2), '/collection/page/2/');
  assert.equal(collectionPagePath('/ar-vr/', 51), '/ar-vr/page/51/');
  assert.equal(collectionPageNumber('/museum/collection/page/2/'), 2);
  assert.equal(collectionPageNumber('/ar-vr/page/51/'), 51);
  assert.equal(collectionPageNumber('/collection/'), 1);
});

// A deliberately small DOM double throws if card rendering ever uses innerHTML.
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.style = {}; }
  set innerHTML(_) { throw new Error('HTML interpolation is forbidden'); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  append(...children) { this.children.push(...children); }
}
const document = { createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }) };
const card = { id: 'safe-id', href: '/works/region/work-1/', title: 'Formal title (cast)', caption: 'Formal title', detail: 'Maker · c. 1500', alt: 'Formal title (cast) — Maker · c. 1500', thumbnail: '/previews/renders/work/thumb.jpg', spatialLabel: 'Dimensions unknown', attributes: { search: 'formal title cast maker', year: '1500', wing: 'europe', maker: 'maker', size: 'unknown', studioPeekAvailable: 'true', studioPreviewBytes: 8000, studioIndex: 1 } };

test('dynamic cards preserve short captions, full identification, JPEGs, attributes and AR links', () => {
  const element = createCollectionCard(document, card, { spatial: true });
  assert.equal(element.className, 'v3-card');
  assert.equal(element.dataset.studioPeekAvailable, 'true');
  assert.equal(element.dataset.studioPreviewBytes, '8000');
  const [link, spatial] = element.children;
  assert.equal(link.attributes.href, '/works/region/work-1/');
  assert.equal(link.children[0].children[0].attributes.src, card.thumbnail);
  assert.equal(link.children[0].children[0].alt, card.alt);
  assert.equal(link.children[1].children[0].textContent, 'Formal title');
  assert.equal(link.children[1].children[1].textContent, card.detail);
  assert.equal(spatial.attributes.href, '/works/region/work-1/#ar-vr');
  assert.match(spatial.attributes['aria-label'], /Formal title \(cast\).*Dimensions unknown/);
});

test('fetched text cannot inject HTML and executable or cross-origin URLs are rejected', () => {
  const attack = '<img src=x onerror=alert(1)>';
  const element = createCollectionCard(document, { ...card, title: attack, caption: attack, detail: attack, alt: attack, id: attack });
  assert.equal(element.children[0].children[1].children[0].textContent, attack);
  assert.equal(element.children[0].children[0].children[0].alt, attack);
  assert.equal(element.children[0].children[0].style.viewTransitionName, undefined);
  for (const href of ['javascript:alert(1)', '//evil.example/works/a/', 'https://evil.example/works/a/', '/works/a/\n', '/works/a/../b/']) assert.throws(() => createCollectionCard(document, { ...card, href }), /Invalid collection card/);
  for (const thumbnail of ['javascript:alert(1)', '//evil.example/a.jpg', '/\\evil.example/a.jpg']) assert.throws(() => createCollectionCard(document, { ...card, thumbnail }), /Invalid collection card/);
});
