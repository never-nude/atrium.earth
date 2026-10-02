# Three AR / VR dimension statuses

All 1,046 public works now have one of three statuses:

| Status | Color | Works | Starting size |
| --- | --- | ---: | --- |
| Verified dimensions | Green | 248 | Existing strictly reviewed reference; measured casts remain identified |
| Approximate dimensions | Yellow | 614 | Best available estimate from recorded measurements, catalogue dimensions or work descriptions |
| Dimensions unknown | Red | 184 | Existing adjustable display default |

The visitor-facing estimate explanation is: “Scaled to Atrium’s best estimate from listed dimensions and work descriptions; actual size may vary.” No numerical accuracy tolerance is claimed. The chosen measurement and its source remain available on each work page.

La Chiffonnière again starts at 6.7056 metres (22 feet), with the approximate label. The [Public Art Fund exhibition record](https://www.publicartfund.org/exhibitions/view/la-chiffoniere/) confirms 22 feet; uncertainty about the scan's round base remains part of the existing record.

## Resolution

The 248 existing verification decisions and their evidence fingerprints are unchanged. Estimates are resolved independently. Existing geometry references retain their axes, component fractions, orientation matching and downloaded-asset hashes. Other numerical records and catalogue descriptions supply estimates without requiring a primary-source verification claim. Explicit heights map to model Y; unlabelled sequences use their largest measurement on the model's longest oriented side. Scaling is uniform. Bases and mounts may affect these estimates and are disclosed.

Fourteen known mismatches remain unknown: measurements of a complete monument cannot size a cropped head, and individual component measurements cannot size a spaced multi-object arrangement. The rest have no usable numerical estimate. Qualitative descriptions such as “life-size,” unknown units, and arbitrary mesh coordinates do not become physical measurements. Every outcome and selected source is in [coverage.json](coverage.json); regenerate it with `node scripts/audit-spatial-dimensions.mjs docs/approximate-dimensions-2026-09-15/coverage.json`.

The three statuses appear on cards, both collection filters, work-page controls, object records and the AR / VR dialog. Green references remain fixed-size. Approximate and unknown works retain resizing; a requested virtual stand keeps its prepared physical size in native Apple AR. The upright museum-label implementation is unchanged.

## Validation

- Dimension resolution, conversions, description fallback, all 1,046 access decisions, and the existing strict evidence checks pass.
- WebXR scene/session checks pass. Production USDZ serialization tests preserve uniform scale, component extents, support placement, and the 6.7056 m Dubuffet / 0.254 m drum estimates on test geometry.
- All 1,046 built work pages were checked against the coverage records for status, physical reference, default-size fallback and asset-hash requirements. Both collection pages contain the correct three category counts and filter values.
- The production build generated 2,673 pages.
- Browser-dependent label/visual tests could not launch because Chromium was unavailable and its download timed out. Public model downloads returned HTTP 403 in this environment. This release therefore has no new visual inspection of production models or native-device placement test; the USDZ numerical tests above use test geometry.
