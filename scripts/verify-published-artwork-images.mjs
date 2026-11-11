// Verify the image URLs visitors and social previews will receive from the
// finished Pages package, after copying, JPEG generation and pruning.
import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const site = 'https://atrium.earth';
const firstPartyHosts = new Set(['atrium.earth', 'www.atrium.earth']);
const assetDirectories = new Set(['previews', 'models', 'vendor', '_astro']);
const referencePattern = /(?:^|[\s"'(=,])((?:(?:https?:)?\/\/[^/\s"'<>]+)?\/previews\/renders\/[^\s"'<>?#]+?\/thumb\.(?:webp|jpg))(?=$|[\s"'<>?,#)])/g;
const thumbnailPath = /^\/previews\/renders\/(?:[a-z0-9_-]+\/)+thumb\.(?:webp|jpg)$/i;
const maxReportedFailures = 20;

async function* documents(root, directory = root) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (directory !== root || !assetDirectories.has(entry.name)) yield* documents(root, filename);
    } else if (entry.isFile() && /\.(?:html|json)$/i.test(entry.name)) {
      yield filename;
    }
  }
}

function completeWebp(bytes) {
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF'
    || bytes.toString('ascii', 8, 12) !== 'WEBP'
    || bytes.readUInt32LE(4) + 8 !== bytes.length
    || !['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))) return false;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = bytes.readUInt32LE(offset + 4);
    offset += 8 + size + (size % 2);
  }
  return offset === bytes.length;
}

function completeJpeg(bytes) {
  return bytes.length > 5 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}

async function verify(directory) {
  const root = await realpath(path.resolve(directory));
  const references = new Set();
  const failures = [];
  let failureCount = 0;
  let documentCount = 0;
  function report(message) {
    failureCount += 1;
    if (failures.length < maxReportedFailures) failures.push(message);
  }

  for await (const filename of documents(root)) {
    documentCount += 1;
    const document = await readFile(filename, 'utf8');
    for (const [, reference] of document.matchAll(referencePattern)) {
      try {
        const url = new URL(reference, site);
        if (!firstPartyHosts.has(url.hostname) || url.port || url.username || url.password) continue;
        const pathname = decodeURIComponent(url.pathname);
        if (!thumbnailPath.test(pathname)) throw new Error('Unexpected thumbnail path');
        references.add(pathname);
      } catch {
        report(`Invalid artwork image URL in ${path.relative(root, filename)}: ${reference.slice(0, 180)}`);
      }
    }
  }
  if (!references.size) report('No first-party artwork thumbnail references found in the built HTML or JSON.');

  const expectedFiles = new Set();
  for (const reference of references) {
    expectedFiles.add(reference);
    expectedFiles.add(reference.replace(/\.(?:webp|jpg)$/i, reference.endsWith('.webp') ? '.jpg' : '.webp'));
  }
  for (const pathname of expectedFiles) {
    const filename = path.resolve(root, `.${pathname}`);
    try {
      if (await realpath(filename) !== filename) throw new Error('unexpected symlink or path alias');
      const bytes = await readFile(filename);
      const valid = pathname.endsWith('.webp') ? completeWebp(bytes) : completeJpeg(bytes);
      if (!valid) report(`${pathname}: incomplete or incorrect image format`);
    } catch (error) {
      report(`${pathname}: ${error.code === 'ENOENT' ? 'missing from package' : error.code || error.message}`);
    }
  }

  if (failureCount) {
    console.error(`Published artwork image check failed (${failureCount} ${failureCount === 1 ? 'problem' : 'problems'}).`);
    for (const message of failures) console.error(`  ${message}`);
    if (failureCount > failures.length) console.error(`  … ${failureCount - failures.length} more`);
    process.exitCode = 1;
    return;
  }
  console.log(`Verified ${expectedFiles.size.toLocaleString('en')} WebP and JPEG files for ${references.size.toLocaleString('en')} unique artwork image paths in ${documentCount.toLocaleString('en')} built HTML and JSON files.`);
}

try {
  await verify(process.argv[2] || 'dist');
} catch (error) {
  console.error(`Published artwork image check could not read the package: ${error.message}`);
  process.exitCode = 1;
}
