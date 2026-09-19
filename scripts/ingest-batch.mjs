import { randomUUID } from 'node:crypto';

const BATCH_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Capture one identity and timestamp for all newly accepted works in a run. */
export function createIngestBatch({ id, now = new Date() } = {}) {
  const ingestedAt = now.toISOString();
  const batchId = id === undefined || id === null
    ? `import-${ingestedAt.replace(/[-:.]/g, '').toLowerCase()}-${randomUUID().slice(0, 8)}`
    : id;
  if (typeof batchId !== 'string' || batchId.length > 120 || !BATCH_ID_RE.test(batchId)) {
    throw new Error('Ingest batch ID must be 1–120 lowercase letters, digits, or single hyphens between words (--batch / ATRIUM_INGEST_BATCH).');
  }
  return Object.freeze({
    ingest_batch: batchId,
    ingested_at: ingestedAt,
    ingested: ingestedAt.slice(0, 10),
  });
}

/** Both --batch=value and --batch value override the optional environment ID. */
export function batchIdFromArgs(argv, env = process.env) {
  let id = env.ATRIUM_INGEST_BATCH || undefined;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--batch=')) id = argv[i].slice('--batch='.length);
    else if (argv[i] === '--batch') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) throw new Error('--batch requires an ID.');
      id = next;
      i += 1;
    }
  }
  return id;
}
