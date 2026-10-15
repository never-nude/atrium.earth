# Private source archive and safe local cleanup

This workflow preserves Atrium's collection files in Google Drive, verifies the
actual stored bytes, and removes only explicitly selected local files that no
longer serve the site. Planning is read-only. No upload or remote deletion command
is built into these scripts; the archive operator performs Drive transfers and
supplies private verification requests.

The master catalog is `src/data/catalog.json`. Do not regenerate it with the legacy
import command. A provider original and an optimized web preview are separate
assets, even when their titles match. A preview backup does not establish that the
original has been preserved.

## Archive contents and recovery records

Use private, content-addressed Drive objects keyed by the complete SHA-256 and
exact byte count. Reuse an existing object only after downloading its complete
content and verifying that binding. Keep every piece's identity and logical file
mapping when several local files share one blob; deduplication must not erase
source/derivative roles, original filenames or piece associations.

An original package includes its unchanged provider download, external buffers,
textures and material files, license/credit evidence, source URLs, and provenance.
Explicitly record missing or uncertain originals. Archive the current serving
preview separately when no original is available, and label it as a derivative.
Keep hidden/deferred records in archive coverage without publishing them.

Back up a detached recovery manifest before any purge. It must preserve piece
identities, exact casts/fragments, source/license metadata, source-root IDs and
relative paths, full hashes/sizes, dependency groups, and the ordered Drive
object/version mapping needed to restore each file. Its own complete-content
receipt must be a required backup dependency of the cleanup inventory. Keep
private receipts, recovery maps and the schema needed to interpret them in the
permanent archive too. A binary blob surviving in Drive is insufficient when its
piece identity or restore mapping exists only on the Mac.

Register that immutable manifest in the inventory configuration:

```json
{
  "requiredBlobs": [
    { "sha256": "FULL_SHA256", "bytes": 123, "assetRole": "restore-manifest" }
  ]
}
```

Cleanup requires at least one `restore-manifest` entry and fresh signed
complete-content receipts for every `requiredBlobs` entry. A new recovery-map
version gets a new object and inventory; do not replace an archived map.

The source-only GitHub Actions artifact expires after 90 days. R2 holds public
optimized previews. Neither replaces the permanent original archive.

## Private state

Keep source-root registries, requests, manifests, receipts, whitelists, plans,
journals and keys in an ignored directory such as
`.atrium-ingest/storage-archive/`, or a private location outside the repository.
Never put them under `public/`, `dist/` or `.git/`. Git-ignore does not stop Astro
from publishing a file placed in `public/`.

Private Drive IDs, signed download URLs, account metadata and signing keys do not
belong in Git or public workflow logs. Signing keys are owner-only files. A lost
key requires fresh remote verification and new receipts; an unsigned replacement
ledger is not deletion authority.

## Inventory and complete packages

The private configuration supplies explicit source roots and per-piece assets.
Root IDs and relative paths remain portable; absolute paths stay in the separate
private root registry. Use explicit asset roles: `provider-original`,
`source-archive`, `source-sidecar`, `license`, `provenance`,
`derivative-web-preview` or `derivative-other`. Unknown roles remain blocked.

```sh
node scripts/storage-archive.mjs inventory \
  --config .atrium-ingest/storage-archive/config.private.json \
  --output .atrium-ingest/storage-archive/manifest.private.json

node scripts/storage-archive.mjs dependencies \
  --output .atrium-ingest/storage-archive/delivery.private.json
```

Inventory hashes the original files without converting them, records their file
identity/timestamps, and computes ordered chunks. Bound-only inventory is the
default; scanning every file in a root requires explicit `scanRoots: true`.
GLB/glTF buffers and images, OBJ material libraries, MTL textures and PLY texture
references are resolved into complete packages. Missing, escaping, remote or
unsupported compound dependencies hold the package for review. Every required
member must have a full verified backup before any member is eligible for removal.

Review coverage against all catalog pieces. Distinguish original-complete,
derivative-only, missing and unmapped entries. A successful batch of files does
not prove that every Atrium original has been found or archived.

## Upload, full readback and signed receipts

The archive operator uploads missing blobs to private Drive storage and reads
back object identity, version or modification time, exact size and sharing state.
For files larger than 100 MiB, use ordered parts of at most 100 MiB where transfer
limits require them. The manifest records each part's zero-based order, offset,
bytes and SHA-256, plus the complete original's SHA-256 and bytes. Concatenation in
that exact order must reproduce the original; parts are not independent artworks.

