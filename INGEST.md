# Ingest: how new works enter Atrium

The repo's `src/data/catalog.json` is the **master catalog**. Do not run the legacy
import (`import:catalog:legacy`) — it regenerates the catalog from the retired
`assets/catalog.json` flow and will clobber everything ingested since. It now
refuses to run if it detects ingested entries.

## The flow

1. **Codex harvests** per `CODEX-BRIEF.md` in `never-nude/atrium-vault`:
   raw files → vault GitHub Releases, one manifest per piece → `manifests/<collection>/<slug>.json`.
2. **Ingest** (this repo, with the vault cloned as a sibling):

   ```bash
   npm run ingest -- --dry-run          # validate + preview what would land
   GITHUB_TOKEN=$(gh auth token) npm run ingest
   ```

   This appends catalog entries, downloads release assets into the local source
   archive (`SOURCE_ATRIUM_DIR`, default `../atrium`), verifies sha256, recomputes
   index/total. Tier-3 (NC) manifests are reported and skipped. Duplicates are skipped.

3. **Generate assets** for the new pieces:

   ```bash
   SOURCE_ATRIUM_DIR=../atrium npm run models:preview   # GLB previews (trimesh venv)
   npm run images:posters                                # SVG posters
   npm run images:renders                                # WebP thumbs (Chrome; CHROME_BIN to override)
   npm run verify:assets                                 # catches anything missing
   ```

