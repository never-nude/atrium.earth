# Physical dimensions follow-up — 13 September 2026

The collection-wide review adds 283 physical references: 265 documented references and 18 explicitly approximate references. All 1,046 public pieces have an individual outcome. The current totals are 644 documented references, 22 approximate references, and 380 pieces without a sufficiently supported reference. Of those 380, 151 have published dimensions that still cannot be safely matched to the displayed geometry.

[Coverage](coverage.json) records every piece, source, chosen extent, remaining constraint and serialized AR measurement. [Research review](research-review.json) records the 663 previously uncalibrated pieces individually. The 383 existing references were retained and independently measured after AR serialization. The four previous estimates were also [rechecked](existing-estimates-review.json); their physical reference values remain unchanged.

## What changed

- Original dimensions take precedence when the matching extent survives in the scan. Examples include Pietà at 174 cm, Saint George at 204 cm, and Battle of the Centaurs at 80.5 cm. Battle’s complete upright face determines the mapping of the museum’s unlabelled sequence; this is recorded as an inference, with its remaining width discrepancy.
- Nefertiti uses the original 35 cm crown-to-nose depth. Its display block controls one width extremum and contributes to total height, so neither of those whole-scan measurements is used. Merytaten and Julia Mamaea similarly use intact artwork widths above their mounts.
- Twenty-seven references use a reviewed component or region while retaining the entire scan and its support. Ugolino uses the 197.5 cm marble group, excluding its pedestal. The heart monitor uses its rigid body width, excluding hanging cables.
- Fitted sculpture/pedestal boundaries are labelled approximate, even when the museum measurement itself is documented. Hepworth’s Ancestor I uses the published 280 cm bronze height with an explicitly approximate pedestal boundary.
- Eighty-six records use a clearly labelled measured-cast fallback where the original’s matching extent remains unavailable or differs in restoration, crop or support scope. Original research is retained separately. These references do not assert that the casts are original size.
- The Thinker is explicitly described as a reproduction displayed approximately at the monumental version’s 189 cm height. Its exact scan edition is unverified.
- Battle of the Centaurs and Reclining Pan received reviewed orientation corrections. Battle’s unfinished strip belongs above the figures. Pan’s rocky base is horizontal; its size remains unverified.

Scaling is uniform. A documented reference establishes the selected physical extent; it does not certify every surface or force incompatible width/depth measurements into the mesh. Missing backs, source/model discrepancies, uncertain editions and mismatched identities remain recorded. Discobolus and Louvre RF1703 Virgin and Child, for example, have source/model identity conflicts and receive no transferred measurement.

## Validation

All 666 configured references passed measurement of their actual serialized USDZ geometry. The audit used current asset SHA-256 values, current model transforms, posed vertices, production Quick Look preparation and the installed USDZ exporter. Geometry-only audit exports used neutral materials to avoid re-encoding textures; the separate page tests exercised production materials and the real Prepare AR action.

For each serialized reference, the permitted numerical residual was the larger of 0.2 mm or 0.01% of its target, accommodating normalized integer vertex coordinates. This numerical tolerance is not a claim of museum or photogrammetric measurement precision. Component boundary uncertainty is recorded separately.

The [built-page check](built-page-check.json) verified AR/VR references and estimate labels on all 1,046 public work pages. The production build generated 3,726 pages. Dimension records, model normalization, display supports, spatial/device behavior, exposure preservation and serialized Quick Look tests passed. Chrome phone-layout checks generated and measured AR files for Ugolino, Ancestor I, Pietà and Belvedere Torso; [results](local-browser-result.json). WebKit browser regressions also passed.

These checks do not simulate native iPhone AR placement. The installed USDZ exporter emitted its existing double-sided-material warning on Ugolino and Ancestor I; no JavaScript errors occurred in the four page checks. Physical-device lighting and placement remain native-system behavior.

The release was deployed as commit `97f4b59`. The same four production-page AR export checks subsequently passed against `https://atrium.earth/`, with public assets and current material appearance; [live results](live-browser-result.json).

Reproducible scripts, exact-model caches, component evidence and renders are retained in the task workspace under `work/atrium-ar-vr-correction-2026-09-13/`. The earlier [exposure release](../ar-exposure-2026-09-13/README.md) remains intact.
