// Check the complete post-pruning package before GitHub accepts an upload.
// Model sources stay in Git; verified CDN copies are excluded by the build.
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pagesAssets from '../src/data/pages-cdn-assets.json' with { type: 'json' };
import { matchesPagesAsset } from '../src/lib/pages-asset-digest.mjs';

const root = path.resolve('dist');
const limit = 500_000_000;
const firstPartyHosts = new Set(['atrium.earth', 'www.atrium.earth']);
const inventoryReference = /(?:^|[\s"'\x60(<\[{=,:])((?:(?:https?:)?\/\/[^/\s"'<>]+\/|\/|(?:\.\.?\/)*)?(?:models\/(?:previews|first-views)\/[a-z0-9_%./-]+\.glb|previews\/renders\/[a-z0-9_%./-]+\/thumb\.jpg))(?=$|[\s"'\x60<>?#,):}\]])/gi;
const documents = [];
const retainedJpegs = new Set();
let bytes = 0;
let files = 0;
async function visit(directory) {
  for (const name of await readdir(directory)) {
    const file = path.join(directory, name);
    const stat = await lstat(file);
    const relative = path.relative(root, file);
    if (stat.isSymbolicLink()) throw new Error(`Pages package contains a symbolic link: ${relative}`);
    if (stat.isDirectory()) await visit(file);
    else if (stat.isFile()) {
      bytes += stat.size;
      files += 1;
      const pathname = `/${relative.split(path.sep).join('/')}`;
      if (Object.hasOwn(pagesAssets, pathname)) {
        if (!pathname.endsWith('/thumb.jpg') || matchesPagesAsset(await readFile(file), pagesAssets[pathname])) {
          throw new Error(`Verified copy still present in Pages package: ${pathname}`);
        }
        retainedJpegs.add(pathname);
      }
      if (/\.(?:html?|css|m?js|json|svg|txt|xml|webmanifest)$/i.test(name) || name === '_redirects') {
        documents.push({ file, pathname });
      }
    }
    else throw new Error(`Unsupported Pages package entry: ${path.relative(root, file)}`);
  }
}
await visit(root);
console.log(`Pages package: ${files} files, ${bytes.toLocaleString('en')} bytes; limit ${limit.toLocaleString('en')} bytes.`);
if (bytes > limit) throw new Error('Pages package exceeds the published-site budget. Transfer verified serving copies to the sculpture CDN before deploying.');

const removed = Object.entries(pagesAssets).filter(([pathname]) => !retainedJpegs.has(pathname));
const removedPaths = new Set(removed.map(([pathname]) => pathname));
const removedBytes = removed.reduce((total, [, asset]) => total + asset.bytes, 0);
console.log(`Verified ${removedPaths.size.toLocaleString('en')} inventory copies absent from Pages (${removedBytes.toLocaleString('en')} bytes); retained ${retainedJpegs.size.toLocaleString('en')} changed JPEGs.`);
for (const { file, pathname } of documents) {
  const markup = (await readFile(file, 'utf8')).replaceAll('\\/', '/');
  for (const [, reference] of markup.matchAll(inventoryReference)) {
    const url = new URL(reference, `https://atrium.earth${pathname}`);
    if (firstPartyHosts.has(url.hostname) && removedPaths.has(decodeURIComponent(url.pathname))) {
      throw new Error(`Built document ${pathname} refers to removed Pages asset ${url.pathname}`);
    }
  }
}
console.log(`Verified ${documents.length.toLocaleString('en')} built documents do not reference any removed Pages asset.`);
await mkdir('test-results', { recursive: true });
await writeFile('test-results/pages-removal.json', JSON.stringify({
  files,
  bytes,
  limit,
  documents: documents.length,
  removedBytes,
  removedPaths: [...removedPaths],
  retainedJpegs: [...retainedJpegs],
}, null, 2) + '\n');
