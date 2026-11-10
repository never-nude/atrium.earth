import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const origin = 'https://atrium.earth';
const firebird = '/previews/renders/modern/saint-phalle-firebird-stravinsky/thumb.webp';
const playDoh = '/previews/renders/americas-oceania/jeff-koons-play-doh/thumb.webp';

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
const document = {
  baseURI: `${origin}/`,
  images: [eagerFailure, healthy, lazy],
  addEventListener(type, listener, capture) {
    assert.equal(type, 'error');
    assert.equal(capture, true);
    onError = listener;
  },
};

runInNewContext(readFileSync(new URL('../public/artwork-image-recovery.js', import.meta.url), 'utf8'), {
  HTMLImageElement: Image, document, location: { origin }, URL,
});

assert.equal(eagerFailure.src, `${origin}${firebird.replace('.webp', '.jpg')}?artwork-recovery=1`);
assert.equal(eagerFailure.alt, 'The Firebird');
assert.equal(healthy.src, playDoh);
assert.equal(lazy.src, `/review${playDoh}?v=2`);

onError({ target: lazy });
assert.equal(lazy.src, `${origin}/review${playDoh.replace('.webp', '.jpg')}?v=2&artwork-recovery=1`);
assert.equal(lazy.srcset, undefined);
onError({ target: lazy });
assert.match(lazy.src, /^data:image\/svg\+xml,/);
assert.match(decodeURIComponent(lazy.src), /Image temporarily unavailable/);
assert.equal(lazy.alt, 'Image temporarily unavailable. Play-Doh');
const finalSource = lazy.src;
onError({ target: lazy });
assert.equal(lazy.src, finalSource);

for (const src of [`https://other.example${firebird}`, '/favicon.svg', '/images/other.webp']) {
  const image = new Image(src);
  onError({ target: image });
  assert.equal(image.src, src);
}
onError({ target: { src: firebird } });
console.log('Artwork recovery passed for eager and lazy failures, sibling JPEG, terminal fallback and unrelated resources.');
