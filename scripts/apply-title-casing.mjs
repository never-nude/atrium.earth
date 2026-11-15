import assert from 'node:assert/strict';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceFiles = {
  catalog: 'src/data/catalog.json',
  corrections: 'src/data/identity-corrections.json',
  dimensions: 'src/data/physical-dimensions.json',
  plan: 'docs/step-2b-title-casing.json',
};
const hash = value => createHash('sha256').update(value).digest('hex');
const caseOnly = (before, after) => typeof before === 'string' && typeof after === 'string'
  && before !== after && before.length === after.length && before.toLowerCase() === after.toLowerCase();
const pointerValue = (object, pointer) => pointer.split('/').slice(1)
  .reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], object);

/** Apply the reviewed allowlist in memory. No general title-casing heuristic runs. */
export function planTitleCasing({ catalog, corrections, dimensions, plan, reverse = false }) {
  assert(Array.isArray(catalog), 'Expected a catalog array');
  assert.equal(plan.version, 1, 'Unsupported title plan');
  assert(Array.isArray(plan.rows) && plan.rows.length, 'Empty title plan');
  const seen = new Set();
  const changes = [];
  const output = structuredClone(catalog);
  for (const row of plan.rows) {
    assert(typeof row.slug === 'string' && row.slug && !seen.has(row.slug), `Duplicate or missing plan slug: ${row.slug}`);
    seen.add(row.slug);
    assert(caseOnly(row.before, row.after), `Not a casing-only edit: ${row.slug}`);
    const matching = output.filter(work => work.slug === row.slug);
    assert.equal(matching.length, 1, `Missing or duplicate catalog slug: ${row.slug}`);
    const work = matching[0];
    assert.equal(Boolean(work.hidden), row.hidden, `Visibility changed: ${row.slug}`);
    const correction = corrections[row.slug];
    assert(!correction || (!Object.hasOwn(correction, 'title') && !Object.hasOwn(correction.catalog ?? {}, 'title')),
      `A correction controls this title; re-review its field: ${row.slug}`);
    if (row.preservedSourceTitle) {
      const source = row.preservedSourceTitle;
      assert.equal(source.evidenceFile, sourceFiles.dimensions, 'Unexpected source-title evidence file');
      assert.equal(pointerValue(dimensions, source.evidencePointer), source.title, `Source title changed: ${row.slug}`);
    }
    const [before, after] = reverse ? [row.after, row.before] : [row.before, row.after];
    if (work.title === after) continue; // Already applied/reverted: an explicit no-op.
    assert.equal(work.title, before, `Title changed since approval: ${row.slug}`);
    work.title = after;
    changes.push({ slug: row.slug, before, after });
  }
  return { catalog: output, changes };
}

export async function runTitleCasing(args = process.argv.slice(2)) {
  assert(args.every(arg => ['--apply', '--revert'].includes(arg)), 'Usage: node scripts/apply-title-casing.mjs [--revert] [--apply]');
  const apply = args.includes('--apply');
  const reverse = args.includes('--revert');
  const snapshots = Object.fromEntries(await Promise.all(Object.entries(sourceFiles).map(async ([key, file]) => [key, await readFile(resolve(root, file), 'utf8')])));
  const input = Object.fromEntries(Object.entries(snapshots).map(([key, value]) => [key, JSON.parse(value)]));
  const result = planTitleCasing({ ...input, reverse });
  for (const change of result.changes) console.log(`${change.slug}: ${change.before} → ${change.after}`);
  const output = `${JSON.stringify(result.catalog, null, 2)}\n`;
  if (apply && result.changes.length) {
    // Reject concurrent edits to the catalogue, overrides, evidence or approval.
    for (const [key, file] of Object.entries(sourceFiles)) {
      assert.equal(await readFile(resolve(root, file), 'utf8'), snapshots[key], `Input changed during migration: ${file}`);
    }
    const target = resolve(root, sourceFiles.catalog);
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, output, { flag: 'wx' });
      assert.equal(await readFile(target, 'utf8'), snapshots.catalog, 'Catalog changed before replacement');
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', direction: reverse ? 'revert' : 'forward', changedTitles: result.changes.length,
    beforeSha256: hash(snapshots.catalog), afterSha256: hash(result.changes.length ? output : snapshots.catalog) }));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runTitleCasing();
}
