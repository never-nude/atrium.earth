# Atrium homepage handoff

## User direction

Build and refine the existing museum homepage. Keep the approved wing and
exhibition colors and show interactive local previews. **Do not publish, push,
merge to main or activate a public deployment.** The user also requested short
thumbnail titles without parenthetical qualifiers and a careful duplicate cull.

Use branch `codex/site-clarity-20261106`. The earlier entry-page, personal HUD,
dials and Point of Contact exhibition experiments are shelved on separate
branches; they are not the current design. Read `AGENTS.md` and the latest
`STATUS.md` before continuing. Recent main catalog work was preserved through
local merge `51eacf83`; fetch and inspect new concurrent work before any later
release. Preserve all existing source archives and serving asset maps.

## Homepage implemented

The reading order is fixed: daily interactive sculpture, featured exhibition,
one interactive comparison, gallery and AR/VR invitations, six wings, recent
additions, random discovery. The featured show has two secondary teasers and a
link to the complete directory. Both comparison models load on deliberate
activation; their source transforms and appearances remain independent.

The main exhibition stays featured for four UTC weeks. Daily hero queues,
weekly comparison/room spotlights and weekly wing/exhibition lead rotations
continue within the existing reviewed pools. This is an AI-authored scheduled
calendar, **not a live system generating new exhibitions or factual text**.
See `docs/museum-programme.md` for the clock and editorial boundaries.

Thumbnail captions use `shortWorkTitle()` in `src/lib/work-titles.ts` across V3,
legacy and V2 cards, homepage artwork captions and paired exhibition thumbnails.
Formal titles, accessible identification, credits and record details retain
their source wording. No raster thumbnail files need regeneration for this edit.

## Duplicate decisions

`asia/ganesha-mia` is a confirmed repeat of Mia object81675/accession2003.198.
The kept representation is `asia/ganesha-java-mia`, already homepage approved.
The older complete record is retained with `hidden:true`; old canonical and
legacy URLs redirect to the kept work. Sacred Forms uses the kept record with
its existing caption. No models, images or source metadata were deleted.

The bounded audit and evidence are in
`docs/curation/duplicate-audit-20261106.json`. Benin leopard mask and Esquiline
Venus remain pending exact alternate-object/cast confirmation. Different physical
casts, maquettes, materials or component suffixes must not be collapsed from a
similar title alone. Current counts: 3,037 raw records, 3,018 public, 19 hidden;
featured review remains250 and homepage budget-eligible pool remains192.

## Preview and checks

Local preview URL: `http://localhost:5182/`. Useful anchors:
`/#featured-exhibition` and `/#look-closely`.

Start from this checkout with the existing dependencies. For a sparse checkout,
set `ATRIUM_PREVIEW_PUBLIC_DIR` to an existing protected public asset directory
and run `npm run dev -- --port 5182`. The serve-only proxy reads approved model
records and streams existing assets without another sculpture archive. Keep
production model URLs unchanged. Avoid the obsolete README legacy import step.

Passed checks: programme tests over32 UTC weeks and28-day focus boundaries;
16 short-title cases; Spatial device/viewer/material tests; addition grouping and
wing tests; served homepage hierarchy/counts; both Ganesha alias301s and affected
work/exhibition pages. Full build result is recorded in the latest STATUS entry.

Browser observations include the real homepage sculpture rendering/rotation,
featured exhibition and revised phone layout at the actual402px pane width,
with no horizontal overflow. The preview controller later timed out. Viewport
override requests did not change the measured402px pane, so320/390/800/1280px
visual checks and final comparison activation/fullscreen are **not claimed**.
No final screenshot file was saved before that interruption. The preview itself
continues serving successfully. Reconnect and reload before judging stale tabs.

The existing `test:spatial-access` failure at Laocoon and obsolete1,793-work
assertions were already recorded; this task does not count it as passing.
This sparse checkout's build verifies source/HTML, not a complete production
asset package. The ordinary complete-checkout release gate remains required.

## Next review

1. Restore browser inspection, reset temporary viewport settings and verify
   desktop/tablet/phone layouts, especially the enlarged hero copy.
2. Activate each comparison separately; test turning, reset, scrolling, keyboard
   access and fullscreen when supported. Unsupported fullscreen controls are
   hidden. Check save/preview controls on recent additions and short captions.
3. Inspect gallery and AR handoff links; distinguish reviewed, estimated and
   unknown physical sizes. Do not claim physical-device AR verification.
4. Capture review screenshots and investigate the two pending duplicate pairs
   using the evidence checklist. Keep publication pending the user's instruction.


## Place/time globe continuation — 6 November

