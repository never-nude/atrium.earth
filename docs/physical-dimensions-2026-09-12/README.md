# Physical dimensions and AR/VR scale review — 12 September 2026

All 1,046 public collection entries now have an explicit dimension-review record. This is an audit of the entire collection, not a claim that every scan has verified physical scale.

| Result | Entries |
| --- | ---: |
| Documented physical dimensions | 764 |
| Approximate physical dimensions | 52 |
| Unresolved dimensions or identity | 229 |
| Variable dimensions | 1 |
| Calibrated scan using documented dimensions | 379 |
| Explicitly approximate starting scale | 4 |
| Scale remains unverified | 663 |

The previous release had 41 documented calibrations and one approximate starting scale. This release adds 338 documented calibrations and three approximate starting scales. Of the 663 entries without verified or approximate calibration, 385 have documented dimensions but still require matching geometry, support boundaries, measurement axes, or version identity.

[coverage.json](coverage.json) lists every public entry, its dimension status, scale status, source, and remaining limitations. The canonical measurement records and accepted references are in [physical-dimensions.json](../../src/data/physical-dimensions.json). Archived files called proposals or reviews preserve the research process; the canonical records determine what the site actually uses.

The [phone-scale follow-up](../phone-scale-2026-09-12/README.md) adds six of these calibrations, including Laocoön’s full-size historical restoration, and preserves prepared size in Apple Quick Look. Its additional geometry reviews supplement the initial audit below.

## Measurement policy

- A source measurement applies only to its identified artwork, version, accession and stated extent. Artist-authored models and reductions remain distinct artworks; reproductive casts use documented original dimensions when their geometry matches.
- A cropped head cannot inherit a whole statue’s height. Source dimensions that include a frame, mounting plate, detached lid or pedestal cannot silently apply to a different combination of parts.
- Museum dimension sequences remain unlabelled where the source does not label axes. A separate geometry review can select an axis when the current model and independent dimensions support that interpretation.
- Inches are converted exactly to centimetres with the original values and units retained. Published centimetre/inch disagreements remain explicit evidence conflicts.
- Scaling is uniform. No axis is stretched to conceal a mismatch in the scan’s proportions. A single verified reference establishes size, while other available measurements cross-check the interpretation; the reconstructed mesh is not a metrological measurement of the original.
- Every accepted reference is tied to the exact preview URL, orientation and recorded asset SHA-256. A URL/orientation mismatch disables the reference. The hash records the bytes reviewed; it is not an extra runtime download check.

## Model and support review

This pass records 791 geometry checks across 777 distinct models in [geometry-manifest.json](geometry-manifest.json), including repeated checks when orientation or measurement scope needed correction. Another 31 unchanged, already-calibrated entries retain the evidence in [the previous review](../physical-dimensions-2026-09-09/calibration-review.json). Current documented entries therefore have either this pass’s geometry outcome or the previously accepted evidence. An outcome can be a reason to withhold calibration.

Source and geometry reviews are grouped by institution in this directory. They retain exact identities, scoped measurements, component conflicts and per-object decisions. Large museum downloads, model files and rendered inspection sheets remain in the local `work/atrium-scale-all` research folder rather than being duplicated in Git.

The current display recommendations cover 222 entries. Reviewed small freestanding pieces also qualify for the existing automatic VR plinth rule. Wall pieces, captured bases and floor objects override that rule. Fitted wall mounts and special cradles remain explicitly described as pending; this release does not implement new wall-placement geometry.

Two objects now use a measured component within the scan: the Abbasid dinar and Casimir the Restorer. Their recorded `extentFraction` identifies the reviewed component’s share of the entire scan’s axis extent. The model, its captured surroundings and any base retain the same uniform scale. The exact mesh name, vertex bounds and reference procedure are preserved with each record.

Attis’s orientation was corrected from lying sideways to upright; physical calibration remains withheld because the dimensions still disagree with the scan. Catalogue overlays correct several accession mismatches and identify Young Slave, Esquiline Venus, and Benedetto da Maiano’s Saint John the Baptist while preserving existing URLs.

## Representative results and limits

- Michelangelo’s David: original height 5.17 m; its gallery pedestal is absent from the scan.
- Donatello’s David: original height 1.58 m applied to the matching reproductive cast.
- Young Slave: original height 2.56 m, following identification of the previously generic “Prisoner” model.
- Mia’s deliberately enlarged VR miniatures: restored to their documented small physical dimensions.
- Augustus of Prima Porta and Sphinx: both models are head/bust crops; full statue or monument dimensions are withheld.
- Salmacis: the Louvre and Monaco versions have different measurements. Those measurements are not treated as interchangeable.
- Dubuffet remains an approximate 6.7056 m starting height. The other approximate references are Mia’s cylinder seal, Woman Leaf, and Falling Leaves; none is presented as verified size.

The remaining entries need a reliable source measurement, a firmer identification, an independently defined component boundary, or repair/replacement of incomplete or distorted geometry. Unverified size stays adjustable and is visibly labelled. No measurements were invented to close these gaps.

## Validation

Passed the dimension-record and reference checks, model normalization checks, device/WebXR tests, display-support tests, and serialized Apple USDZ tests. The dimension check requires a review status for every public entry and validates measurement units, selected measurement indices, current preview/orientation matches and component references.

The real Casimir page’s normal Prepare AR action also produced a USDZ whose independently parsed sculpture height matched 2.581 m within export numeric tolerance, while retaining the captured surroundings. [Independent browser review](component-browser-review/README.md) documents that check and its local-origin accommodation. This does not claim a physical iPhone or headset session was tested.

The production build generated 3,726 pages. All 1,046 artwork pages were checked for correct reference attributes and absent references on unverified work. Chrome, Firefox and WebKit browser checks passed screen viewing, mobile layouts, handoff/sharing, permission denial and actual Apple AR export preparation. A WebKit focus-return failure found during that pass was fixed by explicitly restoring focus to the AR opener when its dialog closes.
