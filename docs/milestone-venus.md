# Milestone Venus

The owner accepted the restored native AR build on 15 September 2026 and named it **Milestone Venus**.

- Commit: `8962b38a2a877dbd01118e3b929bf781c62cb608`
- Preserved remote branch: [`milestone-venus`](https://github.com/never-nude/atrium.earth/tree/milestone-venus)
- Production deployment: [34931693247](https://github.com/never-nude/atrium.earth/actions/runs/34931693247)
- AR implementation: the native Apple Quick Look / WebXR baseline from `5fbcfa2`.
- Separate collection search/header fix retained.
- Prior label experiments and failures: [archived findings](archive/ar-label-experiments-2026-09-15.md).

## Current simple label — 15 September 2026

After rejecting the separate photo-labeling workflow and the scope of a native App Clip, the owner requested a return to a simple label beside each work. It must line up with the sculpture, leave a visible gap, and give portrait and landscape equal priority. This explicitly supersedes the earlier fixed-screen requirement for Apple AR.

The current native export adds an upright XY-plane label in the same Y-up scene as the sculpture. It is a sibling of Artwork, so scan corrections and physical scale cannot rotate or skew it. The earlier `LookAtCamera` behavior is not used. Front and back faces are authored geometry with readable text. The label uses warm-white Inter on a compact slate background, retains title/maker/period/region/material, and measures clearance beyond the sculpture and any stand. Flat works keep their labels above the support surface.

The native viewer, horizontal surface placement, documented dimensions, camera, and shutter remain the Milestone Venus path. Native photos include visible scene geometry, including the label; there is no separate photo-import step on iPhone. A physical label has ordinary perspective and turns with the entire scene, unlike a screen HUD. No website orientation listener changes the prepared sculpture or its label.

`test:quick-look-label` checks all catalogue text and eight actual USDZ exports for world-aligned planes, level edges, separation, and unchanged artwork transforms. `test:spatial-restoration` checks the real entry/export path and preservation of the same native URL through portrait/landscape changes. Calibration previews cover both orientations equally. Physical iPhone tracking, shutter access, and saved photographs remain a device-validation step; desktop rendering is not proof of those behaviors.

## Previous companion-label release (`6075f76`)

The label is a companion to native AR. It uses the same five catalogue facts everywhere: title, maker, period, region, material. Unknown placeholders are omitted, and rendering profiles are never presented as an artwork's material.

The AR entry has a typographic label using Atrium's Inter hierarchy, with no additional card around it. A **Label a photo** action lets the visitor select a photo saved from AR. The editor previews the actual labeled copy, defaults to a fixed lower-left position, and offers lower-right when the composition calls for it. White lettering has a close dark halo for contrast and a fully transparent background. Width, wrapping, spacing and type size adapt to portrait and landscape image dimensions. All facts remain visible; there is no moving label, top banner, box, rule or extra watermark.

Photo orientation is decoded before drawing. Changing position always renders from an untouched source, so labels never accumulate. Export makes a new JPEG, capped at 4096 pixels on its longest side. Share begins in the user's tap; download remains available where file sharing is unsupported. Images stay on the device. Errors, replacement and closing discard stale results and release temporary image URLs.

WebXR with a DOM overlay can show the same quiet screen-fixed label after placement. It disappears during repositioning or while placement controls are open; a checkbox can hide it. It is a DOM element and cannot enter model bounds or change the physical scale. It never changes the camera projection, hit testing, pose, or orientation lifecycle. Headsets without DOM overlays keep their existing native controls and do not get a simulated 3D label.

Apple Quick Look keeps the original sculpture-only USDZ and native camera/shutter. **There is no live label inside Apple AR.** The website's supported customization would be a native banner; it does not provide the required free-positioned corner HUD. On iPhone, the artwork facts are beside the AR launch and can be added to a saved photo afterward. Do not describe the photo workflow as a live camera overlay or automatically saved native AR metadata.

## Verification

The original spatial and USDZ tests protect dimensions, poses, materials, support contact, and session restoration. The restoration browser check protects portrait entry, native URL parameters and preservation of the prepared USDZ through rotation. Museum-label checks cover the five catalogue facts, transparent text output, EXIF orientation, changing corners from a clean source, narrow portrait/landscape layouts, sharing/error recovery, and a WebXR placement fixture. A desktop fixture cannot establish physical iPhone or headset behavior.
