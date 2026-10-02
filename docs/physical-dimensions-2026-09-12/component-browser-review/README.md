Independent component-scale review — 2026-09-12

No blocking implementation issue found in the extentFraction path. physicalDimensionsFor validates and retains the fraction, SpatialViewing serializes it in data-reference-extent-fraction, bindSpatialViewing converts it back to a number, and both Quick Look and WebXR pass the same reference to referenceScaleFor. Scaling remains uniform; surrounding captured geometry retains its relative size.

Real browser check: qa.mjs opened the current Casimir page on local port 4380, opened the AR dialog and placement controls, selected a real surface, and clicked the normal Prepare AR button. The resulting actual USDZ is saved as casimir-from-ui.usdz. Its independently parsed sculpture geometry is 2.5810060957 m high, versus the documented 2.581 m (0.0061 mm serialization difference). The serialized uniform scale is 3.0348378761 and the HTML extent fraction is 0.8504572914097793. Both the statue and separate scanned gallery geometry remain in the export. See result.json, casimir-model.usda and casimir-ready.png.

Browser scope: real headless Chrome with an iPhone Chrome user-agent selected the ordinary Quick Look code path. No native Apple Quick Look launch or physical headset session was tested. R2 permits the production atrium.earth origin but excludes local port 4380, so the browser test fulfilled the exact SHA-256-verified public GLB from the existing local audit cache. No application code was changed. Dev HMR was disabled for the test while concurrent data integration continued. Recorded warnings include development dependency/WebSocket messages and USDZExporter’s existing double-sided-material warning; there were no page JavaScript exceptions.

Independent checks passed on the reviewed working tree:
- scripts/test-physical-dimensions.mjs
- scripts/test-quick-look-export.mjs
- scripts/test-spatial-viewer.mjs

Evidence consistency review found outdated pre-calibration notes and blockers attached to now-calibrated records. These were reported to the integrating agent; geometry notes/blockers were subsequently cleared, and the integrating agent is resolving the remaining user-visible source-note wording. No calibration values were changed by this reviewer.

Incoming source batch: other/other-source-proposals.json contains 134 rows and has zero exact-slug overlap with the 316 spatial-calibrated records in the snapshot checked. Thus no existing calibration in that batch requires preservation, index reassociation or invalidation. File hashes and counts are in other-source-overlap-review.json.