4. **Renders are mandatory before push** — new works must ship with real thumbnails, never poster fallbacks (owner's rule, 2026-06-10). In the Claude sandbox: install Playwright's ARM64 chromium (npx playwright install chromium), then run with CHROME_BIN=<headless_shell path> CHROME_EXTRA_ARGS="--no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader" ONLY=<slugs>. Then append the new slugs to src/data/renders.json (nothing writes it automatically).

5. **Build, eyeball, push.** `npm run build`, check a few new work pages, push to main —
   the Pages workflow deploys.

## Automated open-scan pipeline

The weekly scheduled path in `.github/workflows/ingest.yml` discovers CC0/Public
Domain/CC BY sculpture scans from whitelisted sources, stages downloads under
`.atrium-ingest/`, generates Atrium previews and WebP thumbnails, and opens a draft
PR. It never merges or publishes by itself.

Local dry run:

```bash
npm run ingest:discover -- --limit=3
npm run ingest:fetch -- --limit=3
SOURCE_ATRIUM_DIR=.atrium-ingest/source-archive npm run ingest:assemble
npx playwright install chromium
SLUGS="$(paste -sd, .atrium-ingest/new-slugs.txt)"
CHROME_BIN="$(node -e 'console.log(require("playwright").chromium.executablePath())')" \
  CHROME_EXTRA_ARGS="--no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader" \
  ONLY="$SLUGS" npm run images:renders
npm run images:mark-renders -- --input=.atrium-ingest/new-slugs.txt
npm run verify:assets
```

Sketchfab downloads require `SKETCHFAB_TOKEN`; without it, Sketchfab candidates are
reported but skipped at fetch time. The generated PR body lives at
`.atrium-ingest/last-report.md` and lists provenance, license, integrity, and
orientation decisions for every accepted or rejected candidate.

## Cloudflare R2 previews

Preview GLBs are served from the Atrium R2 bucket at `https://models.atrium.earth`
under immutable, content-hashed names (`models/previews/<slug>/preview-<sha256:12>.glb`).
`npm run models:upload-r2` uploads local previews through R2's S3-compatible API,
downloads each public copy back and checks its SHA-256, and only then points
`src/data/previews.json` at the public URL. Reruns skip previews that already point
at their current hash. Failed uploads leave the local URL in place and exit non-zero.

```bash
R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=… \
  npm run models:upload-r2 -- --input=.atrium-ingest/new-slugs.txt
npm run models:upload-r2 -- --slugs=africa/example --dry-run   # show keys, no upload
```

`npm run models:mirror-r2 -- --slugs=…` downloads R2 previews back to
`public/models/previews/<slug>/preview.glb` (checking the hashed filename), so
thumbnails can be re-rendered on a checkout that only has the R2 URLs.

Upload previews before writing dimension or spatial-eligibility entries, because those
bind to the preview URL. `npm run build` already excludes local mirrors of R2 models
from the Pages artifact, so R2 keeps large batches out of the Pages size limit.

Both `ingest.yml` (weekly) and `acquire-leads.yml` (saved candidate files, such as
`docs/ingest/african-art-20261002-leads.json`) upload automatically when these
repository secrets exist: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
and `R2_BUCKET`. Create the key pair in Cloudflare under R2 → Manage API tokens with
Object Read & Write on the models bucket only. `acquire-leads.yml` also needs
`SKETCHFAB_TOKEN`, and it pushes its result to a `claude/atrium-africa-review-<run>`
branch for curation; it never publishes to `main`. `npm run test:r2-upload` checks the
signer against AWS reference signatures and runs a mock end-to-end upload.

## Acquisition priorities (owner direction, September 2026)

Future batches should broaden the collection across regions, cultures, periods,
artists, and materials, with substantial contemporary representation. Prefer
artists associated with Dia Beacon when suitable openly licensed models are
available; their works may come from other collections. This is a preference,
not a reason to relax source, license, duplicate, or visual-quality checks.

Assign every addition through the existing wing rules using the work's origin,
not the location of the holding museum. Review the curated exhibitions and add
works only where the theme fits, with a caption explaining that connection.
Distinguish scans, reconstructions, details, and virtual impressions in the record.
Do not use a scan's publication or collection date as the artwork's creation date.

## Newest Additions batches

Both `npm run ingest` and `npm run ingest:assemble` automatically give every
newly accepted work the same `ingest_batch` ID and full UTC `ingested_at` timestamp
for that run. The existing `ingested` field remains the corresponding UTC date.
Generated IDs include the timestamp and a unique suffix, so separate imports on
the same day remain separate additions. Duplicate or rejected works are not
restamped; dry runs and runs with no accepted additions do not change the catalog.

To name a batch or deliberately continue it across several imports, pass the
same ID to each command:

```bash
npm run ingest -- --batch=geometric-sculpture-2026-09-19
npm run ingest:assemble -- --batch=geometric-sculpture-2026-09-19
```

`ATRIUM_INGEST_BATCH` is the environment equivalent; `--batch` takes precedence.
IDs must contain 1–120 lowercase letters or digits, with single hyphens between
words. They must not begin or end with a hyphen. Reuse an ID only when adding to
that same batch; a new import should normally receive a new ID. Each continuation
keeps the original works' timestamps and stamps only the newly accepted works.

The Newest Additions page displays the most recently imported public works across
batches, ordered by each work's `ingested_at` timestamp, with `ingested` as the
date fallback. Rule (owner, revised 2026-10-05): the page shows at least the newest
40 public works and always includes every public work in the latest batch, even when
that makes the page longer than 40. The homepage previews the first four of those
same pieces.
Neither page displays import titles, themes, or summaries. Older works leave this
rolling selection as new works arrive but remain in the catalog. Continuing a
batch keeps the original timestamps but returns the entire continued batch to the
rolling selection so that the latest acquisition is never split across pages.
Former batch URLs redirect to `/newest/`.

Optional metadata in `src/data/additions.json` and historical batch identities
remain internal records, not public acquisition pages. Historical records without
an ID use day-based fallback groups. Existing `docs/ingest/` reports retain their
provenance role and are not required for future additions to appear.

Manual imports must use the same fields: assign one stable `ingest_batch` ID to
the accepted batch, one ISO UTC `ingested_at` value to its new records, and the
matching `YYYY-MM-DD` value in `ingested`. Include these fields in the catalog
commit alongside the new records. Do not change existing import identities when
repairing metadata, rerendering thumbnails, or replacing a model derivative.

## Field semantics

- `tier` = curatorial prominence (1 featured … 3 default). Ingest always sets 3; promote by hand.
- `license_tier` = licensing class from the manifest (1 CC0/PD, 2 BY/BY-SA). NC never enters the public catalog.
- `model.sourcePath` is relative to `SOURCE_ATRIUM_DIR`. Raw sources never ship in this repo.

## Env

| Var | Default | Use |
|---|---|---|
| `ATRIUM_VAULT_DIR` | `../atrium-vault` | manifest source |
| `SOURCE_ATRIUM_DIR` | `../atrium` | raw model archive (also read by models:preview) |
| `ATRIUM_VAULT_REPO` | `never-nude/atrium-vault` | release asset downloads |
| `GITHUB_TOKEN` | — | required for private vault downloads |
| `ATRIUM_INGEST_BATCH` | generated unique ID | intentionally name or continue an import batch; overridden by `--batch` |
| `CHROME_BIN` | macOS Chrome path | renderer for images:renders |
| `R2_ACCOUNT_ID` / `R2_BUCKET` | — | Cloudflare account and models bucket for `models:upload-r2` |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | — | R2 API token (Object Read & Write, models bucket only) |
| `R2_PUBLIC_BASE` | `https://models.atrium.earth` | public origin used for preview URLs and verification |
