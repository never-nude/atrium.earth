# Private source archive workflow

These tools never upload assets, modify cloud objects, or change catalog/build
data. Inventory and planning are read-only; cleanup defaults to a dry run.
Requests, roots, manifests, keys, receipts and journals belong outside Git or in
an ignored private folder. Public, dist and Git internals in every registered
worktree are prohibited even when Git ignores them.

## Inventory and portable restore identity

~~~sh
node scripts/storage-archive.mjs inventory \
  --roots PRIVATE_ROOTS.json --bindings PRIVATE_PIECE_BINDINGS.json \
  --output PRIVATE_MANIFEST.json
~~~

Roots are [{id,absolutePath,label}]. Bindings are
[{slug,identity,batch,public,assets,remoteAssets,missingOriginals}]; each local
asset has {sourceRootId,relativePath,assetRole,dependencyGroupId?}.
Only explicitly bound files and their transitive dependencies are read by
default. A private config file can explicitly opt into scanRoots:true for a
narrow archive directory; do not scan all of Downloads or a checkout.

The atrium-storage-manifest/1 records logical paths, piece identity, batch,
asset role, full SHA256, exact bytes, dependency bundles and 100MiB chunk hashes
and offsets. Absolute locations stay in the separate private roots registry.
Provider originals and web previews remain distinct logical assets even when
content dedup reuses one blob. Missing originals are never filled by previews.
Local inode/mtime/ctime observations guard cleanup; logical paths and the
content-addressed blob map permit restoration on another machine.

The deletion roles are provider-original, source-archive, source-sidecar,
license, provenance, derivative-web-preview and derivative-other. Unknown roles
are blocked. Include every texture/BIN/MTL/OBJ, license/attribution evidence and
per-piece provenance in bindings. OBJ/MTL, glTF/GLB and PLY references are
followed; missing, remote or escaping dependencies block the bundle.
FBX/Blend/Collada/USD need additional dependency review and remain blocked.
ZIP/USDZ downloads are archived whole; their individual members are never
deleted. Any loose dependencies also belong in the explicit bundle.

## Upload, then verify every remote content byte

The operator owns Drive uploads and authenticated raw-file fetches. Use the
canonical Drive file/d/ACTUAL_ID/view URL for connector fetch: metadata links
with query components can stall it. In observed connector use, binary fetches
must run sequentially; parallel fetch promises can hang. Metadata-only reads
may be parallelized. Obtain a fresh raw authenticated URL just before streaming.

Create an ignored private request:

~~~json
{
  "blob": {"sha256": "FULL_SHA256", "bytes": 123},
  "objects": [{
    "order": 0, "offset": 0, "bytes": 123, "sha256": "FULL_SHA256",
    "downloadUrl": "EPHEMERAL_AUTHENTICATED_HTTPS_URL",
    "drive": {
      "provider": "google-drive", "fileId": "PRIVATE_FILE_ID",
      "version": "REMOTE_VERSION", "size": 123,
      "private": true, "sharingCheckedAt": "ISO_UTC"
    }
  }]
}
~~~

ModifiedTime can replace version using the field modifiedTime. Private sharing,
identity and version evidence comes from actual provider readback. Ordered
chunks need their own full expected hashes, contiguous offsets and bytes; the
concatenated content must match the original full SHA256 and size.

~~~sh
node scripts/storage-verify-backup.mjs \
  --request PRIVATE_REQUEST.json --key PRIVATE_KEY \
  --receipts PRIVATE_BACKUP_LEDGER.json --create-key
~~~

The verifier streams directly into SHA256 without another large local download.
Network verification defaults to120000ms per content object. Use
--timeout-ms 1800000 when a larger bounded
window is necessary; valid values are positive integers through1800000ms.
Interrupted or timed-out content streams issue no complete receipt.
It rejects HTTP206, short/corrupt bodies, chunk-order errors and metadata-only
claims. Token-free receipts are HMAC signed; authenticated URLs are never logged
or copied into receipts. Keep the owner-only signing key private and available.
Fresh receipts are merged under an exclusive lock, so separate successful
verifications do not overwrite one another. Per-blob shard ledgers are also
supported; union only authenticated receipts into a backup ledger.

For an explicit private JSON array of shard-ledger filenames:

