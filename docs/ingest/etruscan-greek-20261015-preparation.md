# Etruscan art and Greek pottery preparation — 2026-10-15

This round targets exactly 60 new, distinct physical objects under the logical batch `etruscan-greek-20261015`. Discovery, metadata preflight, source acquisition and publication are separate stages. The existing catalog contains 1,951 records. The standing featured collection remains exactly 250; this acquisition does not alter its membership, homepage approvals or heroes.

## Preparation tools and inputs

The separate discovery inputs are `docs/ingest/etruscan-greek-20261015-etruscan-candidates.json` and `docs/ingest/etruscan-greek-20261015-pottery-candidates.json`. Each uses `atrium-auto-ingest-candidates/1` with `candidates[]`. Root makes the final 60-work selection; the script never truncates or pads an oversized/undersized discovery set.

`scripts/prepare-etruscan-greek-20261015.mjs` validates without writing by default. It checks exact Sketchfab UIDs and download endpoints; primary object records and institution/accession identities; catalog identity corrections; current fetch/assembler title and accession collisions; public derivative-compatible license label/URL/tier; recent download eligibility; explicit selected GLB bytes; documented dates or honestly unknown chronology, origins and holding collections; source evidence; and measured-integrity requirements. An unknown maker may remain empty. Only byte-for-byte identical repeated discovery records are coalesced. Conflicting source UIDs or repeated physical objects block output. An optional slug selection file must contain unique known slugs.

Every candidate requires `require_measured_integrity: true`. Component exemptions, alternate downloads and skipped-integrity flags are forbidden. `face_count_scope` distinguishes `selected-download-archive` from `api-detail-only-unmeasured`. In the latter case, `source_geometry.faces` is null and `source_geometry.api_detail_faces` records the public API count. An unavailable archive face count is never invented. Actual source integrity must be measured after acquisition.

The 20 focused preparation tests exercise exact selection, duplicate/object identity, corrected identities, generic core collisions, restrictive licenses, private fields, unknown makers/dates/origins, unresolved archive metadata, measured integrity, partial-run rejection, sequential rate limiting and signed-URL exclusion. They use synthetic metadata and mocked APIs; they do not acquire models.

~~~sh
node --test scripts/prepare-etruscan-greek-20261015.test.mjs
node scripts/prepare-etruscan-greek-20261015.mjs --help
~~~

## Resolve current download metadata on Actions

The local environment does not have the Actions-only Sketchfab credential. Public detail currently omits selected archive sizes, so do not substitute `archiveSize` for the chosen GLB size: the internal model record can describe an uploaded OBJ archive instead.

The dedicated `.github/workflows/etruscan-greek-metadata.yml` reads public detail and authenticated `/v3/models/<uid>/download` sequentially, spacing every request by at least five seconds. It honors HTTP429 Retry-After within a bounded ten-minute retry budget and uses a one-minute timeout per request. It emits only an allowlisted `atrium-selected-download-metadata/1` record containing UID, license, current selected GLB bytes, genuinely reported archive faces or null, distinctly labeled detail counts and check time. It does not request a returned model URL, save signed URLs/tokens/account metadata, assemble, upload R2 models or push a result branch.

For the first run on a branch, root adds the exact push-trigger file `docs/ingest/etruscan-greek-20261015-metadata-request.json`:

~~~json
{
  "batch": "etruscan-greek-20261015",
  "leads_files": [
    "docs/ingest/etruscan-greek-20261015-etruscan-candidates.json",
    "docs/ingest/etruscan-greek-20261015-pottery-candidates.json"
  ]
}
~~~

The push run uses that exact pushed commit. A provisional run may list only one discovery file; updating the request after the other file exists starts another serialized preflight. A newly added manual workflow may not be discoverable until it exists on the default branch, so the push trigger avoids publishing code merely to register the workflow. Once manually dispatchable, both inputs are mandatory:

~~~sh
gh workflow run etruscan-greek-metadata.yml \
  --repo never-nude/atrium.earth --ref codex/etruscan-greek-20261015 \
  -f ref=codex/etruscan-greek-20261015 \
  -f leads_file=docs/ingest/etruscan-greek-20261015-pottery-candidates.json
~~~

Download only the small `etruscan-greek-metadata-<run>-<attempt>` artifact to an ignored staging directory. Separate successful runs can be combined as one metadata document by concatenating their `models` arrays and retaining the schema/batch; repeated UIDs must be removed only when their metadata agrees. `applyDownloadMetadata` rejects duplicate metadata UIDs, license changes and contradictions with previously recorded selected bytes. The final candidate check rejects stale timestamps or missing models/sizes.

