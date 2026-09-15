# Milestone Venus

The owner accepted the restored native AR build on 15 September 2026 and named it **Milestone Venus**.

- Commit: `8962b38a2a877dbd01118e3b929bf781c62cb608`
- Preserved remote branch: [`milestone-venus`](https://github.com/never-nude/atrium.earth/tree/milestone-venus)
- Production deployment: [34931693247](https://github.com/never-nude/atrium.earth/actions/runs/34931693247)
- AR implementation: the native Apple Quick Look / WebXR baseline from `5fbcfa2`.
- Separate collection search/header fix retained.
- Prior label experiments and failures: [archived findings](archive/ar-label-experiments-2026-09-15.md).

## Label design after this checkpoint

The label is a companion to native AR. It uses the same five catalogue facts everywhere: title, maker, period, region, material. Unknown placeholders are omitted, and rendering profiles are never presented as an artwork's material.

The AR entry has a typographic label using Atrium's Inter hierarchy, with no additional card around it. A **Label a photo** action lets the visitor select a photo saved from AR. The editor previews the actual labeled copy, defaults to a fixed lower-left position, and offers lower-right when the composition calls for it. White lettering has a close dark halo for contrast and a fully transparent background. Width, wrapping, spacing and type size adapt to portrait and landscape image dimensions. All facts remain visible; there is no moving label, top banner, box, rule or extra watermark.

Photo orientation is decoded before drawing. Changing position always renders from an untouched source, so labels never accumulate. Export makes a new JPEG, capped at 4096 pixels on its longest side. Share begins in the user's tap; download remains available where file sharing is unsupported. Images stay on the device. Errors, replacement and closing discard stale results and release temporary image URLs.

WebXR with a DOM overlay can show the same quiet screen-fixed label after placement. It disappears during repositioning or while placement controls are open; a checkbox can hide it. It is a DOM element and cannot enter model bounds or change the physical scale. It never changes the camera projection, hit testing, pose, or orientation lifecycle. Headsets without DOM overlays keep their existing native controls and do not get a simulated 3D label.

Apple Quick Look keeps the original sculpture-only USDZ and native camera/shutter. **There is no live label inside Apple AR.** The website's supported customization would be a native banner; it does not provide the required free-positioned corner HUD. On iPhone, the artwork facts are beside the AR launch and can be added to a saved photo afterward. Do not describe the photo workflow as a live camera overlay or automatically saved native AR metadata.

## Verification

The original spatial and USDZ tests protect dimensions, poses, materials, support contact, and session restoration. The restoration browser check protects portrait entry, native URL parameters and preservation of the prepared USDZ through rotation. Museum-label checks cover the five catalogue facts, transparent text output, EXIF orientation, changing corners from a clean source, narrow portrait/landscape layouts, sharing/error recovery, and a WebXR placement fixture. A desktop fixture cannot establish physical iPhone or headset behavior.
