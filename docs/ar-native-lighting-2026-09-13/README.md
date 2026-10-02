# Native AR lighting correction — 13 September 2026

Laocoön appeared too dark outdoors after the previous exposure update. That update multiplied its linear material colour by the web page's exposure of 0.2. This changed the sculpture's reflectance before Apple's renderer applied its own lighting; a web camera exposure cannot be transferred this way.

Quick Look now receives each work's existing material colour and texture factors without a page-exposure multiplier. Metalness, roughness, normal and occlusion maps remain intact. The separate emissive-intensity correction remains: constant and mapped emission are folded exactly once into cloned materials, preventing weak emission from exporting at full strength. Changing the page exposure slider leaves a prepared native AR file intact.

WebXR continues to use each work's existing renderer, ACES tone mapping, lights and environment. Forcing that renderer to unity exposure would create a different regression; the native correction is deliberately limited to the separate Apple renderer. This release introduces no blanket brightening of dark paint or metals.

## Validation

The actual Laocoön page export restores its first linear diffuse channel from the preceding release's 0.18775 to 0.93875. The other channels likewise preserve the work's material rather than multiplying by 0.2. This is a material-input comparison, not a claim of five times brighter phone pixels. Laocoön has no constant emission in the inspected material. Its physical reference remains 2.42 m and the exported geometry is unchanged within the existing quantization tolerance.

Serialized material tests cover reflectance, weak constant/mapped emission, texture references, source immutability and unchanged physical size. Spatial and Quick Look geometry tests pass. WebKit browser checks confirm native-export preparation, size retention, device fallbacks and independence from the page exposure slider. Local results are retained here; the executable check is in the task workspace at `work/atrium-spatial-review-2026-09-13/qa-lighting.mjs`.

All public works receive the corrected export policy while keeping their individual materials. A separate per-work audit records source material properties and existing presentation limitations. It is not an outdoor-device test or a claim that every scan's texture represents measured reflectance. Native phone lighting remains a physical-device check.

The [material audit](material-coverage.json) covers all 1,046 works and 1,266 material slots, with exact asset hashes. It separately flags reflective surfaces, dark texture candidates, emission and the viewer's existing synthetic materials. Source vertex-colour replacement and conversion of unlit source scans are recorded for further visual review; this correction does not invent per-piece outdoor gains to conceal those limitations. Full source/effective predictions and texture screening remain in the task workspace.

## Technical basis

Base colour is reflectance/albedo, not renderer exposure: [Khronos glTF materials](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials) and [OpenUSD Preview Surface](https://openusd.org/dev/spec_usdpreviewsurface.html). Apple's native environment is described in [Specifying a lighting environment in AR Quick Look](https://developer.apple.com/documentation/arkit/specifying-a-lighting-environment-in-ar-quick-look). The prior page-exposure conversion is superseded by this correction.
