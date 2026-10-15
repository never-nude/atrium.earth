import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inventorySources, createCleanupPlan, executeCleanup, manifestHash, noOpenFiles } from './storage-core.mjs';
import { auditLocalDeletionCandidates, collectStorageLiveDependencies } from './storage-live-dependencies.mjs';
import { parseArgs, privatePath, writePrivateJson, loadKey, verifyLiveReceipt, fail } from './storage-verify-backup.mjs';

async function privateJson(filename, repoRoot) {
  return JSON.parse(await fs.readFile(await privatePath(filename, repoRoot), 'utf8'));
}
export async function runStorageCli(argv) {
  const args = parseArgs(argv), command = args._[0] || 'help';
  const repoRoot = path.resolve(args.repo || process.cwd());
  if (args.help || command === 'help') {
    console.log([
      'Private, resumable source archival and fail-closed local cleanup:',
      '  inventory --config PRIVATE_CONFIG.json --output PRIVATE_MANIFEST.json',
      '  inventory --roots PRIVATE_ROOTS.json --bindings PRIVATE_BINDINGS.json --output PRIVATE_MANIFEST.json',
      '  dependencies --output PRIVATE_DELIVERY_REQUIREMENTS.json',
      '  plan --manifest PRIVATE_MANIFEST.json --roots PRIVATE_ROOTS.json --receipts PRIVATE_LEDGER.json --key PRIVATE_KEY --whitelist PRIVATE_WHITELIST.json --live-proofs PRIVATE_PROOFS.json --output PRIVATE_PLAN.json',
      '  cleanup (same plan arguments) [--apply --journal PRIVATE_JOURNAL.json --quarantine PRIVATE_DIRECTORY]',
      'Dry run is the default. No upload or remote deletion commands exist here.',
    ].join('\n'));
    return;
  }
  if (command === 'inventory') {
    if (args.apply) fail('Inventory is always read-only');
    const config = args.config ? await privateJson(args.config, repoRoot) : {
      sourceRoots: await privateJson(args.roots || fail('--config or --roots/--bindings is required'), repoRoot),
      pieces: await privateJson(args.bindings || fail('--bindings is required'), repoRoot),
    };
    const manifest = await inventorySources(config);
    await writePrivateJson(args.output || fail('--output is required'), manifest, repoRoot);
    console.log(JSON.stringify({ ...manifest.summary, manifestSha256: manifestHash(manifest), errors: manifest.errors.length }));
    return manifest;
  }
  if (command === 'dependencies') {
    if (args.apply) fail('Dependency discovery is always read-only');
    const dependencies = await collectStorageLiveDependencies({ repoRoot });
    await writePrivateJson(args.output || fail('--output is required'), dependencies, repoRoot);
    console.log(JSON.stringify({ remoteRequirements: dependencies.remoteRequirements.length, protectedDependencies: dependencies.protectedDependencies.length }));
    return dependencies;
  }
  if (!['plan', 'cleanup'].includes(command)) fail('Unknown storage command');
  const manifest = await privateJson(args.manifest || fail('--manifest is required'), repoRoot);
  const roots = await privateJson(args.roots || fail('--roots is required'), repoRoot);
  const ledger = await privateJson(args.receipts || fail('--receipts is required'), repoRoot);
  if (ledger.schema !== 'atrium-storage-backup-ledger/1' || !Array.isArray(ledger.receipts)) fail('Invalid signed receipt ledger');
  const whitelist = await privateJson(args.whitelist || fail('--whitelist is required'), repoRoot);
  const key = await loadKey(args.key || fail('--key is required'), { repoRoot });
  const live = args['live-proofs'] ? await privateJson(args['live-proofs'], repoRoot) : { schema: 'atrium-storage-live-ledger/1', receipts: [] };
  if (live.schema !== 'atrium-storage-live-ledger/1' || !Array.isArray(live.receipts)) fail('Live proofs require the verifier signed content ledger');
  const liveProofs = live.receipts.map(receipt => verifyLiveReceipt(receipt, key));
  const options = { repoRoot, sourceRoots: roots.sourceRoots || roots, manifest, receipts: ledger.receipts, key, whitelist,
    liveProofs, auditDependencies: auditLocalDeletionCandidates, openFileCheck: noOpenFiles };
  // Fresh signed backup receipts are mandatory; live-delivery proof fields are
  // independently validated by the dependency module and are never inferred from R2 URLs.
  const plan = await createCleanupPlan(options);
  if (args.output) await writePrivateJson(args.output, plan, repoRoot);
  console.log(JSON.stringify({ dryRun: !args.apply, eligibleFiles: plan.allowed.length, blockedFiles: plan.blocked.length, bytesEligible: plan.bytesEligible }));
  if (!args.apply) return plan;
  if (command !== 'cleanup') fail('--apply is valid only for cleanup');
  const journalPath = await privatePath(args.journal || fail('--journal is required for apply'), repoRoot);
  const quarantineRoot = await privatePath(args.quarantine || fail('--quarantine is required for apply'), repoRoot);
  const stat = await fs.lstat(quarantineRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await fs.realpath(quarantineRoot) !== quarantineRoot) fail('Quarantine must be an existing canonical private directory');
  const journal = await executeCleanup({ ...options, journalPath, quarantineRoot });
  console.log(JSON.stringify({ removedFiles: journal.files.filter(f => f.state === 'removed').length, complete: true }));
  return journal;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runStorageCli(process.argv.slice(2)).catch(error => {
    console.error('Storage operation stopped safely; inspect the private input ledgers and retry.');
    process.exitCode = 1;
  });
}
