// Verify JPEGs used by published metadata or the browser's recovery map.
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pagesAssets from '../src/data/pages-cdn-assets.json' with { type: 'json' };
import { cdn, checkDeliveries, readCdnAsset, scanBuiltCdnReferences, writeDeliveryReport } from './lib/cdn-delivery.mjs';

const reportFile = 'test-results/published-jpeg-delivery.json';
const recoveryFile = 'previews/cdn-jpegs.json';
const jpegAssets = new Map(Object.entries(pagesAssets)
  .filter(([pathname]) => pathname.endsWith('/thumb.jpg'))
  .map(([, asset]) => [`${cdn}/${asset.key}`, asset.bytes]));

export async function verifyPublishedJpeg(url, bytes, request) {
  const { body, delivery } = await readCdnAsset(url, { bytes, mime: 'image/jpeg' }, request);
  if (body[0] !== 0xff || body[1] !== 0xd8 || body[2] !== 0xff) throw new Error('Invalid JPEG start marker');
  return delivery;
}

export async function verifyJpegDelivery(directory = 'dist') {
  await rm(reportFile, { force: true });
  const { jpegs, documentCount, unresolved } = await scanBuiltCdnReferences(directory);
  const recovery = JSON.parse(await readFile(path.join(directory, recoveryFile), 'utf8'));
  if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) throw new Error('Invalid build JPEG recovery map');
  for (const [slug, hash] of Object.entries(recovery)) {
    if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/.test(slug) || typeof hash !== 'string' || !/^[a-f0-9]{12}$/.test(hash)) {
      throw new Error(`Invalid recovery JPEG entry: ${slug}`);
    }
    const url = `${cdn}/previews/renders/${slug}/thumb-${hash}.jpg`;
    if (!jpegs.has(url)) jpegs.set(url, recoveryFile);
  }
  const assets = [...jpegs].map(([url, document]) => ({ url, document, bytes: jpegAssets.get(url) }));
  if (!assets.length) throw new Error('No CDN JPEG addresses were found in the built package');

  const results = await checkDeliveries(assets, ({ url, bytes }) => verifyPublishedJpeg(url, bytes));
  const failures = results.filter(result => result.error);
  const summary = {
    jpegs: assets.length, documentCount, recoveryEntries: Object.keys(recovery).length,
    passed: assets.length - failures.length, failed: failures.length,
  };
  await writeDeliveryReport(reportFile, summary, results, unresolved);
  console.log(`JPEG CDN first-attempt delivery: ${summary.passed}/${summary.jpegs} passed across ${documentCount} build documents and ${summary.recoveryEntries} recovery entries.`);
  if (failures.length) {
    for (const { url, document, error } of failures) console.error(`${url} (${document}): ${error}`);
    throw new Error(`${failures.length} JPEG CDN checks failed. See ${reportFile}.`);
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  verifyJpegDelivery(process.argv[2]).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