For the connector's 100 MiB upload limit, set `chunkBytes: 94371840` in the private
inventory configuration and stage one recorded part at a time:

```sh
node scripts/storage-stage-chunk.mjs stage \
  --manifest .atrium-ingest/storage-archive/manifest.private.json \
  --roots .atrium-ingest/storage-archive/roots.private.json \
  --candidate file-FULL_INVENTORY_ID --order 0 \
  --output .atrium-ingest/storage-archive/staging/PART_SHA256.part
```

The helper reads at most 1 MiB at once and writes at most one selected 90 MiB
part. It verifies the complete source's SHA-256 and inventory stat before and
after reading, then checks the staged part's SHA-256 and bytes. Symlinks,
changed sources and existing destinations are holds. Output is restricted to
ignored `.atrium-ingest` paths, with an atomic no-overwrite publication. CLI
metadata contains hashes, counts and order, without source paths or remote IDs.

Keep only a bounded number of staged parts pending transfer. Their originals
remain untouched; these temporary parts can be recreated from the immutable
inventory. After checkpointing a transfer, the operator may remove its exact
helper-created staging copy. Never treat a staged part or upload success as
authority to remove the original. Complete remote readback and signed package
receipts are still mandatory.

Prepare a private verification request using the recorded Drive metadata and
fresh ephemeral download URLs. The verifier streams all parts, hashes each one
and the reconstructed whole, and writes an HMAC-signed receipt only after the
complete sizes and hashes agree. It does not create another full local copy.
Use the canonical Drive file URL when obtaining a raw download URL through the
connector. Binary fetches have stalled in parallel and on query-bearing metadata
links in this environment; obtain them sequentially and preserve successful
checkpoints. Metadata requests can run independently. A stalled fetch creates no
verification authority.

```sh
node scripts/storage-verify-backup.mjs \
  --key .atrium-ingest/storage-archive/signing.key --create-key

node scripts/storage-verify-backup.mjs \
  --request .atrium-ingest/storage-archive/readback-request.private.json \
  --key .atrium-ingest/storage-archive/signing.key \
  --receipts .atrium-ingest/storage-archive/backup-receipts.private.json
```

Metadata, HEAD requests, filenames, advertised sizes, incomplete HTTP bodies and
MD5 alone do not authorize cleanup. Backup receipts expire for cleanup purposes
after 24 hours and bind exact content plus private remote object/version records.
Refresh readback when stale. The archived source itself remains permanent.

Readbacks time out after two minutes by default. `--timeout-ms` accepts a positive
integer up to 1,800,000 for deliberately slower transfers. A timeout issues no
complete-content receipt; preserve the original and retry with a fresh download
request. The verifier never logs signed download URLs.

Use the provider metadata's actual Drive `id` as the permanent object identity.
A `file_uri.file_id` beginning with `sediment://` identifies a temporary downloaded
reference and cannot substitute for the Drive file ID in a recovery record.

Use bounded batches and checkpoint successful receipts. The verifier authenticates
and merges fresh receipts under an exclusive writer lock; separate successful
workers cannot replace one another's ledger entries. Do not hand-edit a ledger
while workers run. Private per-blob shard ledgers can also be merged using an
explicit JSON array of their filenames:

```sh
node scripts/storage-verify-backup.mjs merge \
  --inputs .atrium-ingest/storage-archive/shard-paths.private.json \
  --key .atrium-ingest/storage-archive/signing.key \
  --receipts .atrium-ingest/storage-archive/backup-receipts.private.json
```

Merge authenticates every receipt; backup and live-delivery ledgers stay separate.
Preserve successful receipts when another transfer fails. Batch boundaries must
not split verification of a source package or omit the recovery manifest receipt.

## Site dependencies and delivery proof

The October 15 catalog contains 1,951 records: 1,420 R2 previews and 531 tracked
Pages-local previews. Of the 1,933 public records, 1,405 use R2 and 528 use Pages;
the remaining records are hidden. All 531 local files remain protected.

Ordinary deployment runs `npm ci` and `npm run build`; it does not restore source
originals from Drive. The build copies `public/`, then removes directories whose
previews already point at R2. It retains Pages-local models, thumbnails and
posters. The screen viewer, WebXR and Quick Look use the configured preview, not
the catalog's offline `model.sourcePath` original.

