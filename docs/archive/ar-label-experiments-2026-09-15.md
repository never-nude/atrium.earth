# Archived AR label experiments — 15 September 2026

This is a development reference, not the currently shipped experience. At the owner's request, AR is restored to the last pre-label build (`5fbcfa2b1ddfccc6aea0c0acb664bc578dac5136`). The final experimental implementation remains in Git at `0e1f4c5fc098c315f3b7c3c17fef2fc9d8c92cd8`; no history was rewritten.

## Lessons to retain before revisiting labels

- Latest requested visual direction: a small, unobtrusive label with white text, a fully transparent background, and a fixed corner of the screen. Retain the title, maker, period, region, and material where recorded. This supersedes the slate panel/brass-rule treatments in the historical implementation below.
- Feasibility rechecked on 15 September: Apple's documented web customization supplies a native banner, with `customHeight` limited to 81, 121, or 161 points and a native-controlled width that responds to device orientation. There is no documented free-positioned corner HUD or touch-pass-through option in that interface. Transparent HTML does not remove the native banner allocation. Because the banner already prevented shutter use in the user's device reports, the small corner-label request is recorded but is not shipped in this restoration. See [Apple's custom-banner API](https://developer.apple.com/documentation/arkit/adding-an-apple-pay-button-or-a-custom-action-in-ar-quick-look) and [ARQuickLookPreviewItem](https://developer.apple.com/documentation/quicklook/arquicklookpreviewitem).
- The original iPhone path was Apple Quick Look. The browser camera engine, custom capture, placement preview, and rotation-restart flow were introduced to support labels. Removing a visible label alone would not restore the original experience.
- Prioritize portrait entry and the ability to turn the phone to landscape. Do not require a landscape setup screen, restart placement on rotation, or replace the native camera experience simply to add metadata.
- A native Quick Look banner can cover or prevent use of the shutter. An HTML overlay on the page does not become an overlay inside Apple's native viewer. A sculpture-attached USDZ label rotates with the asset and can tilt, crowd the work, or sit sideways. These were reported regressions, not acceptable fallbacks.
- Future labels should contain only the title, maker, period, region, and material where recorded, with Atrium's existing Inter typography and the latest white-text/transparent-background direction above. Keep them compact and away from the work and shutter. No banner above the sculpture. Avoid adaptive motion that makes the label distracting.
- The user reported lost tracking on rotation, invisible sculpture previews, and unresponsive entry. The September 15 recordings showed an entry panel that did not launch AR and a camera session that remained in “Tracking paused” after rotation. Do not treat those recordings as proof of the exact underlying engine fault.
- Browser experiments exposed ordering differences between viewport resize, device orientation, video dimensions, and projection updates. Toolbar resizing is not physical device rotation. Do not recenter an anchor or mutate an engine-owned calibrated projection based on CSS aspect ratio.
- FEATURE_POINT hits can contain a missing or zero quaternion. Rejecting those as invalid surface rotations hid otherwise usable placement previews. Apply suitable validation per hit type.
- Permission requests must originate in the user's tap. Show preparation/error feedback beside that action. Keep camera setup, cancellation, cleanup, and restart explicit and resource-safe.
- Catalogue physical-size references, proportions, authored material exposure, poses, mirrored meshes, multi-material exports, and floor/stand contact must survive any future change. The original exporter and its tests cover these independently of labels.
- Desktop fixtures and real engine startup with a fake camera can validate flow, capture composition, and cleanup, but cannot establish native iPhone tracking quality or shutter access. Actual iPhone portrait-to-landscape use and photography are required before claiming a label approach works on hardware.

## History checkpoints

- `5fbcfa2`: last build before labels (restored baseline).
- `acee1de`: first artwork label and photo-stamping implementation.
- `6ea4fe2`, `f13f7d3`: native banner and shutter experiments.
- `958786e`, `ed8945d`, `089c606`: sculpture-attached labels, spacing, and orientation experiments.
- `8b9e9f1`: browser AR with a screen-fixed label.
- `0ea6dae`, `1c5b82d`, `f351daf`: placement preview, adaptive label, movement, and rotation experiments.
- `0e1f4c5`: landscape setup with a fixed label and explicit rotation restart, subsequently rejected by the owner.
- `9f0b1a2`: separate collection search/header fix. Retained in the restored release.

## Experimental implementation reference

The following document is preserved as it stood before the restoration. Its descriptions and test results apply to the archived experiment only.

---

# AR and VR viewing

Each public sculpture page has a **View in AR / VR** button. The existing screen viewer remains available on computers, tablets, and phones, including devices without immersive support. The feature reuses the loaded sculpture, its authored surfaces, and the reviewed orientation.

## Viewing modes

- **WebXR AR:** Detect a horizontal floor or table and tap to place the work. Adjust display size, turn it, or place it again. Camera access starts only after an explicit click and the device's permission flow.
- **iPhone browser AR:** When WebXR is unavailable, a self-hosted 8th Wall runtime provides camera frames, 6DoF tracking and hit tests inside Atrium. The label is a fixed screen HUD; the sculpture is placed in the tracked world. The same model, physical reference, stand and photo controls are reused.
- **Apple Quick Look fallback:** Prepare an on-device USDZ export, then use the explicit Open in Apple AR link. This exports the sculpture and optional stand without a label or custom banner. The exporter preserves the displayed skeletal pose, material groups, and mirrored surface orientation. The live model and source assets are unchanged.
- **WebXR VR:** The sculpture stands on the floor two meters ahead of the initial reference origin. Walk around it, use a controller trigger to turn it, and move a controller thumbstick up/down to resize it. The headset's normal system controls can end the session; an Exit control is also available when the device supports DOM overlays.
- **Screen:** Rotate, zoom, and inspect the original Three.js view as before. Unsupported AR/VR modes open device guidance and a selectable canonical link, with separate Copy and Share actions. Blocked clipboard or sharing APIs fall back to manual selection. Continue in 3D returns directly to the screen viewer.

Display size is adjustable. Works with a separately reviewed physical reference start at their documented size in WebXR and Apple Quick Look. For modern reproductions, the only physical reference is the original artwork, with an adjacent original-dimensions note and source link. Other works retain the one-metre display default and explicitly say their physical size is not yet calibrated. The [dimension audit](audits/physical-dimensions-2026-09-09.md) records source coverage and remaining gaps.

In Atrium's browser AR and WebXR modes, a documented reference is the initial and
reset size, not a resizing lock. Every work can be adjusted from 10% to 200% of its
initial size. The physical reference records and source models remain unchanged.
Apple Quick Look retains its existing prepared-size policy.

## Browser compatibility and interface

The shared panel and immersive overlay use the public site’s Inter type, slate surfaces, brass accent, and hairline dividers. The physical-size note is visible before choosing a mode. Placement and stand controls are available in a disclosure; their recommendations and scaling behavior are unchanged. The dialog has a visible close control, mobile scrolling, keyboard focus restoration, and an explicit screen-view action.

WebXR support probes are independent, catch errors from incomplete APIs, and stop waiting after 2.5 seconds. Reopening the panel or attaching a device refreshes support. Quick Look uses the browser’s AR link probe plus a narrow exception for recognized iOS browsers (Chrome, Firefox, Edge, Google, DuckDuckGo), including iPads in desktop mode. Known embedded browsers get instructions for opening an external browser. The generated USDZ link includes a filename for browser handoff. A failed model load offers an in-panel retry; link handoff remains available without the model.

AR still depends on device hardware and browser support. Android uses the existing WebXR path; this change does not send uncalibrated source GLBs to Scene Viewer. Apple browser recognition does not guarantee that every app version can launch Quick Look.

## Artwork labels and photos

The immersive label now retains **title, time period, region, maker and material**.
`artworkLabelFor` reads the normalized catalogue, uses the displayed date (or era
when no date is recorded), and uses the recorded medium rather than the renderer's
material profile. Empty and placeholder fields are omitted. It adds no dimensions,
institution, interpretation or new factual claims.

On phones with WebXR DOM overlays, a small translucent slate label sits at the
lower left, above collapsible placement controls. It uses Atrium's Inter type,
warm white text, brass rule and hairline border. The controls close after placement;
the label remains through rotation, resizing and repositioning. In phone landscape,
the shutter and photo review occupy a separate right-hand column; the label and
placement controls stay on the left and can scroll on short screens. Headsets without
DOM overlays receive a camera-relative Three.js label that does not affect the
sculpture's physical dimensions or bounds.

**Take photo** is available once placement and a tracked camera view are ready.
WebXR AR requests optional `camera-access`: where granted, the shutter copies the
camera texture inside the XR frame, renders the sculpture from that same view,
composites them, and bakes the five-field label into the image pixels. The camera
background is never assumed to be in the transparent XR canvas. Capture preserves
tone mapping and restores renderer state even on failure. It reads camera pixels
only when the visitor requests a photo. VR can capture its rendered scene without
camera access. A completed photo can be reviewed, downloaded or shared; taking it
does not reset the sculpture placement. Photos remain on the visitor's device.

**iPhone browser AR:** the initial screen focuses on the work and landscape setup.
Turn the phone sideways, then explicitly tap **Start AR**; **Use portrait** is a
secondary option. The camera engine is not initialized merely by opening options.
Starting/progress and permission errors appear beside the Start button. The fuller
VR, Apple AR and photo options are available through **More viewing options**.
The documented/default starting size is retained.

Once the camera starts, scanning shows one short instruction and a dim, disabled
**Place work** button. Normal tracking and a valid placement point below the camera enable
the gold button, a faint sculpture preview, and its proposed height × width ×
depth. Dimensions come from the oriented model bounds at the prepared display
scale, including any scanned base but excluding a separate virtual stand. They
describe the proposed placement, not newly verified museum measurements. Losing
the surface or tracking hides the preview and dimensions and disables placement.
The button rechecks the hit when tapped; camera taps never place the work.
Committing placement restores the exact original materials at normal brightness;
camera exposure and scene lighting are never changed for the preview.

Feature points do not guarantee a surface normal. The engine's
[hit-result implementation](https://github.com/8thwall/8thwall/blob/main/reality/engine/hittest/hit-test-performer.cc)
can leave rotation unset, which the JavaScript wrapper returns as a zero quaternion.
Those valid points must not be discarded: this previously kept the sculpture hidden
and the placement button permanently disabled. Missing/zero feature-point rotations
are accepted; supplied steep rotations, invalid coordinates/distances, points above
the camera and lost tracking are rejected. The sculpture always stays upright.

Only after placement, the compact translucent label appears in a fixed lower-left
corner, above the control row. It retains title, maker, time period, region and
material where recorded, using Atrium's Inter typography, slate background, warm
white text and thin brass rule. It never follows or rotates with the sculpture.
Landscape hit testing aims slightly right of center to leave room for the label.
The top stays clear. Tracking guidance stays below the label in the same corner.
The shutter remains unobstructed at bottom center; **Move / size**, photo review
and exit are secondary controls. The closed adjustment drawer retains the slider,
current display dimensions, explicit repositioning, turn and reset actions.
Dragging or pinching the camera view does not manipulate the work.

A browser AR session starts tracking in its selected orientation. A physical
orientation change ends the old session, restores the ordinary viewer, and shows
**Start AR** with an explanation that the work needs to be placed again. Neither
viewport-first nor engine-orientation-first event ordering carries an old pose
into the new orientation. A new camera session requires an explicit Start tap.
Safari toolbar height changes within the same orientation only resize the canvas;
they do not end the session or reset the anchor. The earlier projection-aspect
heuristic and camera rendering gate were removed; the engine owns its calibrated
camera projection and camera rendering. Sustained tracking loss hides the work
after 400 ms and disables capture until normal tracking recovers, retaining the
label and placement. This avoids presenting a drifting work as a valid placement.

Capture copies the composited camera and sculpture in the render callback, then
stamps the label's exact pixels in its fixed corner. Photo encoding does not stamp
a second label. Exit, interruption and startup errors stop the camera and restore
the ordinary viewer's model, canvas and rendering state.

The runtime is pinned to `@8thwall/engine-binary@1.0.0`. `predev` and `prebuild`
copy its unmodified distribution and licence to `public/external/xr/`; the browser
loads the SLAM chunk only after the explicit Start AR tap. Camera and motion access
begin on the visitor's explicit start gesture. No account or hosted runtime is
required. The implementation uses the documented
[camera pipeline](https://8thwall.org/docs/api/engine/camerapipelinemodule),
[absolute scale](https://8thwall.org/docs/api/engine/xrcontroller/configure), and
[hit tests](https://8thwall.org/docs/api/engine/xrcontroller/hittest).

**Apple Quick Look:** the rotating USD label and its Preliminary behavior have
been removed after device regressions. Quick Look does not expose an arbitrary
screen HUD to the website, and its custom bottom banner obstructed the shutter.
The fallback exports no label and includes neither `custom` nor `customHeight`
in the launch URL. The old `/ar-label/` documents remain for old links but are not
used by the launcher. **Add label to photo** adds a level label to a saved native
AR photo after returning to Atrium.

**Add label to photo** also remains available for existing photos without labels.
A screenshot can retain the visible WebXR label on devices without camera access.

The photo importer preserves aspect ratio and applies browser image orientation,
limits the longest side to 4096 pixels, and exports JPEG at 94% quality. WebXR
snapshots are limited to 2048 pixels on the longest side; browser AR captures the
viewport at up to twice its CSS resolution. Invalid images
and cancelled/interrupted capture do not silently return an unlabeled or
camera-free AR image.

`npm run test:spatial-label` verifies field selection, omissions, wrapping and
Quick Look URLs. `npm run test:spatial-label-browser` starts its own local Astro
server and checks mobile portrait/landscape layouts, the sculpture-only native USDZ,
the absence of rotating labels and custom banners, legacy banner layouts,
photo import/error handling, stamped pixels, real WebGL camera composition,
orientation, transparency, tone mapping and state restoration with synthetic
camera fixtures. `ATRIUM_TEST_EXECUTABLE` may select an installed Chromium binary.
After `npm run build`, `npm run test:browser-ar` loads the actual self-hosted engine,
compiles its SLAM WebAssembly and starts its camera pipeline with Chromium's test
camera. Separate deterministic camera-pose and hit-test fixtures check deliberate
placement with zero/missing hit rotations, rejected wall/lost/stale hits, proposed
dimensions, rendered preview/placed pixels, fixed label position, slider resizing,
non-manipulating camera gestures, explicit repositioning, tracking-loss visibility,
both orderings of orientation changes with explicit session restart, same-orientation
toolbar resizing, visible synchronous/asynchronous entry failures, photo pixels,
all enabled catalogue
labels on a small landscape screen, startup failure and viewer restoration. These
fixtures do not validate physical iPhone tracking. Real-device acceptance testing
remains necessary; no iPhone or iOS simulator is available in the workspace.

References: [Apple camera-facing actions](https://developer.apple.com/documentation/usd/lookatcameraaction),
[Apple looping actions](https://developer.apple.com/documentation/usd/groupaction),
[Quick Look behavior support](https://engine.needle.tools/docs/how-to-guides/everywhere-actions/),
[Apple custom banners](https://developer.apple.com/documentation/arkit/adding-an-apple-pay-button-or-a-custom-action-in-ar-quick-look),
[WebXR raw camera access](https://immersive-web.github.io/raw-camera-access/).

## Lifecycle and loading

Capability detection does not request an immersive session. `requestSession` runs directly in the user's button event. While WebXR owns the renderer, the screen animation and orbit controls pause. Ending, denying, cancelling, or interrupting a session restores the original model hierarchy, camera, floor, background, and screen rendering. AR wall hits do not place sculptures sideways. DOM overlay controls suppress duplicate XR select events.

Quick Look loads its exporter only when requested and creates a local blob URL. It bakes posed vertices into a temporary static copy, splits multi-material meshes for USDZ, and reverses winding when flattening a mirrored transform. The visitor makes a second explicit tap to launch Quick Look after preparation.

## Validation

`npm run test:spatial` checks browser recognition, missing/throwing/rejected/timed-out XR APIs, and floor contact at different scales, wall rejection, controller actions, session errors and cancellation, return to the original screen state, and Quick Look geometry for skinned, mirrored, and multi-material meshes.

With an Astro preview running, `ATRIUM_TEST_URL=http://127.0.0.1:4332 node scripts/test-spatial-browser.mjs` checks real screen rendering, desktop/mobile layouts, unsupported-device messages, canonical link copying, permission rejection, and an actual USDZ export of the Sutra Container. Set `ATRIUM_TEST_BROWSER=chromium`, `firefox`, or `webkit` to select a browser engine. All three passed screen rendering, mobile layout down to 320 px, keyboard dismissal, denied permissions, device handoff, blocked sharing/clipboard, and real USDZ export (including furniture). Chromium also checks failed-load recovery on Dubuffet. Use `ATRIUM_LOCAL_MODEL_CORS=1` only for localhost preview QA when the asset host restricts origins. The browser tests emulate capability responses; they do not substitute for a physical headset or AR phone test. Real hardware testing remains outstanding.

Model-normalization and wing checks, catalogue asset verification, and the production build also pass. The collection remains at 1,046 public works. Video-sharing work is saved separately outside this release at the owner's request.

## API references

- [Three.js WebXRManager](https://threejs.org/docs/pages/WebXRManager.html)
- [XRSystem.requestSession](https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession)
- [Three.js USDZExporter](https://threejs.org/docs/pages/USDZExporter.html)

- [Model Viewer browser detection](https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/constants.ts)
- [WebKit AR link requirements](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/)
