# Collection organization — 13 September 2026

Six reviewed wing moves and nine additions to existing exhibits make the expanded collection easier to explore. All six wing names, exhibit routes and existing exhibit stops are retained. The geographic wings provide a permanent home; thematic exhibits connect works across those wings.

## Wings

Callender’s *Torso*, Jim Dine’s *Looking Toward the Avenue (Venus)* and Hosmer’s *Puck* move to The Americas & Oceania. *Birds with Foliage* joins the related late-antique Antioch mosaic in Greece & Rome. The Egyptian Mamluk *Door Panel* moves to Africa, and the Western Anatolian *Stargazer* moves to Egypt & the Ancient Near East.

The [wing review](wings.md) explains each move and its sources. Descriptions now reflect the expanded holdings, including North African architecture and modern and contemporary works. Reviewed catalog overrides preserve every historical artwork URL. A featured work must belong to the wing it introduces.

## Exhibits

| Exhibit | Additions | Intended comparison |
| --- | --- | --- |
| Bodies in Motion | Walking Shakyamuni Buddha | A complete walking figure beside Rodin’s incomplete Walking Man |
| Power & Presence | Gold Dinar of al-Muktafi; Clava, Insignia of Authority | Authority expressed through inscriptions, precious material and an object held in the hand |
| Sacred Forms | Abbasid Tombstone; Shrine with Pietà | Distinct forms of funerary commemoration, and the Pietà in a domestic shrine |
| What Survives | Venus of Lespugue; Iznik Jug with English Mounts | Discovery damage, copying and later protective alterations |
| The Work of the Surface | Long Rongorongo Tablet; Nasrid Casket | Undeciphered writing, pierced ivory, gold leaf and later painting |

The Other Kingdom retains its existing selection. Each current exhibit contains twelve stops. Every previous stop keeps its relative order and every lead work remains. New selections and summaries live in current `v3-content.json`; the small `v3.ts` adapter reads these overrides while archived v2 exhibit sequences retain their existing seeds.

The Amarna head caption in *What Survives* now identifies a queen, possibly Kiya or Meritaten, following Berlin ÄM 21245. It describes the unfinished facial areas and surviving neck rather than asserting that the sitter is a daughter of Akhenaten. [Selections, captions and sources](exhibits.json) record the evidence and placements.

During rendered review, the Abbasid tombstone opened on its plain reverse. Its starting camera now faces the inscription. The model rotation, geometry, materials and 71 cm height reference are unchanged; the reference’s camera metadata is synchronized to preserve stale-record protection. The resulting AR geometry was remeasured.

## Validation

The wing acceptance suite checks effective catalog overrides, six corrected assignments, every featured work’s membership and all 1,046 public records. The dimension suite passes with 644 documented references and 22 labelled estimates. The production build generates 3,726 pages.

Browser checks inspect all six wing inventories, all six current exhibit orders and captions, and the archived v2 sequences. They render all nine incoming works at phone width and check the Wings and Exhibitions indexes at phone and desktop widths. Screenshots and full inspection scripts remain in the task workspace under `work/atrium-organization-2026-09-13/`; compact results are retained here.
