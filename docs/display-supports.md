# Display supports and physical scale

The artwork should feel physically present at its documented size, with its proportions intact. A reduced reproduction should use the corresponding original’s documented dimensions after matching the represented geometry. Small objects can be raised on separate virtual furniture; the artwork itself is not enlarged to make it easier to reach.

The AR/VR options include automatic support in VR, an explicit virtual stand, and direct placement on a floor or real table. Stand height is adjustable from 20 to 140 cm, initially 100 cm, before entering immersive viewing and through the overlay where supported. A viewer using a headset without DOM overlay can configure the support before entry.

Automatic stands require a valid physical reference for the exact model. Initial eligibility is artwork height at most 70 cm and width/depth at most 120 cm. Uncalibrated normalized model bounds cannot establish whether an object is small. Explicit stands remain available while the existing uncalibrated-size note stays visible.

AR defaults to direct surface placement. Horizontal hit tests cannot reliably identify a floor versus a tabletop. When choosing a virtual stand, the viewer is instructed to place it on the floor. Apple AR uses the same explicit choice.

Furniture and artwork are separate children of an unscaled placement group. Only the artwork gets the uniform physical reference scale and any deliberate display-size adjustment. Raising or lowering furniture preserves artwork dimensions, proportions, and contact with the stand top. A scanned original base stays with the sculpture; the new furniture is never part of its dimension record.

Apple USDZ export uses an identity wrapper because the exporter serializes the supplied root’s children, not the root transform. Actual archive tests verify physical artwork dimensions with and without furniture. Exports containing a stand disable whole-assembly resizing through Apple’s `allowsContentScaling=0` parameter; changing support settings invalidates previously prepared exports. See [Apple’s AR Quick Look guidance](https://developer.apple.com/videos/play/wwdc2021/10078/?time=482).

Validation includes support eligibility and geometry, fixed furniture during artwork resizing, contact height, AR surface offsets, cleanup after normal and failed sessions, and actual USDZ transforms. Browser checks cover desktop/mobile controls, unsupported devices, permission denial, and rebuilding Apple exports after support changes. Physical headset and iPhone placement still require device testing.

This change is prepared in an isolated local checkout based on `03aa418`. It does not update artwork measurements, original model files, or the live deployment.
