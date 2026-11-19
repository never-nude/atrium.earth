# World land geometry

Made with [Natural Earth](https://www.naturalearthdata.com/).

- Dataset: Natural Earth 1:110 million physical land, `ne_110m_land.geojson`.
- Primary repository: [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector).
- Pinned source: [GeoJSON at commit 693f11422f4e08d2da4566b854dda53eb7c39fb3](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/693f11422f4e08d2da4566b854dda53eb7c39fb3/geojson/ne_110m_land.geojson).
- Local file: `land.geo.json`, unchanged source bytes, 138,160 bytes.
- SHA-256: `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`.
- Source/license checked: 6 November 2026. Natural Earth declares its raster and vector data public domain and permits modification and commercial use without permission or required attribution. See [Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/) and the [repository license](https://github.com/nvkelso/natural-earth-vector/blob/master/LICENSE.md).

This is generalized land/coast geometry, not political borders, archaeological sites, object findspots or a claim of precise artwork locations. The orbital rings, glow and graticule are decorative interface graphics. No television assets are included.

## Rendering and coordinates

GeoJSON coordinates are `[longitude, latitude]`, in degrees. Place inputs use named `lat` and `lon` fields. On the globe, longitude zero faces `+Z`, east is `+X`, and north is `+Y`:

`x = cos(latitude) * sin(longitude)`, `y = sin(latitude)`, `z = cos(latitude) * cos(longitude)`.

Map mode uses an equirectangular view: west `−180°` is left, east `+180°` is right, north is up. Markers represent the supplied country or broad region anchors, never exact artwork sites. Nearby marker buttons are thinned to prevent overlap; the page’s place selector remains the complete keyboard-accessible list. Zero-count markers are hidden.

## Runtime API

`createWorldGlobe({ host, places, onSelect, onReady, onError, landUrl? })` returns synchronously. The local land URL resolves from `landUrl`, then `host.dataset.landUrl`, then the site's base path plus `world/land.geo.json`. `onReady({ mode, webgl, landLoaded })` follows the land load. WebGL failure uses the same real geometry in a flat canvas map and reports `onError`; land failure leaves a place-selector instruction.

The returned API is `update({ counts, selectedId })`, `reset()`, `setMode('globe' | 'map')` and `destroy()`. Counts are copied. A new selected place is brought into view with a short bounded movement; reduced motion applies it instantly. `setMode` returns false when globe mode is unavailable. Rendering stops when idle, hidden or offscreen. Drag/keyboard input, selection, filters, resize and mode changes request frames; there is no perpetual animation loop or wheel capture. `destroy()` releases listeners, observers, pending land fetch, GPU resources and inserted DOM.


## Interactive Earth invitation and viewing controls

Optional `presentation:'invitation'` renders the same real land with directional
shading, brighter coastlines and unnumbered colored points at supplied origins.
It remains draggable and keyboard-accessible. No decorative city locations or
television assets are used. The caller supplies positive-count origin metadata.

The API additionally provides `zoomIn()`, `zoomOut()`, `setAutoRotate(bool)`,
`isAutoRotating()`, `pause()` and `play()`. `onZoomChange` reports bounded framing
and available directions; `onAutoRotateChange` reports the motion state. Reset
restores zoom and opening orientation while preserving the chosen rotation mode.
Auto-rotation is opt-in, stops while hidden/offscreen and follows reduced motion.
Two-finger pinch and keyboard +/− adjust zoom; there is no wheel capture. Shared
page controls own fullscreen and disable it when unsupported or denied.

## Sculpted signature globe

The `signature` presentation draws the earth as an object under museum light:
land in low relief, a dark sea with engraved waterlines, one warm key light at
two o'clock and a violet rim. Everything is derived in the browser from the
same unchanged `land.geo.json`; no elevation, bathymetry, imagery or other
dataset is added.

- **The relief is not terrain.** `src/lib/world-globe-relief.mjs` softens the
  land mask and blurs it twice. The narrow blur bevels the coast so the light
  draws the shoreline; the wide blur rounds each landmass slightly. Inland
  surfaces carry a procedural hand-worked grain. None of it represents height.
- **The waterlines are not depth.** They are contours of the wide blur: they
  record distance from the generalized coast, nothing about the sea floor.
- The graticule, atmosphere, dust field, beams and selection ring are
  decorative interface graphics.
- Each light still marks a country or broad regional anchor, never an exact
  artwork site. Core size, brightness and beam height follow the number of
  works on an absolute logarithmic scale (`lightMetrics`), so narrowing the
  period dims the world rather than re-normalising it.

On the sculpted globe the lights are drawn in WebGL. The place buttons remain
in the DOM as 44 px targets, focus rings and labels, positioned by transform;
the flat map and the no-WebGL fallback keep their visible DOM points.

The canvas starts at up to two device pixels per CSS pixel. While the globe is
turning, `createPacingWatch` samples frame pacing and steps down through
`QUALITY_TIERS` (density, fine engraving, then the dust field) if the renderer
stays below roughly 27 frames per second. It never steps back up, and a steady
30 fps cap is not treated as slow. `getMetrics()` reports `qualityTier`,
`pixelRatio` and `reliefBakeMs`; the host element mirrors the bake time and any
tier change as `data-world-relief-bake-ms` and `data-world-quality-tier`.

Software rasterisers (`startingTier`) begin two tiers down, since they pay for
every pixel on the CPU.

A canvas is cleared when it is resized, and resize observers run after a
frame's animation callbacks but before it is painted. The sculpted globe
therefore draws again inside the resize itself; otherwise the earth is painted
empty for as long as its stage is changing height, which is every time a place
is chosen or closed. `npm run test:world-browser` reads the drawing buffer
during that change and fails on any empty frame.

Zoom from buttons, keys and the wheel eases toward its goal; pinch follows the
fingers exactly. A drag turns the globe by the angle that keeps the surface
under the hand at the stage's current size, and a released drag keeps turning
briefly and settles. Reduced motion removes the easing, the inertia, the
opening sequence and the ring's ripple, and jumps straight to the resting state.

On a narrow stage the globe is sized to leave a lane at each side: a touch that
starts on the globe turns it, so a thumb needs room beside it to scroll the page.
