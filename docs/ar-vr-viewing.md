# AR and VR viewing

Each public sculpture page has a **View in AR / VR** button. The existing screen viewer remains available on computers, tablets, and phones, including devices without immersive support. The feature reuses the loaded sculpture, its authored surfaces, and the reviewed orientation.

## Native AR baseline — Milestone Venus

The core AR implementation follows the accepted **Milestone Venus** build, preserved at `8962b38` on the `milestone-venus` branch. On iPhone, **Prepare AR view → Open in AR** opens Apple Quick Look. At the owner's subsequent request, the export now includes a simple upright museum label beside the sculpture. The custom browser camera, landscape setup, restart-on-rotation logic, native banners, and camera-following label animations remain removed. The independent collection search/header fix remains. Earlier experimental code is preserved in Git history, and the [label experiment findings](archive/ar-label-experiments-2026-09-15.md) are retained for future work.

Portrait entry works directly; the site neither locks orientation nor requires turning the phone before starting. Native camera orientation and placement belong to Quick Look. Turning the page to landscape and back does not invalidate its prepared sculpture or force another export. WebXR still delegates camera poses and projection to the device. Actual iPhone rotation, placement, and photography require a physical-device check; a resized browser fixture is not evidence of native AR tracking quality.

## Artwork appearance

Native AR appearance is independent of page exposure and its brightness slider. The previous transfer of page exposure into artwork color caused dark AR results and has been removed. Export preserves textures, hue, roughness, metalness, and authored emission. Untextured vertex coloring remains explicitly bound to the USD surface, including the source material multiplier once.

For untextured nonmetal surfaces only, the AR export limits peak linear diffuse reflectance to 0.8 using a uniform RGB multiplier, retaining hue. This is a conservative artistic default, not device-calibrated exposure. Darker colors, metals and texture-based surfaces are not dimmed. There is no blanket brightening, emission lift, or page-exposure multiplier. Labels and stands remain outside artwork preparation. WebXR retains its existing renderer.

`scripts/audit-ar-appearance.mjs` checks every generated work page and exercises each resolved profile and override through the native material policy. Its report distinguishes catalogue/profile coverage from visual device validation. Quick Look supplies its own lighting and tone mapping: review on an iPhone in both orientations, especially Venus of Willendorf, The Thinker, and The Wrestlers. A catalogue audit cannot certify each scan's appearance in every room.

## Museum labels

The shared artwork label uses title, maker, period, region, and material from the catalogue, omitting unknown placeholders. It appears beside the AR launch with Atrium's Inter typography. It does not add new historical claims or include renderer material profiles, institutions, or display-size defaults.

**iPhone:** the native USDZ includes a small slate label with warm-white Inter lettering beside the work. `quick-look-museum-label.mjs` creates upright XY geometry in the Y-up export, outside the Artwork scale/scan transforms. Its horizontal edges remain parallel to the placement surface. It has no camera-following action, screen-orientation transform, or custom banner. Clearance is measured beyond the complete sculpture and optional stand bounds; label size follows the work and all facts are retained. The label's two authored faces are readable from either side. It is part of the photographed scene, so native AR needs no photo-import step. It shares ordinary physical perspective and turns with the assembled scene; it is not a fixed-screen HUD. Portrait and landscape have equal priority and use the identical prepared USDZ. Actual native rendering and shutter capture still require phone validation.

The saved-photo editor remains available on paths without Quick Look. It adds white text to either lower corner of an image, reflows for portrait or landscape, preserves the original, and exports a new JPEG without uploading the image. It is not presented as an extra step in Apple AR.

**WebXR with DOM overlays:** the matching screen-fixed label appears after placement, at the lower left. Placement controls stay in a closed disclosure and hide the label while open. Visitors can also turn the label off there. Repositioning hides the label until placement is confirmed again. No label geometry is added to the sculpture or scene, and orientation changes do not alter the tracked anchor. Headsets without DOM overlay support retain their existing behavior.

The [Milestone Venus design record](milestone-venus.md) records the design choices, platform boundaries, and validation.

## Viewing modes

- **WebXR AR:** Detect a horizontal floor or table and tap to place the work. Adjust display size, turn it, or place it again. Camera access starts only after an explicit click and the device's permission flow.
- **Apple Quick Look:** Prepare an on-device USDZ export, then use the explicit Open in AR link. The exporter preserves the displayed skeletal pose, material groups, and mirrored surface orientation. The live model and source assets are unchanged.
- **WebXR VR:** The sculpture stands on the floor two meters ahead of the initial reference origin. Walk around it, use a controller trigger to turn it, and move a controller thumbstick up/down to resize it. The headset's normal system controls can end the session; an Exit control is also available when the device supports DOM overlays.
- **Screen:** Rotate, zoom, and inspect the original Three.js view as before. Unsupported AR/VR modes open device guidance and a selectable canonical link, with separate Copy and Share actions. Blocked clipboard or sharing APIs fall back to manual selection. Continue in 3D returns directly to the screen viewer.

