// Source-only batching around the unchanged, three-model acquisition helper.
// No model transforms, catalogue writes, R2 uploads or credential-bearing logs.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const DEFAULT_BUDGET = 1_500_000_000;
export const MAX_BUDGET = 2_000_000_000;
const OUTPUT = '.atrium-ingest/reviewed-source-originals';
const hash = body => createHash('sha256').update(body).digest('hex');

export function validateRequest(input, manifest) {
  if (!/^docs\/ingest\/[a-z0-9-]+-source-request\.json$/.test(manifest || '')) throw Error('Invalid manifest path');
  if (input?.schema !== 'atrium-reviewed-source-request/1'
      || typeof input.batch !== 'string' || input.batch.length > 120
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.batch)
      || !Array.isArray(input.models) || input.models.length < 1 || input.models.length > 60) throw Error('Invalid bounded batch request');
  const budget = input.max_total_bytes ?? DEFAULT_BUDGET;
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > MAX_BUDGET) throw Error('Invalid source byte budget');
  const uids = new Set(), slugs = new Set();
  for (const model of input.models) {
    if (!/^[a-f0-9]{32}$/.test(model?.uid || '')
        || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(model.slug || '')
        || !/^[A-Za-z0-9_.-]{1,64}$/.test(model.publisher || '')
        || uids.has(model.uid) || slugs.has(model.slug)) throw Error('Invalid or duplicate source identity');
    uids.add(model.uid); slugs.add(model.slug);
  }
  return {budget, triplets: Array.from({length: Math.ceil(input.models.length / 3)}, (_, n) => input.models.slice(n * 3, n * 3 + 3))};
}

// Child errors are deliberately reduced to fixed categories. Never forward
// child stdout/stderr, arbitrary exception messages or signed delivery URLs.
export function safeReason(error = '') {
  if (/permission mismatch|publisher|identity/.test(error)) return 'source-identity-or-permission-mismatch';
  if (/HTTP \d{3}/.test(error)) return `provider-http-${error.match(/HTTP (\d{3})/)[1]}`;
  if (/external dependencies/.test(error)) return 'external-source-dependencies';
  if (/completeness|byte count/.test(error)) return 'source-completeness-mismatch';
  if (/bounded authenticated/.test(error)) return 'no-bounded-authenticated-glb';
  if (/Credential-bearing/.test(error)) return 'unsafe-provider-metadata';
  return 'source-triplet-failed';
}

export function aggregateTriplet(models, child, succeeded) {
  const requested = new Map(models.map(model => [model.uid, model]));
  const seen = new Set(), works = [];
  let invalid = false;
  for (const work of Array.isArray(child?.works) ? child.works : []) {
    const model = requested.get(work?.uid), source = work?.source;
    if (!model || seen.has(work.uid) || work.slug !== model.slug || work.publisher !== model.publisher
        || work.originalUnchanged !== true || source?.file !== `${model.uid}/source.glb`
        || source.format !== 'glb' || !Number.isSafeInteger(source.bytes) || source.bytes < 1 || source.bytes > 500_000_000
        || !/^[a-f0-9]{64}$/.test(source.sha256 || '') || work.authenticatedMetadata?.bytes !== source.bytes) {
      invalid = true; continue;
    }
    seen.add(work.uid); works.push(work);
  }
  const reason = invalid ? 'invalid-child-source-receipt' : safeReason(child?.error);
  const holds = models.filter(model => !seen.has(model.uid)).map(model => ({uid: model.uid, slug: model.slug, reason}));
  return {works, holds, complete: succeeded && child?.status === 'pass' && !invalid && holds.length === 0,
    sourceBytes: works.reduce((sum, work) => sum + work.source.bytes, 0)};
}