The user approved a vivid dark-ground globe alongside the existing wings, with
The Expanse opening/Shenzhen/cyberpunk atmosphere as references. They rejected
the first schematic homepage wireframe. It has been replaced by an actual large
interactive Earth using real bundled Natural Earth land, directional shading,
illuminated coasts and colored origin points. The homepage wrapper is a section,
with a separate CTA; drag gestures never navigate accidentally.

Latest user direction: use controls similar to the sculpture viewers for globe
zoom and rotation. Both views now have +/−, Auto-rotate, Reset view and Full screen.
The renderer also implements arrow/Home/+/- keyboard navigation and touch pinch.
Default explorer rendering rests when idle; invitation rotation is initially on,
pauses on manual drag and honors reduced motion/offscreen/hidden states. The
homepage renderer imports lazily near the viewport. Unsupported/denied fullscreen
controls are hidden. Keep all controls outside artwork images.

Preview `http://localhost:5182/#explore-the-world` and `/world/`. The full explorer
adds country/region selection, a compressed early-time range, exact BCE/CE dates,
real work results and uncertain-origin access. Existing wing assignments remain
unchanged. Their copy now explains historical tradition and geography. This does
not revive the discarded theme-dial HUD.

Data:3018 public works;1858 placed/1160 unplaced at120 approximate anchors;
1688 dated/1330 undated,5500BCE–2026CE. `docs/world-collection-data.md` defines
origin/cast/date evidence rules. Public working captions retain short-title
formatting; record details and full image identification remain available.

Latest full source build:8354 pages/5215 redirects. `test:world-collection`,
`test:world-time`, programme, work-title and wing checks pass. Existing additions
also passed during the globe pass. A built-payload check verifies all3018 records,
120 places, bundled land/sitemap and seven top-level homepage modules.

Browser observations supersede the earlier no-screenshot checkpoint: native Safari
showed clear comparison faces and Nefertiti activation tools; globe selection,
period filters, map mode, slider drag, uncertain origins, reset, expanded-result
focus and the revised dimensional homepage Earth/pause state were observed.
An isolated temporary iframe harness reviewed the initial globe at320/390/800/1280
CSS pixels;320 header overflow was fixed. Final toolbar wrapping, physical pinch
and uninterrupted fullscreen framing remain release-review items. Some later
native actions were interrupted by concurrent foreground/page changes; do not
count those attempts as completed tests. Development component CSS had retained
the old invitation styles; restarting the owned server fixed the rendered layout.

The old schematic invitation screenshot is obsolete. Sibling outputs contain the
button-fix proof and initial globe/responsive screenshots; the revised dimensional
Earth was observed inline in the chat. Do not substitute old proof for the new
homepage version. No deployment, push or main merge has occurred. Preserve and
reconcile concurrent catalog work before any authorized release.


## Latest: compact actual explorer on homepage

This supersedes the separate homepage Earth invitation described above. The user
asked for an abridged version of the actual `/world/` experience. Both homepage
and full page now directly render `src/components/WorldExplorer.astro`. Keep
visuals, origin labels, marker colors, controls and date behavior shared.
`WorldInvitation.astro` and `home-world.js` were removed; do not restore a separate
homepage presentation without a new user direction.

Compact mode has the same Globe/Map views, selectable places, zoom/rotation/reset/
fullscreen controls, time range and collapsed exact dates. It shows two matching
cards with a shown/total count. Both continuation links retain place, exact years
and presentation mode. Full mode reads those validated URL fields and shows three
initial cards, with its existing explicit expansion. Unique instance-prefixed IDs
and conditional heading levels preserve the homepage hierarchy.

`world-payload.ts` generates one versioned `/world/collection.json` resource for
both routes; metadata and renderer are loaded near the compact viewport. No
sculpture files were downloaded or copied. Final built HTML is61314bytes for the
homepage and15164bytes for the world page. The shared JSON contains3018works and
120places; local gzip measurement186014bytes. Base-path URLs remain supported.

Validation: `test:world-state` (six cases), world time/collection, programme and
work-title tests pass. Full source build8354pages/5215redirects passes. Built checks
confirm a common metadata URL, unique IDs, correct variant selectors and seven
unchanged top-level homepage modules. Native Safari verified homepage Egypt,
3000–1000BCE and Map mode continuing into the full page with the same24matches.
A320CSS-pixel iframe layout review passed; physical pinch/fullscreen and complete
production-asset checks from the earlier gate remain separate. The temporary
review server was stopped and Safari returned to the main homepage preview.

