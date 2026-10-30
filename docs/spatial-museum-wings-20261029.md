# Museum wings and focused rooms — 29 October 2026

**Prepared for public frontend publication.** The museum contains eight rooms, 47 unique compositions and four active wings. Both added native-AR scenes are accepted and uploaded with complete public verification. The final native framework and main-site production builds pass. Public frontend publication and final live verification remain pending.

## A museum that can grow room by room

The museum directory now follows **wings → focused rooms → individual works**. Room counts and exhibit counts come from the reviewed collection, with no fixed six-room or six-work layout. Each composition has one permanent room assignment. Explicit object and composition identities prevent alternate scans, titles or casts from becoming duplicate exhibits in another room.

The homepage's spatial-museum section reads its wing, room and work totals from the published museum manifest. It provides an entrance to the museum, direct wing links and individual room links. Inside the museum, the map groups rooms by wing; room navigation and the works directory provide other routes through the same installed exhibits.

The registry also supports an artist gallery with a reviewed artist identity. Every work in that room must match the artist identity, and the same object/composition ownership rules apply across artist and thematic rooms.

## Prepared rooms

| Wing | Room | Works |
| --- | --- | ---: |
| Ancient worlds | Faces of Ancient Egypt | 6 |
| Ancient worlds | The Classical World | 6 |
| Sacred images of Asia | Compassion and Contemplation | 6 |
| Sacred images of Asia | Divine Gestures | 6 |
| European devotion | Painted Devotion | 6 |
| European devotion | Devotion in Lesser Poland | 6 |
| The modern figure | The Human Gesture | 6 |
| The modern figure | Rodin: The Figure in Marble | 5 |

The first six rooms retain all 36 existing exhibits, arrangements and prepared native-AR bindings. The two added rooms use 11 existing catalog objects. No new catalog acquisition is part of this release.

### Devotion in Lesser Poland

Six works connect church worship, procession and household devotion around Kraków: a Palm Sunday donkey group, Christ in Gethsemane, the resurrected Christ, Saint Stanislaus, Saint Anthony Abbot and a shrine Pietà. Their native GLBs retain the captured surface textures, color and original supports. Four have verified dimensions, shown in green; two retain documented approximate dimensions, shown in yellow.

### Rodin: The Figure in Marble

Five distinct compositions form the first artist gallery: *The Eternal Idol*, *Eve (Reduced Version)*, *Figure of a Woman “The Sphinx”*, *Morning* and *The Hand of God*. Labels identify the particular museum marbles and their dates, versions and collaborators where documented. All five retain approximate/yellow physical heights. Smoothly finished bodies and roughly worked marble supports remain visible in the captured textures. Known capture limits, including the uncaptured underside of *The Hand of God*, remain disclosed.

Together, the eight rooms contain 17 green and 30 yellow works, with no unknown-dimension exhibits. One scene metre represents one physical metre; approximate source measurements retain their uncertainty. Display stands add their own height beneath each sculpture.

## Native AR and publication safeguards

The six previously published Apple AR scenes keep their exact asset bindings. Changes to a model, pose, physical height, arrangement, label or rights record invalidate a prepared file. Both added rooms now have accepted native scenes, and all eight rooms pass the complete-AR inventory gate. Apple supplies native AR lighting; physical iPhone placement, appearance and performance remain separate device checks.

The two new native scenes total 81,393,095 bytes. [R2 upload run 40916150519](https://github.com/never-nude/atrium.earth/actions/runs/40916150519) succeeds with immutable writes and complete public SHA-256/byte, USDZ MIME and production-origin CORS verification. The public-safe [R2 receipt](spatial-museum-wings-20261029-r2.json) records both exact delivered assets. Native geometry, material, texture, physical-scale and visual acceptance checks are complete.

The R2 release workflow now accepts an explicitly reviewed selection of **1–32 rooms**. A new room's immutable package can be hosted before its frontend is published. The pinned release archive and manifest define the selected set; exact flat filenames and manifest/archive membership are required. Full archive and member hashes, byte counts, stored/aligned USDZ structure, safe USTAR handling and all-source preflight remain enforced. Uploads use conditional no-overwrite writes followed by complete public SHA-256, byte, MIME and production-origin CORS verification. Limits are 512 MiB per room and 2 GiB per selected package.

## Validation completed

- Seventy registry checks pass on the eight-room, 47-work data. They cover variable room/exhibit counts, bounds, wing membership, documented scale, unique objects/compositions, artist identity, lighting coverage and expansion beyond the former 36-work lighting roster.
- All eight current native-AR bindings pass 50 Apple-link checks, with no pending scene. The six original bindings remain unchanged.
- Selected-room upload/staging regressions pass for the original six-room release and one-, three- and seven-room selections. Bounded manifest tests include 32 rooms. Unsafe, duplicate, missing, extra, oversized and corrupted inputs fail; signed uploads, full public-response verification and immutable reruns remain tested.
- Both added groups have individually reviewed production thumbnails and four native geometry/color views per work. Their dimension scope, original supports, material state and lighting evidence remain recorded.
- Native framework and main Astro production builds pass. All 17 generated public museum files are copied byte-identically. The compiled homepage has seven content sections, eight museum-room links, four wing links and the 47-work museum roster.
- The matching owner-private source preview is successfully deployed from source commit `df3418f450db28e1aff72a9476ad2cf87576c280`; its audience is unchanged. Public frontend deployment remains a separate release step.

The core catalog, source/preview model maps, existing appearance and scale records, ordered 40-work Newest selection, centered homepage hero and three AR example cards are preserved. The homepage places Newest and collection wings before the spatial-museum entrance, then AR examples, comparisons, exhibitions and the timeline. Its museum counts and links come from the manifest. Existing six-model GLB upgrades remain unchanged. A final source audit confirms the hero, three AR example bindings and protected catalog/library data are unchanged, and the original six rooms retain their exact rosters and native assets.

## Michelangelo eligibility

The current 24 Michelangelo records all serve GLBs, while their recorded source assets are STLs. A GLB serving format alone does not establish a textured native scan. David's verified serving derivative contains no image textures or vertex colors; its upgrade preserves more geometry from the same original STL. Its current model version does not match the earlier physical-scale calibration, so the normalized catalog correctly presents it at an adjustable one-metre default with unknown dimensions.

There are currently **zero Michelangelo candidates meeting this expansion's textured native-GLB eligibility policy**. No Michelangelo room is included in this release. The earlier six-upgrade provenance and limitations remain documented in [Local GLB quality review](GLB_LOCAL_REVIEW_20261026.md).

## Remaining release checks

Publish the reviewed main-site frontend and record final live page, hierarchy, room-link and asset checks. Native acceptance, immutable delivery, all eight current bindings, both production builds and the owner-private source deployment are complete. This document does not yet confirm public frontend deployment.
