import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import pagesAssets from '../src/data/pages-cdn-assets.json' with { type: 'json' };

const origin = 'https://atrium.earth';
const cdn = 'https://models.atrium.earth';
const firebird = '/previews/renders/modern/saint-phalle-firebird-stravinsky/thumb.webp';
const playDoh = '/previews/renders/americas-oceania/jeff-koons-play-doh/thumb.webp';
const images = { firebird, playDoh };
const jpegMap = Object.fromEntries(Object.values(images).map(path => {
  const source = pagesAssets[path.replace('.webp', '.jpg')];
  return [path.slice('/previews/renders/'.length, -'/thumb.webp'.length), source.sha256.slice(0, 12)];
}));

class Image {
  constructor(src, { complete = false, width = 0, alt = '' } = {}) {
    this.src = src;
    this.complete = complete;
    this.naturalWidth = width;
    this.alt = alt;
    this.srcset = src;
  }

  removeAttribute(attribute) {
    delete this[attribute];
  }
}

const eagerFailure = new Image(firebird, { complete: true, alt: 'The Firebird' });
const healthy = new Image(playDoh, { complete: true, width: 720 });
const lazy = new Image(`/review${playDoh}?v=2`, { alt: 'Play-Doh' });
let onError;
const requests = [];
const document = {
  baseURI: `${origin}/`,
  currentScript: { dataset: { jpegMap: '/review/previews/cdn-jpegs.json' } },
  images: [eagerFailure, healthy, lazy],
  addEventListener(type, listener, capture) {
    assert.equal(type, 'error');
    assert.equal(capture, true);
    onError = listener;
  },
};

runInNewContext(readFileSync(new URL('../public/artwork-image-recovery.js', import.meta.url), 'utf8'), {
  HTMLImageElement: Image, document, location: { origin }, URL,
  fetch: async (path) => {
    requests.push(path);
    return { ok: true, json: async () => jpegMap };
  },
});

await new Promise(setImmediate);
assert.equal(eagerFailure.src, `${cdn}/${pagesAssets[firebird.replace('.webp', '.jpg')].key}`);
assert.equal(eagerFailure.alt, 'The Firebird');
assert.equal(healthy.src, playDoh);
assert.equal(lazy.src, `/review${playDoh}?v=2`);

await onError({ target: lazy });
assert.equal(lazy.src, `${cdn}/${pagesAssets[playDoh.replace('.webp', '.jpg')].key}`);
assert.deepEqual(requests, ['/review/previews/cdn-jpegs.json']);
await onError({ target: lazy });
assert.equal(lazy.src, `${origin}/review${playDoh.replace('.webp', '.jpg')}?v=2&artwork-recovery=1`);
assert.equal(lazy.srcset, undefined);
await onError({ target: lazy });
assert.match(lazy.src, /^data:image\/svg\+xml,/);
assert.match(decodeURIComponent(lazy.src), /Image temporarily unavailable/);
assert.equal(lazy.alt, 'Image temporarily unavailable. Play-Doh');
const finalSource = lazy.src;
await onError({ target: lazy });
assert.equal(lazy.src, finalSource);

const unmigrated = new Image('/review/previews/renders/future-work/thumb.webp');
await onError({ target: unmigrated });
assert.equal(unmigrated.src, `${origin}/review/previews/renders/future-work/thumb.jpg?artwork-recovery=1`);

for (const src of [`https://other.example${firebird}`, '/favicon.svg', '/images/other.webp']) {
  const image = new Image(src);
  await onError({ target: image });
  assert.equal(image.src, src);
}
await onError({ target: { src: firebird } });
assert.deepEqual(requests, ['/review/previews/cdn-jpegs.json']);
console.log('Artwork recovery passed for eager and lazy failures, verified CDN JPEGs, retained local siblings, terminal fallback and unrelated resources.');
