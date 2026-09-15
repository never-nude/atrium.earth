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

**iPhone browser AR:** scanning shows one short instruction and a dim, disabled
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

Only after placement, the small translucent HUD appears beside or below the work.
The eight corners of the sculpture's oriented bounds are projected into the camera
view, and the label picks the largest free region to its left, right or below it,
with a 24-pixel gap. The upper fifth of the camera view and bottom control row stay
clear. The label remains still within a usable area; another area must offer 30%
more space for 650 ms before it switches. An obstructed label can move after 350 ms.
When the work fills the view, the bottom corner with the least overlap is used.
The label stays upright and uses the same compact width in portrait and landscape,
with safe-area insets; longer records use smaller type. A round shutter sits at bottom
center, with a compact **Move / size** control on the left and photo review and exit
on the right. Its drawer contains the size slider, current display dimensions,
**Move work**, turn and reset controls. A drag beginning on the sculpture moves it
along its existing horizontal surface; a two-finger pinch resizes it. The model's
base stays on the surface when resized, and separate furniture is not scaled.
**Move work** returns to surface detection for placement elsewhere; confirming a
new location preserves the chosen size. Placement
guidance and dimensions clear after placement; repositioning restores the preview
flow. Camera motion can change the label's chosen screen area, but never rotates
its text. Rotation cancels an unfinished gesture and waits for the engine's
orientation and the viewport to agree before resizing the canvas. Camera and
sculpture rendering resume together after the projection matches the canvas and
two fresh pipeline updates have cleared pending frames. This handles Safari
delivering viewport, orientation and video-size changes at different times;
the camera origin is configured only at session start, and the world anchor and
display size are never changed by rotation. Capture pauses during the transition.
Capture copies the composited camera and sculpture in the render
callback, then stamps the HUD's exact pixels at its measured screen position.
Photo encoding does not stamp a second label. Exit, interruption and startup errors
stop the camera and restore the ordinary viewer's model, canvas and rendering state.

The runtime is pinned to `@8thwall/engine-binary@1.0.0`. `predev` and `prebuild`
copy its unmodified distribution and licence to `public/external/xr/`; the browser
loads the SLAM chunk only when opening iPhone AR options. Camera and motion access
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
dimensions, rendered preview/placed pixels, adaptive HUD spacing and stability,
post-placement slider and touch-pinch resizing, dragging, moving to another
surface, both orderings of viewport/orientation events, rejection of stale
projection frames, photo pixels, all enabled catalogue
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
