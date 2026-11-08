# Prepared AI-authored visits

The optional Surface route is a six-work, approximately five-minute visit within
the existing61-work exhibition. The complete exhibition remains available.
No object records, materials, models, normalizations or source assets are changed.

`src/data/curated-visits.json` uses schema `atrium-curated-visits/1`, with editions
under `visits[exhibitionSlug]`. The current edition is `surface-six-20261107`.
It is AI-authored and prepared in advance. Automatic generation remains off;
`provenance.unattendedGeneration` is explicitly false. Publication and live
deployment are separate from preparing this edition.

## Contract and evidence

Each edition has `id`, `title`, `summary`, `durationMinutes`, `provenance`,
`rationale`, `facts`, six `stops`, and `closing`. Each fact includes a stable
`id`, `workSlug`, an exact existing-caption excerpt as `text`, `recordUrl`, and
`sourceRef`. Each stop has `id`, `workSlug`, `title`, a concrete `prompt`, short
`reading`, `whyHere`, `factIds`, and `nextConnection`. The last connection is empty.

`validateCuratedVisit` checks membership, uniqueness, actual source URL bindings,
caption excerpts, six working previews within15 MiB each, explicit authorship,
and the absence of unattended generation. These checks constrain evidence and
delivery; they are not an independent art-historical review of free prose.
`curatedVisitFor(exhibition)` resolves validated records without mutating them.

The six stops use the four-faced helmet mask, Long Rongorongo Tablet, Nasrid
Casket, Bowl with Courtly Scene, Pevsner's Developable Surface, and Chillida's
How Profound Is the Air. Connections describe a viewing sequence, not historical
influence. Camera presets are not inferred. The source-normalized initial views
and existing Viewer controls remain in use.

## Interaction and continuation

Six inert HTML templates hold the prepared stop markup. Exactly one stop is
connected to the guide at a time. Before removal the controller dispatches
`atrium:viewer-dispose` with `{root: viewerElement}`; after connecting the next
stop it dispatches `atrium:viewer-mount` with the same shape. The existing Viewer
owns initialization, loading, failures, listeners and GPU cleanup. Reduced-motion
preferences are respected; guided models do not start automatic rotation.

Links to a record carry `?exhibition=the-work-of-the-surface&visit=surface-six-20261107&stop=1`,
with1-based stop numbers. Return links use the same query and `#curated-visit`.
The complete route uses `#all-exhibition-works`; its61 works are never filtered
by guide selections. Without JavaScript, the existing complete exhibition remains
available and the page explains that interactive guide navigation needs scripting.

Run `node scripts/test-curated-visit.mjs` for data/evidence/URL checks. Browser
verification must separately cover keyboard navigation, rapid next/back changes,
fullscreen, model failures and return from object records.