~~~sh
node scripts/storage-verify-backup.mjs merge \
  --inputs PRIVATE_LEDGER_PATH_LIST.json --key PRIVATE_KEY \
  --receipts PRIVATE_UNION_LEDGER.json
~~~

Merge validates every signature; backup and live ledgers stay separate. Include
the restore-map receipt in the backup union. Each update merges under its lock.

Already archived restore manifests must remain immutable. Create a new
inventory/version instead of overwriting them. Every cleanup manifest requires
a nonempty requiredBlobs array containing the immutable restore-map dependency:

~~~json
{"requiredBlobs":[{"sha256":"FULL_SHA256","bytes":123,"assetRole":"restore-manifest"}]}
~~~

Each required blob needs a fresh signed full-content backup receipt. This is an
automatic gate: verified geometry alone cannot authorize cleanup if its recovery
map or required provenance metadata has not also been verified remotely.

## Verify current public delivery

~~~sh
node scripts/storage-archive.mjs dependencies --output PRIVATE_DEPENDENCIES.json
~~~

A live request is:

~~~json
{"kind":"live-delivery","url":"PUBLIC_UNSIGNED_HTTPS_URL","blob":{"sha256":"FULL_SHA256","bytes":123}}
~~~

Use the same verifier/key and a separate private live ledger. It performs a full
GET with Origin:https://atrium.earth, checks production CORS and all bytes, then
signs a live receipt. For a legacy public URL without a known full hash, supply
bytes:123 instead of blob; the verifier computes SHA256 from the complete body.
Any hashed filename prefix is still checked. Only live previews support this
discovery mode; provider originals always need a known expected full hash.
HEAD/size claims, URLs alone and unsigned booleans cannot authorize removal.

## Plan and apply exact per-file removal

Copy exact fields from the manifest into an explicit whitelist:

~~~json
{
  "schema":"atrium-storage-removal-whitelist/1",
  "manifestSha256":"CANONICAL_MANIFEST_SHA256",
  "files":[{
    "candidateId":"file-DETERMINISTIC_64_HEX_ID",
    "sourceRootId":"ROOT_ID","relativePath":"bundle/original.glb",
    "sha256":"FULL_SHA256","bytes":123
  }]
}
~~~

The inventory command prints its canonical digest. Never create deletion lists
from size/name guesses or wildcard matches.

~~~sh
node scripts/storage-archive.mjs plan \
  --manifest PRIVATE_MANIFEST.json --roots PRIVATE_ROOTS.json \
  --receipts PRIVATE_BACKUP_LEDGER.json --key PRIVATE_KEY \
  --whitelist PRIVATE_WHITELIST.json --live-proofs PRIVATE_LIVE_LEDGER.json \
  --output PRIVATE_PLAN.json
~~~

Every bundle member needs a fresh authenticated full-byte backup. Current content,
symlink/alias safety, handles, locks, partial transfers, tracked files and local
routes across all worktrees are checked. Public pieces need verified current
delivery. Unknown evidence blocks deletion. Removing raw sources makes later
regeneration require archive restoration; the plan records this.

For a fully allowed batch, use the same arguments with cleanup --apply, plus
--journal NEW_PRIVATE_JOURNAL.json --quarantine EXISTING_PRIVATE_DIRECTORY.
Quarantine must be on the source filesystem. Any blocked candidate prevents the
whole batch from starting. Apply rebuilds the plan, stages each exact file in a
new private directory, rechecks captured inode and full content, then removes
only that verified file. It never removes source directories, cloud backups,
tracked files or unrelated originals. Output collisions with unrelated existing
files are refused; a journal from another operation is never overwritten.

If interrupted, inspect the private journal before retrying. A moving or
quarantined entry may retain the file at its recorded quarantine path. Preserve
it and restore it without overwriting an existing source file, then create a
fresh inventory/whitelist/journal. Completed deletions remain restorable through
the remotely verified recovery map and content-bound receipts.

## Tests

~~~sh
node --test scripts/storage-archive.test.mjs
node scripts/storage-live-dependencies.test.mjs
~~~

Only synthetic temporary fixtures are removed. Tests cover partial/chunked
transfers, forged/stale receipts, concurrent ledger updates, dependencies,
changed files, symlinks, tracked/live assets, output collisions, recovery-map
proof and quarantine traversal. Operational sources and cloud objects are untouched.