~~~sh
node scripts/prepare-etruscan-greek-20261015.mjs \
  --input docs/ingest/etruscan-greek-20261015-etruscan-candidates.json \
  --input docs/ingest/etruscan-greek-20261015-pottery-candidates.json \
  --metadata .atrium-ingest/etruscan-greek-20261015/selected-download-metadata.json \
  --selection docs/ingest/etruscan-greek-20261015-selected-slugs.txt
~~~

After independent source review and a clean report, root repeats this command with `--out docs/ingest/etruscan-greek-20261015-leads.json`. Output is exclusive creation of this dedicated file; it never overwrites discovery inputs or an existing lead file. The manifest carries `expected_count: 60`, `strict_acquisition: false`, one logical batch ID and unique sequence numbers. The workflow's older strict mode requires pre-known source hashes and has a narrow license allowlist; it is unsuitable for these first-time BY downloads. False does not disable the per-candidate measured-integrity requirement.

## Root acquisition dispatch

Commit/push the reviewed manifest and infrastructure on the task branch first. The existing acquire workflow defaults still point to African art; explicitly provide every acquisition input. One 60-work acquisition is within the documented 45–60-work chunk size. Root dispatches:

~~~sh
gh workflow run acquire-leads.yml \
  --repo never-nude/atrium.earth --ref codex/etruscan-greek-20261015 \
  -f leads=docs/ingest/etruscan-greek-20261015-leads.json \
  -f batch=etruscan-greek-20261015 \
  -f base_ref=codex/etruscan-greek-20261015 \
  -f inline_orientation=false \
  -f orientation_requests=
~~~

Root checks the run's exact head SHA and inputs, fetches its result branch `codex/etruscan-greek-20261015-review-<run>-<attempt>` after success, and inspects the diff before integration. Do not queue multiple catalog-writing chunks from the same base. If replacement leads require a continuation, use the preceding cumulative review branch as `base_ref` and the same batch ID; preserve prior members' timestamps. Source or integrity holds remain holds and need replacements if the final public target is to be 60.

The runner fetches selected sources, backs up `.atrium-ingest/sources/`, measures geometry, assembles with source-GLB optimization, uploads immutable hash-named previews to R2 with full public readback, and renders thumbnails/posters. Review reports are copied under `docs/ingest/etruscan-greek-20261015-run-<run>/`. The ordinary Node fetch path currently records but does not enforce selected byte counts, so the following post-run check is mandatory rather than assuming workflow success proves all 60:

~~~sh
node scripts/prepare-etruscan-greek-20261015.mjs \
  --audit-run docs/ingest/etruscan-greek-20261015-run-RUN_ID \
  --leads docs/ingest/etruscan-greek-20261015-leads.json
~~~

This requires every expected source/accepted slug, full source hashes, actual original-download bytes matching metadata, unchanged UID/license, no fetch errors, and measured geometry meeting the unchanged component/boundary/largest-component gate. It does not claim to rehash remote originals, prove visual completeness or calibrate dimensions.

## Source-only retrieval with bounded local storage

The acquisition artifact is named `atrium-temporary-sources-etruscan-greek-20261015-<run>-<attempt>`, with zero compression and 90-day retention. Only `.atrium-ingest/sources/` enters this artifact. Token-bearing staging metadata is outside it. This is a temporary recovery copy, not the permanent private archive; R2 previews also do not replace full sources.

Do not download the entire workflow run or a broad artifact pattern. Do not download a complete large ZIP and then retain all extracted/decoded/archived duplicates. Resolve the exact artifact ID and list ZIP members first. Match each unmodified incoming file to sanitized `fetched.downloaded_path`, `fetched.sha256` and `fetched.original_download_bytes`. A decoded GLB or optimized preview is a different asset role; retain the provider's incoming file separately. If native uploaded sources were not requested, describe the preserved selected GLB as a provider-converted download rather than claiming it is the uploader's original OBJ/texture bundle.

