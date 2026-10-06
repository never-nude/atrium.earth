# Claude Code handoff: large global religious-art acquisition

Updated: 2026-10-06 (America/New_York)

## Resume here

- Repository: `https://github.com/never-nude/atrium.earth`
- Worktree: `/Users/mike/Documents/Codex/2026-09-17/lwt/work/atrium-religious-expansion-20261005`
- Branch: `codex/religious-art-global-20261006`
- Logical batch ID for every chunk: `religious-art-global-20261006`
- Goal: one large, diverse logical batch of about 200 candidates, acquired in sequential 50-work write chunks, visually reviewed, then published together. The user has authorized publishing to Atrium.
- `origin/main` at the start of this handoff: `f5b51c9147105b07f6df5c42d03fe807cc3f2cd9`.

Read `AGENTS.md`, `STATUS.md`, `INGEST.md`, and this file before changing anything. Preserve the sequential chunk workflow: only one acquisition run may write the cumulative catalog at a time.

## Completed and pushed on this branch

1. Chunk 1 plan: `docs/ingest/religious-art-global-20261006-chunk-1-leads.json` (50 candidates).
2. Acquisition run [37540181354](https://github.com/never-nude/atrium.earth/actions/runs/37540181354) succeeded:
   - 50 fetched
   - 42 accepted
   - 8 rejected by geometry integrity gate
   - 42/42 accepted models uploaded to R2
   - 42 thumbnails and posters rendered
   - 27 works require human orientation review
3. The cumulative Chunk 1 review commit is `ef35ebf306c038923139348fab3305c66b4c811b`.
4. The exact 27-work orientation list is tracked at `docs/ingest/religious-art-global-20261006-chunk-1-orientation-round2.txt`.
5. Sharded orientation run [37545902463](https://github.com/never-nude/atrium.earth/actions/runs/37545902463) was in progress when this handoff was written. It should publish an orphan review branch named `claude/atrium-orientation-sheets-religious-art-global-20261006-chunk-1-round2` when successful.
6. Chunk 2 and Chunk 3 lead files are complete and tracked by the handoff commit:
   - Chunk 2: 50 candidates, about 2.925 GB raw; Hindu 8, Buddhist 29, Jain 2, East Asian/Shinto/Daoist/popular religion 9, Sikh 2.
   - Chunk 3: 50 candidates, about 3.724 GB raw; Nordic/Norse 15, Celtic/megalithic 22, Olmec 1, Hindu 1, Roman provincial mother-goddess 1, Greco-Roman/syncretic 10.
   - All 100 are catalog-new at preparation time, have unique slugs and source UIDs, and include download/license evidence.
7. `docs/ingest/religious-art-global-20261006-chunk-4-shortlist.txt` preserves 50 source UIDs for a fourth chunk. It is a shortlist, not a finished lead file. The final live verification was interrupted by a Sketchfab HTTP 429, so revalidate each candidate before acquisition.

## Mandatory Chunk 1 corrections before publication

- Drop `ancient-near-east/assyrian-winged-genius-ec414d`. It exactly duplicates the established `assyrian/winged-genius-mia`: same Sketchfab UID `ec414d739155409eb059299d412ecce4` and same 8,496,848-byte GLB. Keep the established record, which has stronger accession/dimension metadata. Remove the new record from `catalog.json`, `orientations.json`, `previews.json`, `renders.json`, its new thumbnail/poster, and from this logical batch's final slug list. The already-uploaded R2 object can be left unused or removed through the established R2 cleanup procedure.
- Verify `greece-rome/bust-of-tanit-or-demeter-785e5d`: “Unknown Sicilian coroplast” conflicts with its stated Punic Ibiza origin. Prefer a source-supported “Unknown Punic/Ibizan coroplast” or a neutral “Unknown maker.”
- Decide whether these weaker/repetitive records meet the collection bar:
  - `ancient-near-east/sumerian-cylinder-seal-vk5738-4-b2b2bd` (religious connection is unclear)
  - `europe/stamp-of-the-jewish-religious-congregation-in-oswiecim-c2913c` (administrative object)
  - the five low-detail wooden-synagogue reconstructions (distinct sites but repetitive digital reconstructions)
- Closely inspect the componentized meshes named in `last-report.json` warnings, especially the five synagogue reconstructions, Córdoba and Arslanhane mihrabs, Nine-Dome Mosque, Malindi Mosque, Sidi Abid niche, Sinan Pasha Mosque, Palki Sahib, and Miri Piri Nishan Sahib.
- Keep all eight rejected candidates rejected unless a genuinely better source is found.

After the exact duplicate is removed, Chunk 1 has at most 41 publishable accepted works before any discretionary curation drops.

## Next commands

Check the orientation run:

```bash
gh run view 37545902463 --json status,conclusion,url,jobs
```

After it succeeds, fetch the orphan sheet branch into a temporary worktree or inspect its `sheets/` tree. Review all ten labeled variants for every one of the 27 slugs. Apply selected rotations/view directions to `src/data/orientations.json`, rerender the affected thumbnails through `rerender-thumbnails.yml`, and inspect the complete 41-or-fewer-work Chunk 1 contact sheet before accepting it.

Chunk 2 may run only after the current cumulative branch (including every accepted Chunk 1 correction) is pushed:

```bash
gh workflow run acquire-leads.yml \
  --ref codex/religious-art-global-20261006 \
  -f leads=docs/ingest/religious-art-global-20261006-chunk-2-leads.json \
  -f batch=religious-art-global-20261006 \
  -f base_ref=codex/religious-art-global-20261006 \
  -f inline_orientation=false
```

When Chunk 2 succeeds, fetch its generated review branch, audit it, fast-forward this cumulative branch to it, correct/review it, push this branch, and only then dispatch Chunk 3 with the same logical batch ID and this branch as `base_ref`. Repeat for the finished Chunk 4 lead file. Never run two catalog-writing acquisition jobs concurrently.

The acquisition workflow writes to review branches and never touches `main`. Do not publish until every accepted work in all chunks has passed rights/provenance, duplicate, geometry, orientation, thumbnail, metadata, wing, and AR-size review.

## Publication behavior and validation

- Newest Additions has a 40-work minimum and expands to include the entire latest logical batch. Keeping the same `ingest_batch` value across all chunks makes the final large batch appear together.
- Pipeline support for 180–240+ logical batches is already on `main`; a tested 4×60 continuation retained all 240 works.
- Before publication run at least:

```bash
npm run test:additions
npm run test:review-artifacts
node scripts/test-iconic-scan-upgrades.mjs
npm run verify:assets
npm run build

git diff --check
```

Then merge/rebase safely against freshly fetched `origin/main`, push the reviewed exact tree, watch the GitHub Pages deployment, and run dynamic live verification against the complete final batch. Record exact source commit, Pages run, deployment, live work-page count, model/thumbnail hashes, Newest ordering, and AR/viewer controls in `STATUS.md`.

## Relevant already-live work

The eight iconic scan upgrades (David, Pietà, Moses, Venus de Milo, Discobolus, Laocoön, Dying Gaul, and Belvedere Torso) are already deployed and verified. Do not redo them. Their live source commit is `152924a35b2a00d6e8a1da863077af391e93c1e2`; deployment record commit is `f5b51c9147105b07f6df5c42d03fe807cc3f2cd9`.
