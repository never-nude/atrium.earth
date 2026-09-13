# AR / VR discovery and size-reference eligibility

The home page now makes AR / VR its primary action and first featured section. A permanent navigation entry and `/ar-vr/` collection expose only explicitly reviewed size references. Search and filters persist when switching between all works and AR / VR. Actions and size labels sit below the artwork.

## Initial eligibility policy

Of 1,046 public works, 248 are enabled: 227 verified size references (26 original-size and 201 museum-object references), plus 21 separately labelled measured casts. The remaining 798 retain ordinary 3D with a reason for withholding AR / VR.

This excludes all 380 unsupported physical references, all 22 approximate references, and 396 previously documented references needing further scope, axis, representation or secondary-extent review. Withholding is not a finding that every excluded work is incorrectly sized. No physical-dimension records were changed by this release. A reviewed selected extent does not establish that every scan dimension is exact. Cast dimensions do not establish the original's dimensions.

`src/data/spatial-eligibility.json` records explicit decisions. `src/lib/spatial-eligibility.mjs` validates the complete dimension-record fingerprint, model URL and asset SHA-256, orientation, source-axis label, measurement conversion, component scope, representation kind and policy version. The input evidence remains in `src/data/physical-dimensions.json` and the dimension audit directories. Fingerprints are integrity checks, not digital signatures or independent proof of source truth. Geometry/export code changes still require review; the implementation does not automatically hash algorithm code.

The viewer hashes the actual downloaded GLB bytes and decodes those same bytes. A changed model, missing digest capability or digest failure leaves ordinary 3D available but prevents AR / VR launch. Verified WebXR scale stays fixed against slider and controller input; stand height remains independent. Native Quick Look requests `allowsContentScaling=0`. Deep links open the options dialog; preparation or immersive session launch still requires a user gesture.

## Verification before publication

- Eligibility, physical dimension, spatial capability/session/material and Quick Look export tests pass.
- Production build: 3,727 pages. All 1,046 work pages have matching eligibility, unavailable notices and hash bindings.
- Chrome: home, collection and AR / VR at 1,440, 900, 390 and 320 CSS pixels, with no horizontal page overflow or JavaScript errors. Search, wing filter, view switching, normal reset and empty-result reset pass.
- Chrome phone path: an eligible Green-painted Ushebti prepares a fixed-size USDZ; changed legal model bytes and digest failure block both launch paths while preserving 3D. Withheld Laocoön and Dubuffet have no AR launch UI and retain 3D.
- Actual WebKit at a phone viewport: 248 cards, 21 cast labels, filtering, mobile navigation, deep-link dialog, fixed-size USDZ preparation and changed-byte rejection pass. A known exporter double-sided-material warning remains; no JavaScript page errors were recorded. These checks do not establish native Apple rendering or physical-device behaviour.

The project creator has not personally tested VR in a headset. Browser automation and mocked WebXR sessions do not establish headset compatibility, tracking accuracy, outdoor brightness or real-world placement accuracy. The preceding native-material lighting correction is unchanged.
