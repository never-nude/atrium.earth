# Automatic museum programme

The programme refreshes the existing museum. The homepage remains the entrance;
all works, wings, exhibitions, comparison texts and gallery rooms keep their
existing routes and editorial content.

## What changes

- **Daily:** a homepage sculpture from the explicitly homepage-approved reviewed
  collection, within the existing 15 MiB model budget. Each Monday–Sunday queue
  has seven different works when enough eligible works exist. Up to four relate
  to the featured exhibition; the rest open other parts of the collection.
- **Every four UTC weeks:** one of the eight existing exhibitions becomes the
  focus. It leads the directory and gets a substantial homepage invitation, with
  two other exhibition teasers and a link to the complete directory.
- **Weekly:** approved comparison pairs and an existing 3D room are spotlighted
  using actual membership overlap. A single pair is available to examine in 3D
  on the homepage; both models load only when the visitor chooses them.
- **Consistent arrangement:** daily sculpture, featured exhibition, comparison,
  gallery and AR/VR invitations, six wings, recent additions and random discovery.
  New selections refresh this sequence without moving its destinations around.
- **Weekly:** reviewed lead works change on wing entrances and exhibition cards.
  Exhibition sequences and chronological wing listings retain their order.
- **Continuously:** existing newest-addition views continue reflecting the catalog.

Color is a wayfinding detail: each wing has an art-inspired interface accent;
each exhibition retains its own accent, also used by its weekly programme.
These colors do not alter sculpture materials, textures or lighting.

## Editorial ownership

This is an AI-authored editorial calendar with deterministic scheduling, not a
live AI curator generating new exhibitions or factual text. Selection stays
inside existing review decisions. New imports never become homepage features
automatically. Every existing exhibition remains available every week.

`src/data/museum-programmes.json` contains the focus cycle and short viewing prompts.
Existing exhibition metadata owns titles,
membership, attribution, wall texts and colors. Review these sources to adjust
the programme; no model credentials or paid service is required.

## Clock, publication and checks

One UTC day is resolved per build. Weeks start on Monday. A deployed static
build retains that programme until the next successful deployment; it does not
change beneath a visitor. The Pages workflow is configured for daily builds at
09:17 UTC, as well as normal pushes and manual runs. GitHub may delay scheduled
runs. This schedule becomes active only after the workflow reaches the default
branch.

Run `npm run test:programme` for calendar, review/budget boundaries, geographic
fill, input immutability, missing-content behavior and full cycle checks.
For a dated local preview or build, set `ATRIUM_PROGRAMME_DATE=2026-11-09` (a real
`YYYY-MM-DD` date). Restart the development server when changing this override.
Do not set it in the production workflow: that would freeze the programme.

The local preview can reuse an existing public asset directory through
`ATRIUM_PREVIEW_PUBLIC_DIR`; it does not need another sculpture archive. The
development model proxy is restricted to known preview records and is never
included in the published site. Production delivery continues using the
existing model URLs.
