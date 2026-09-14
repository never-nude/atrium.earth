# AR and VR viewing

Each public sculpture page has a **View in AR / VR** button. The existing screen viewer remains available on computers, tablets, and phones, including devices without immersive support. The feature reuses the loaded sculpture, its authored surfaces, and the reviewed orientation.

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

## Artwork labels and photos

The immersive label now retains **title, time period, region, maker and material**.
`artworkLabelFor` reads the normalized catalogue, uses the displayed date (or era
when no date is recorded), and uses the recorded medium rather than the renderer's
material profile. Empty and placeholder fields are omitted. It adds no dimensions,
institution, interpretation or new factual claims.

On phones with WebXR DOM overlays, a small translucent slate label sits at the
lower left, above collapsible placement controls. It uses Atrium's Inter type,
warm white text, brass rule and hairline border. The controls close after placement;
the label remains through rotation, resizing and repositioning. Headsets without
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

**Apple Quick Look:** the USDZ link supplies a custom HTTPS banner generated at
`/ar-label/<work slug>/`, with exactly the same catalogue fields and visual style.
These pages are static, contain no analytics or interactive actions, and are
excluded from the sitemap. Apple controls the banner's position, visibility and
native shutter. Its native photo output cannot be intercepted by this website;
the supported fallback is **Add label to photo** after returning to Atrium, then
choosing the saved photo. This is an explicit extra step, not automatic iPhone
photo stamping. A screenshot can retain the visible WebXR label on devices that
do not expose camera pixels.

The photo importer preserves aspect ratio and applies browser image orientation,
limits the longest side to 4096 pixels, and exports JPEG at 94% quality. Direct
immersive snapshots are limited to 2048 pixels on the longest side. Invalid images
and cancelled/interrupted capture do not silently return an unlabeled or
camera-free AR image.

`npm run test:spatial-label` verifies field selection, omissions, wrapping and
Quick Look URLs. `npm run test:spatial-label-browser` starts its own local Astro
server and checks mobile portrait/landscape layouts, the longest Apple banners,
photo import/error handling, stamped pixels, real WebGL camera composition,
orientation, transparency, tone mapping and state restoration with synthetic
camera fixtures. `ATRIUM_TEST_EXECUTABLE` may select an installed Chromium binary.
The existing spatial and actual USDZ export checks also pass. Physical iPhone,
Android AR and headset acceptance testing remains outstanding; simulated tests
cannot validate native Quick Look banner behavior or actual camera tracking.

References: [Apple custom banners](https://developer.apple.com/documentation/arkit/adding-an-apple-pay-button-or-a-custom-action-in-ar-quick-look),
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
