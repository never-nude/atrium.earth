# AR/VR exposure — 13 September 2026

The page-exposure multiplication described below was subsequently found to darken native AR incorrectly. It is superseded by the [native AR lighting correction](../ar-native-lighting-2026-09-13/README.md). The emissive-intensity fix remains in use. This document records the earlier release and its tests.

Apple Quick Look creates its own renderer. Previously, the USDZ export retained surface materials but omitted the page's tone-mapping exposure, so a work configured at 0.2 exposure could appear much brighter in AR. Quick Look now gets a private copy of each material with that work's current exposure applied once to its linear base colour. Texture colour space, UV settings, normal/occlusion maps, roughness and metallic properties remain intact. Source materials and physical geometry are unchanged.

The exporter also omits `emissiveIntensity` when a material has a constant emissive colour. That intensity is now baked once for constant and textured emission, so a faint emissive contribution cannot export at full strength. A previously prepared AR file is invalidated when page exposure changes or the model is reloaded.

WebXR AR and VR continue through the page's renderer, retaining its exposure, tone mapping, environment and material objects. They do not receive the Apple compensation a second time.

[coverage.json](coverage.json) records all 1,046 public works and 1,266 material slots: effective settings read from each built work page, GLB material channels inspected from local research assets or the public model, and the exposure conversion checked for every slot. The effective exposure range is 0.12–1.25. Cached GLB inspection is identified separately from public downloads. This is a complete configuration/material audit, not 1,046 physical outdoor-device trials.

[Laocoön's actual page export](laocoon-export.json) independently confirms a factor of 0.2 in the serialized material, with unchanged 2.42 m physical height. Serialized-material tests cover constant and mapped emission, colour-space preservation and source immutability. WebXR session tests cover both AR and VR without duplicate compensation. The production build and real Chrome/WebKit export/browser checks passed.

Outdoor AR still responds to the phone's camera lighting and Apple's rendering; identical pixels to a studio-lit web page cannot be guaranteed. Apple describes its environment behavior in [Explore USD tools and rendering](https://developer.apple.com/videos/play/wwdc2022/10141/). This change corrects missing exposure and emissive intensity in the supplied content without baking fixed lighting or shadows into the sculpture.