async function main() {
  const manifest = process.env.MANIFEST;
  const report = {schema: 'atrium-reviewed-source-batch-acquisition/1', checkedAt: new Date().toISOString(),
    requested: 0, acquired: 0, sourceBytes: 0, works: [], holds: [], triplets: [], status: 'fail',
    budgetEnforcement: 'between-triplets; a completed triplet may exceed the remaining budget'};
  let ownsOutput = false, requestedModels = [];
  try {
    await fs.mkdir('.atrium-ingest', {recursive: true});
    // A fresh namespace prevents a previous attempt from becoming this run's proof.
    await fs.mkdir(OUTPUT); ownsOutput = true;
    await fs.mkdir(path.join(OUTPUT, 'reports'));
    if (!/^docs\/ingest\/[a-z0-9-]+-source-request\.json$/.test(manifest || '')) throw Error('Invalid manifest path');
    const requestBody = await fs.readFile(manifest);
    const input = JSON.parse(requestBody);
    const {budget, triplets} = validateRequest(input, manifest);
    requestedModels = input.models;
    Object.assign(report, {batch: input.batch, requestSha256: hash(requestBody), requestBytes: requestBody.length,
      manifest, requested: input.models.length, maxTotalBytes: budget});
    await fs.writeFile(path.join(OUTPUT, 'root-source-request.json'), requestBody, {flag: 'wx'});
    if (!process.env.SKETCHFAB_TOKEN) throw Error('Sketchfab credential required');
    let anyTripletFailure = false;
    for (let n = 0; n < triplets.length; n++) {
      const models = triplets[n], number = n + 1;
      if (report.sourceBytes >= budget) {
        report.holds.push(...triplets.slice(n).flat().map(model => ({uid: model.uid, slug: model.slug, reason: 'batch-byte-budget-reached'})));
        break;
      }
      const childManifest = `docs/ingest/${input.batch}-task-triplet-${number}-source-request.json`;
      const body = Buffer.from(JSON.stringify({schema: input.schema, batch: input.batch, models}, null, 2) + '\n');
      await fs.writeFile(childManifest, body, {flag: 'wx'});
      const result = spawnSync(process.execPath, ['scripts/fetch-reviewed-sources.mjs'], {
        env: {...process.env, MANIFEST: childManifest}, encoding: 'utf8', maxBuffer: 64 * 1024,
        timeout: 1_080_000, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let child = null, receiptBody = null;
      try {
        receiptBody = await fs.readFile(path.join(OUTPUT, 'acquisition.json'));
        child = JSON.parse(receiptBody);
        if (child.batch !== input.batch || child.requestSha256 !== hash(body)) throw Error('Mismatched child report');
        if (receiptBody.includes(Buffer.from(process.env.SKETCHFAB_TOKEN))) throw Error('Unsafe child report');
        await fs.writeFile(path.join(OUTPUT, 'reports', `triplet-${number}.json`), receiptBody, {flag: 'wx'});
      } catch {
        child = null;
      }
      const combined = aggregateTriplet(models, child, result.status === 0 && !result.error);
      report.works.push(...combined.works); report.holds.push(...combined.holds);
      report.sourceBytes += combined.sourceBytes;
      anyTripletFailure ||= !combined.complete;
      report.triplets.push({number, requested: models.length, acquired: combined.works.length,
        sourceBytes: combined.sourceBytes, status: combined.complete ? 'pass' : 'partial-or-failed',
        requestSha256: hash(body), ...(child ? {report: `reports/triplet-${number}.json`, reportBytes: receiptBody.length, reportSha256: hash(receiptBody)} : {reason: 'missing-or-invalid-child-report'})});
      // Remove only the child's transient report, after copying it. This prevents
      // the next child from accidentally reusing stale acquisition metadata.
      await fs.rm(path.join(OUTPUT, 'acquisition.json'), {force: true});
      console.log(JSON.stringify({triplet: number, requested: models.length, acquired: combined.works.length, held: combined.holds.length}));
    }
    report.acquired = report.works.length;
    report.complete = !anyTripletFailure && report.holds.length === 0 && report.acquired === report.requested;
    report.status = report.complete ? 'pass' : 'partial';
  } catch {
    report.error = 'batch-validation-or-execution-failed';
    report.complete = false;
    const accounted = new Set([...report.works, ...report.holds].map(work => work.uid));
    report.holds.push(...requestedModels.filter(model => !accounted.has(model.uid))
      .map(model => ({uid: model.uid, slug: model.slug, reason: 'batch-execution-stopped'})));
  } finally {
    report.acquired = report.works.length;
    if (ownsOutput) await fs.writeFile(path.join(OUTPUT, 'acquisition.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({status: report.status, requested: report.requested, acquired: report.acquired,
      held: report.holds.length, sourceBytes: report.sourceBytes, ...(report.error ? {error: report.error} : {})}));
    if (!report.complete) process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
