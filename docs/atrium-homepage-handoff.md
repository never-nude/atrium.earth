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