Preview `http://localhost:5182/#explore-the-world`. This work is still local,
unpushed and unpublished. Review the compact experience before any release, and
preserve/reconcile concurrent catalog updates rather than replacing main.


## Latest: authorized production release, five geographic wings

The owner's explicit “deploy this all” supersedes this task's earlier local-only
restriction. Concurrent acquisitions and surface repairs were merged in
`2bbfd978`; preserve them. Current public collection has 3,022 works.

The Firebird and Play-Doh replace the rejected Nefertiti/Augustus homepage
comparison. Both remain within the existing reviewed homepage pool and budget.
The rejected unordered object pair cannot return through another title or order.
The current four-week focus spotlights “Colour Takes Shape”; other focuses retain
their approved comparison rotation.

Wings now use Europe, Asia, Africa, Americas and Oceania. See
`wings-geography.md` for assignment evidence and counts. Legacy wing URLs explain
the relevant new destinations. Unknown or cross-region origins remain accessible
through `/wings/unfiled/` and the full collection. No sculpture source metadata,
materials, geometry or individual work route changed in this regrouping.

The compact actual explorer remains on the homepage. Fullscreen Map keeps its
exit control; Globe restores its usual controls. Native Safari confirmed both
new sculptures and independent orbit, plus fullscreen Globe and Map; the Mac
locked during exit, so final return-to-page and post-release visual checks are
not yet claimed. Physical-touch and physical-device AR are not claimed.

All relevant metadata/programme/world/wing/Spatial checks pass. Complete
production assets must be checked by the ordinary full-checkout Pages workflow,
not the sparse local artifact. Build/deployment/live confirmation follows in
STATUS.md. No local source cleanup or asset offload is part of this release.


## Hosting follow-up: bounded CDN transfer

The first production source/asset/build gates passed, but two publication
attempts of `1e87c177` hit GitHub Pages' ten-minute hosting limit. A timeout
extension was inspected and discarded: the official action hard-caps it.

To reduce the release, exactly20 existing Pages-local previews totaling
153,125,124bytes were copied, unchanged, to the existing sculpture CDN.
R2 run42358414500 passed source Git/SHA/byte checks and complete public
readbacks with production CORS/MIME/GLB2 validation for every object.
Only their20 preview URL fields changed. All original Git/model files remain;
there was no local offload or new backup claim. Source/delivery proofs and
the pinned transfer manifest are under `docs/ingest/pages-delivery-20261107-*`.
Do not blindly rerun the historical staging manifest after migration: it
intentionally requires the old committed URL bindings to prevent stale transfers.

The post-build Pages package now has an explicit1,000,000,000-byte limit
before upload. Full runner size and final production status are recorded in
STATUS.md when complete. Keep the shared explorer, five geographic wings,
new colorful comparison and all concurrent acquisitions/surface repairs.


## Production completion

Release `8e009f95d34dc74c8205d86d007b5173a672f1ef` is live via successful
[Pages42358673304](https://github.com/never-nude/atrium.earth/actions/runs/42358673304).
The complete package passed at966,375,043bytes; publication took36seconds.
All release checks and15live museum routes pass. New comparison/fullGLBs and
posters, sharedJSON/land,8script/style assets, all5wings/3legacy entrances,
20CDN pagebindings/headers and the prior20fullhash receipts are verified.
The normal daily09:17UTC refresh remains configured.

The Mac locked during the earlier native preview exit transition. Final live
UI observation/exit return and physical-device touch/AR remain unverified;
local native observations and production HTTP/asset checks are distinguished
in STATUS.md. No further source change or asset offload is pending for this
release. Preserve all originals and the authenticated transfer proofs.


## Native production check completed after unlock

On2026-11-07 the owner unlocked the Mac and the pending Safari review completed.
Both live comparison models loaded with textures and rotated independently.
The compact live globe rendered and responded to zoom, drag and reset.
Fullscreen Globe and Map rendered correctly; the Map exit action returned to
the normal homepage with Map mode preserved and its globe toolbar hidden.
The earlier locked-screen UI/exit qualifications are closed. Physical touch
and physical-device AR are not established by this desktop review.
No source or deployment change was needed.


## Static gallery delivery regression found during Awwwards review

The separately built gallery bundle retained two old Eternal Idol URLs after
the20-model CDN transfer. The Rodin room exposed one failed work during live
review. Both URLs now match the verified R2 preview, and the entry query is
bound to the complete bundle digest. Model bytes and presentation are unchanged.
`test:spatial-museum-bindings` now gates every production release against all47
room works and94 compiled URL copies. Publication/live confirmation is in
STATUS.md. Preserve this check when rebuilding the independent gallery runtime.