The safety module protects tracked files across all registered worktrees, all
local preview routes and public assets, plus uncommitted code/review directories.
Its only public-file exception is an exact untracked R2 preview mirror with a
verified identical public copy. Removing such a mirror can require rehydration
before future thumbnail/orientation work; it does not remove the published model.

For associated current public R2 pieces, generate signed live-delivery receipts
with request `kind: "live-delivery"` through `storage-verify-backup.mjs`. A complete
HTTP 200 GET must match the expected full SHA-256 and size and permit the production
origin through CORS. Known model/AR hash bindings must agree. Legacy unhashed R2
URLs need the same full-content proof; a matching 12-character filename prefix
alone is insufficient.

The 531 Pages-local files cannot be purged by this workflow. Migrate them to
verified immutable R2 URLs or implement reliable build hydration first. A separate
migration must preserve/review preview-URL-bound dimensions and spatial decisions,
deploy successfully, and verify live delivery before tracked assets are removed.

## Dry run, exact whitelist and apply

Create a reviewed `atrium-storage-removal-whitelist/1` containing the inventory's
exact manifest hash and selected file IDs, root IDs, relative paths, full hashes
and byte counts. No directory or wildcard deletion is supported. Run the plan with
fresh signed backup and live-delivery ledgers:

```sh
node scripts/storage-archive.mjs plan \
  --manifest .atrium-ingest/storage-archive/manifest.private.json \
  --roots .atrium-ingest/storage-archive/roots.private.json \
  --receipts .atrium-ingest/storage-archive/backup-receipts.private.json \
  --key .atrium-ingest/storage-archive/signing.key \
  --whitelist .atrium-ingest/storage-archive/whitelist.private.json \
  --live-proofs .atrium-ingest/storage-archive/live-receipts.private.json \
  --output .atrium-ingest/storage-archive/plan.private.json
```

Resolve every blocked file before applying that batch, or create a smaller
explicit whitelist. A saved plan is never sufficient authority: `cleanup` without
`--apply` remains read-only, and apply repeats the entire preflight. Use the same
arguments with command `cleanup`, plus:

```text
--apply
--journal .atrium-ingest/storage-archive/journal-UNIQUE.private.json
--quarantine /absolute/path/to/private/same-filesystem-directory
```

An active/unknown handle check, transfer lock, symlink, changed file, stale or
partial backup, incomplete source package, missing restore manifest, protected
site dependency, or unavailable audit stops cleanup. Each selected file is
rehashed and compared by device/inode/size/mtime/ctime. Quarantine is private and on
the same filesystem; a captured file is verified again before unlink. Existing
unrelated output or quarantine files are never intentionally overwritten.

## Interrupted runs and restore

An interrupted transfer produces no complete receipt. Resume that blob/part and
reverify the complete package. Preserve old verification ledgers and use a new
plan/whitelist after refreshing inventory or receipts.

An interrupted cleanup may be partially complete. Read the private journal:
`removed` files have verified remote backups; `restored-after-block` files are back
at their original paths; `retained-in-quarantine` files remain local and must be
resolved before retry. Never delete a quarantine directory blindly. Do not rerun
an old journal over new files. Re-inventory remaining paths and use a new unique
journal and exact whitelist. Recheck assets and Git status after cleanup, and
retain the journal in the private archive.

Use the archived recovery manifest to map each source-root ID to a chosen
destination and fetch the recorded Drive objects/versions into private staging.
The local restoration helper accepts an `atrium-storage-restore-request/1` with
the complete `blob: {sha256, bytes}` and `parts` containing each zero-based
`order`, contiguous `offset`, `bytes`, `sha256` and local `path`. Its paths must be
inside ignored `.atrium-ingest` storage. It reads and verifies every part, streams
them in recorded order, and verifies the complete original SHA-256 and bytes:

```sh
node scripts/storage-stage-chunk.mjs restore \
  --request .atrium-ingest/storage-archive/restore-request.private.json \
  --output .atrium-ingest/storage-archive/restored/ORIGINAL_FILENAME
```

Restore creates only an absent private staging destination; even an existing
identical file is a hold. It does not download, overwrite or install an original
into the source tree. After verification, the operator can restore the complete
package to absent source paths with all sidecars at their exact relative paths
and license/provenance metadata intact. Regeneration requires this complete
restored package, not an optimized R2 substitute.

Run `node --test scripts/storage-archive.test.mjs` and
`node scripts/storage-live-dependencies.test.mjs` after changing these gates.
Run `node --test scripts/storage-stage-chunk.test.mjs` after changing staging or
restoration.