Display size is adjustable. Works with a separately reviewed physical reference start at their documented size in WebXR and Apple Quick Look. For modern reproductions, the only physical reference is the original artwork, with an adjacent original-dimensions note and source link. Other works retain the one-metre display default and explicitly say their physical size is not yet calibrated. The [dimension audit](audits/physical-dimensions-2026-09-09.md) records source coverage and remaining gaps.

## Browser compatibility and interface

The shared panel and immersive overlay use the public site’s Inter type, slate surfaces, brass accent, and hairline dividers. The physical-size note is visible before choosing a mode. Placement and stand controls are available in a disclosure; their recommendations and scaling behavior are unchanged. The dialog has a visible close control, mobile scrolling, keyboard focus restoration, and an explicit screen-view action.

WebXR support probes are independent, catch errors from incomplete APIs, and stop waiting after 2.5 seconds. Reopening the panel or attaching a device refreshes support. Quick Look uses the browser’s AR link probe plus a narrow exception for recognized iOS browsers (Chrome, Firefox, Edge, Google, DuckDuckGo), including iPads in desktop mode. Known embedded browsers get instructions for opening an external browser. The generated USDZ link includes a filename for browser handoff. A failed model load offers an in-panel retry; link handoff remains available without the model.

AR still depends on device hardware and browser support. Android uses the existing WebXR path; this change does not send uncalibrated source GLBs to Scene Viewer. Apple browser recognition does not guarantee that every app version can launch Quick Look.

## Lifecycle and loading

Capability detection does not request an immersive session. `requestSession` runs directly in the user's button event. While WebXR owns the renderer, the screen animation and orbit controls pause. Ending, denying, cancelling, or interrupting a session restores the original model hierarchy, camera, floor, background, and screen rendering. AR wall hits do not place sculptures sideways. DOM overlay controls suppress duplicate XR select events.

Quick Look loads its exporter only when requested and creates a local blob URL. It bakes posed vertices into a temporary static copy, splits multi-material meshes for USDZ, and reverses winding when flattening a mirrored transform. The visitor makes a second explicit tap to launch Quick Look after preparation.

## Validation

`npm run test:spatial` checks browser recognition, missing/throwing/rejected/timed-out XR APIs, and floor contact at different scales, wall rejection, controller actions, session errors and cancellation, return to the original screen state, and Quick Look geometry for skinned, mirrored, and multi-material meshes.

`npm run test:spatial-restoration` checks iPhone entry in portrait and landscape, real labeled USDZ generation from a local sculpture fixture, preservation of the same prepared export through rotation, and absence of native banners, photo-import steps, and replacement camera runtime requests. Set `ATRIUM_TEST_EXECUTABLE` if Chromium is installed outside Playwright's default location. It uses the actual page markup and AR handler with a deterministic local model, not an iPhone camera simulation.

`npm run test:quick-look-label` checks complete text for all catalogue labels, then inspects eight real USDZ exports for upright geometry, level edges, physical clearance, unchanged sculpture transforms, horizontal anchoring, and absence of camera-following actions. Cases include Seated Scribe and Venus dimensions, stands, wide/deep/flat/large works, and corrected/mirrored scan transforms. Local geometry previews check portrait and landscape equally; they use calibration boxes and do not simulate native camera tracking.

`npm run test:museum-labels` checks all catalogue labels at portrait and landscape photo sizes, transparent-background text, intact factual content, EXIF rotation, source-preserving corner changes, editor layout down to 320-pixel portrait and 568-pixel landscape, share/error handling, and a WebXR placement fixture. The browser tests check software behavior; actual iPhone and headset tracking and capture require device validation.

With an Astro preview running, `ATRIUM_TEST_URL=http://127.0.0.1:4332 node scripts/test-spatial-browser.mjs` checks real screen rendering, desktop/mobile layouts, unsupported-device messages, canonical link copying, permission rejection, and an actual USDZ export of the Sutra Container. Set `ATRIUM_TEST_BROWSER=chromium`, `firefox`, or `webkit` to select a browser engine. All three passed screen rendering, mobile layout down to 320 px, keyboard dismissal, denied permissions, device handoff, blocked sharing/clipboard, and real USDZ export (including furniture). Chromium also checks failed-load recovery on Dubuffet. Use `ATRIUM_LOCAL_MODEL_CORS=1` only for localhost preview QA when the asset host restricts origins. The browser tests emulate capability responses; they do not substitute for a physical headset or AR phone test. Real hardware testing remains outstanding.

Model-normalization and wing checks, catalogue asset verification, and the production build also pass. The collection remains at 1,046 public works. Video-sharing work is saved separately outside this release at the owner's request.

## API references

- [Three.js WebXRManager](https://threejs.org/docs/pages/WebXRManager.html)
- [XRSystem.requestSession](https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession)
- [Three.js USDZExporter](https://threejs.org/docs/pages/USDZExporter.html)

- [Model Viewer browser detection](https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/constants.ts)
- [WebKit AR link requirements](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/)
