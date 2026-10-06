#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SLUG_RE = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)?$/;

export function parseSlugList(text, { allowEmpty = false } = {}) {
  const slugs = [];
  const firstLine = new Map();
  for (const [index, raw] of String(text).split(/\r?\n/).entries()) {
    const slug = raw.trim();
    if (!slug) continue;
    if (!SLUG_RE.test(slug)) throw new Error(`Invalid slug on line ${index + 1}: ${JSON.stringify(slug)}`);
    if (firstLine.has(slug)) {
      throw new Error(`Duplicate slug on lines ${firstLine.get(slug)} and ${index + 1}: ${slug}`);
    }
    firstLine.set(slug, index + 1);
    slugs.push(slug);
  }
  if (!allowEmpty && !slugs.length) throw new Error('Slug list is empty.');
  return slugs;
}

export function artifactPathFor(kind, slug) {
  if (kind === 'orientation') return `${slug.replaceAll('/', '__')}.webp`;
  if (kind === 'thumbnail') return `${slug}/thumb.webp`;
  throw new Error(`Unknown artifact kind: ${kind}`);
}

async function listFiles(root, prefix = '') {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(path.join(root, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

export async function validateArtifacts({ slugs, root, kind }) {
  const absoluteRoot = path.resolve(root);
  const expected = slugs.map((slug) => artifactPathFor(kind, slug)).sort();
  let actual;
  try {
    actual = (await listFiles(absoluteRoot)).sort();
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Artifact directory does not exist: ${root}`);
    throw error;
  }
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((file) => !actualSet.has(file));
  const extra = actual.filter((file) => !expectedSet.has(file));
  const empty = [];
  for (const file of expected.filter((candidate) => actualSet.has(candidate))) {
    if (!(await stat(path.join(absoluteRoot, ...file.split('/')))).size) empty.push(file);
  }
  if (missing.length || extra.length || empty.length) {
    throw new Error([
      `Expected exactly ${expected.length} ${kind} artifact(s); found ${actual.length}.`,
      missing.length ? `Missing: ${missing.join(', ')}` : '',
      extra.length ? `Unexpected: ${extra.join(', ')}` : '',
      empty.length ? `Empty: ${empty.join(', ')}` : '',
    ].filter(Boolean).join(' '));
  }
  return actual;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const equals = arg.indexOf('=');
    if (equals !== -1) {
      args[arg.slice(2, equals)] = arg.slice(equals + 1);
      continue;
    }
    const key = arg.slice(2);
    if (key === 'allow-empty') args[key] = true;
    else {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
      args[key] = value;
      index += 1;
    }
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.input) throw new Error('--input is required.');
  const slugs = parseSlugList(await readFile(args.input, 'utf8'), { allowEmpty: Boolean(args['allow-empty']) });
  if (args.normalized) {
    await mkdir(path.dirname(path.resolve(args.normalized)), { recursive: true });
    await writeFile(args.normalized, slugs.length ? `${slugs.join('\n')}\n` : '');
  }
  if (args.root) {
    if (!args.kind) throw new Error('--kind is required with --root.');
    await validateArtifacts({ slugs, root: args.root, kind: args.kind });
  }
  console.log(`Validated ${slugs.length} unique slug(s)${args.root ? ` and ${slugs.length} ${args.kind} artifact(s)` : ''}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