A private local helper was prepared at `.atrium-ingest/etruscan-greek-20261015/retrieve-artifact-source.private.mjs`. It requires exact repository/run/attempt/head/artifact identity, a strong stable ETag and exact HTTP206 Content-Range responses. It requests the ZIP end record and bounded central directory, then streams only an exact selected entry into an exclusive private file. ZIP64, path traversal, duplicate members, symlinks, encryption, unsupported compression, full-response range fallback and mismatched local headers fail closed. It verifies full uncompressed SHA/bytes/CRC, fsyncs and rehashes the actual stored bytes through the retained descriptor, inspects embedded GLB buffers/images, and checks file/path identity before closing. Signed archive redirect URLs and authorization remain in memory only. Modes are 700 for staging folders and 600 for source files/receipts. It does not overwrite existing outputs or claim cloud backup from local retrieval.

~~~sh
node .atrium-ingest/etruscan-greek-20261015/retrieve-artifact-source.private.mjs \
  --artifact-id EXACT_ARTIFACT_ID --run-id EXACT_RUN_ID --attempt 1 \
  --head-sha EXACT_ACQUISITION_HEAD_SHA --list

node .atrium-ingest/etruscan-greek-20261015/retrieve-artifact-source.private.mjs \
  --artifact-id EXACT_ARTIFACT_ID --run-id EXACT_RUN_ID --attempt 1 \
  --head-sha EXACT_ACQUISITION_HEAD_SHA \
  --fetched docs/ingest/etruscan-greek-20261015-run-RUN_ID/fetched.json \
  --slug EXACT_SLUG
~~~

The helper is ignored local operational state and does not travel through Git. Nine synthetic parser/CRC/disk/GLB tests pass; independent read-only safety review found no remaining concrete blocker. Actual artifact HEAD/Range behavior still requires root's backend probe. No source payload retrieval was performed in this preparation.

Root archives one bounded group at a time using the verified Drive workflow: preserve the exact incoming source plus dependent sidecars and license/provenance records, upload/reuse content-deduplicated blobs, full-SHA read back private copies, and verify an immutable portable recovery map. Files larger than 90 MiB use verified ordered chunks. Release local staging only through the established exact-whitelist cleanup gates after full archive/recovery/live verification. Keep failed or uncertain transfers intact. Do not remove tracked or Pages-local serving models.

## Final presentation and release review

Native authored textures, COLOR_0 including uniform black and source material/PBR maps must remain intact. No generated terracotta tint, painted decoration, patina, polish or missing geometry may be invented. Source-model capture scope governs the label: fragments, reconstructions, visible undersides and retained museum mounts/context need explicit qualifications. Compare complete vessel silhouette, handles, rim/interior, underside and painted scenes against the source and primary object photographs; a strong single thumbnail does not prove the reverse is complete.

Use the final cumulative review ref and an exact complete slug list under `docs/ingest/` for sharded pose review:

~~~sh
gh workflow run orientation-sheets.yml \
  --repo never-nude/atrium.earth --ref FINAL_CUMULATIVE_REVIEW_BRANCH \
  -f batch=etruscan-greek-20261015 \
  -f slugs_file=docs/ingest/etruscan-greek-20261015-orientation-requests.txt
~~~

Review all A–J variants and source fronts; record only supported orientation/view choices. Then dispatch `rerender-thumbnails.yml` on the corrected review ref with explicit `batch=etruscan-greek-20261015` and `slugs_file=docs/ingest/etruscan-greek-20261015-final-thumbnails.txt`. Avoid request filenames ending `-rerender.txt` or `-orientation-round2.txt`: those match legacy push triggers whose fallback inputs still refer to the African batch. Use the explicitly dispatched paths in this guide. These workflows reject duplicate slugs and require every requested output. Import only the requested complete outputs and regenerate poster SVGs from the exact final thumbnail bytes.

Write per-piece physical-dimension and spatial-eligibility decisions only after the immutable preview URL and final orientation are settled. A source label such as diameter/height cannot automatically calibrate a fragment or mounted/multi-object scan. Unknown size stays unresolved with an honest chosen display preset if needed; no exact AR is enabled from a title, museum photograph or presumed source units. Calibrated entries require actual source dimensions and matching full-model geometry review.

Before root publication: review the complete source/derivative contact sheets and final renders; verify source/archive scope and hashes; check all 60 public object pages and size decisions, representative actual Viewer drag/AR-dialog behavior, R2 full-byte delivery/CORS, rendered thumbnail/poster equality, catalog assets, wing routing, additions and a full production build. Existing featured250 data stays unchanged. With a single logical batch, Newest automatically includes all 60 public additions instead of splitting them at the 40-work floor. Hidden/held records must not be counted as public additions or used to meet the target.
