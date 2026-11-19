# Sculpted globe review

Branch `claude/zen-lamport-u8qk48`, based on `main` at `d220a851`. This is a
contributor candidate under [Issue 109](https://github.com/never-nude/atrium.earth/issues/109):
it has not been merged or deployed, and no CDN check was started for it.

It changes how the globe is drawn on `/world/` and in the homepage preview.
Places, counts, the period control, selection, the artwork stills, collection
links, Globe/Map modes, the place directory and keyboard access are the existing
behaviour and data.

## What a visitor sees

- **An object, not a diagram.** Land is cast in low relief and lit by one warm
  key light at two o'clock with a violet rim, the same direction as the
  homepage's featured sculpture. The coast is drawn by that light: gilded where
  it faces the key, violet in the shadow. The sea is dark lacquer with engraved
  waterlines and a 30° graticule.
- **Lights are light.** Each documented origin is drawn in WebGL as a solid
  point with a glow and a hairline beam, on the same absolute scale as before
  (more works, brighter). They ease in and out as the period changes and come on
  from the lit east when the globe first appears. The chosen place turns violet
  with a ring on the surface.
- **A larger earth in less space.** In the overview, Globe/Map, Reset and the
  viewing tools float in the stage's own margins. At 1440 × 900 the globe is
  about 543 px across (483 px before) with its tools above the fold; on a 390 px
  phone about 313 px (299 px before) in a stage that is 36 px shorter overall.
  Choosing a place returns the tools to the page flow beside the works, as before.
- **It answers the hand.** A sideways drag turns the globe by the angle that
  keeps the surface under the pointer at the current size (vertical turning
  keeps its earlier 0.7 gearing), a released drag coasts and settles, and zoom
  from buttons, keys and the wheel eases. Reduced motion removes all of that.
- **It turns a little sooner and a touch faster**, at the owner's request: it
  resumes three seconds after a hand lets go (four before) and turns 2% faster
  (0.0459 radians a second, 0.045 before).
- **The flat map** uses the same bronze and lacquer. It keeps its DOM points.

The relief and waterlines are a stylised emboss of the bundled Natural Earth
coastline. They are not terrain or bathymetry; see
[`public/world/ATTRIBUTION.md`](../public/world/ATTRIBUTION.md). No asset,
dataset or dependency was added.

## A defect this fixes on the live site

A canvas is cleared when it is resized, and resize observers run after a frame's
animation callbacks but before it is painted. The globe only scheduled its next
draw, so every frame of the stage's height change was painted with an empty
canvas: the earth disappears for the length of that transition each time a place
is chosen or closed.

Reading the drawing buffer from a later observer in the same frame, on a 1440 ×
900 Chromium page with a software renderer:

| Code | Resize frames | Painted empty |
| --- | ---: | ---: |
| `main` (`d220a851`), normal motion | 11 | 11 |
| `main` (`d220a851`), reduced motion | 1 | 1 |
| This branch, normal motion | 9 | 0 |
| This branch, reduced motion | 1 | 0 |

The sculpted globe now draws again inside the resize. `npm run test:world-browser`
has a final phase, `stage resize never paints an empty globe`, that fails on
`main` and passes here. It runs after every recorded timing.

## Defects an independent review found, now fixed

Two reviewers read the first commit of this branch separately and reported the
same four defects, plus two more. Each was reproduced on that commit and
re-run after the fix, in headless Chromium on a software renderer:

| Defect in the first commit | Before | After |
| --- | --- | --- |
| The selection ring was aimed with `lookAt`, which works in the room's space, not the turning earth's, so it showed as a tilted crescent | tilted 25–29°, 30 of 72 rim points under the surface | 0°, 0 of 72 |
| Lights were drawn on the surface but their targets sat 2.5% above it, so a click exactly on a light could open its neighbour | 19 of 92 lights in the opening view; United Kingdom opened England | 0 of 92 |
| Wheel zoom stood still while wheel events kept arriving, then jumped | moved 0 during a 1.05 s stream | moved throughout |
| A slow, steady drag was read as a slow renderer and lowered quality for the rest of the visit | two to three tiers down | stays on its tier |
| The flat map took its density from the WebGL quality tier | 0.85 device px per CSS px | 1.0 at DPR 1, as before this branch |
| With the coastline request failing, the stage was empty in Globe mode | blank canvas | plain sphere behind the message |

Smaller ones fixed with them: the 180° meridian was drawn heavier than the
others, one square root could be given a value a hair below zero, and a comment
about the halo was false.

`scripts/world-globe-look.test.mjs` is new. Its three tests fail on the first
commit and pass now: the ring lies on the surface however far the globe has
turned, each light is drawn at the vector its target is projected from, and the
bare sphere shows nothing that looks like a choice.

The review was stopped early at the owner's request to limit its cost. Two of
its five reviewers finished; the layout, test-suite and documentation reviewers
and the two visual critics did not, and no finding was sent to a second
verifier. Each fix above was instead reproduced and re-run directly.

### Found by the review, already on `main`, not changed here

- In Map mode on a touch screen, a tap on a light never selects it: every
  page-owned touch suppresses the click that follows. The place list works.
- If a second finger rests outside the stage while the globe is turned, the
  globe stays held after both lift and the next tap is swallowed.
- A hover label can stay visible when the pointer leaves the stage in one step.
- Reset exploration jumps rather than turns.

### Introduced here, not fixed

- At phone width the hover or focus label of the northernmost lights can sit
  under the floating Globe/Map and Reset controls. A tap is unaffected: it
  selects, and the controls then return to the page flow.

## Rendering cost

The surface shader reads two textures per pixel and computes the grain only on
land. The relief bake ran in 36–40 ms for a 1,024-texel coast and 88–133 ms for
the 2,048-texel coast used on stages of 1,000 device pixels or more, measured
once at load in headless Chromium with a software canvas.

The canvas starts at up to two device pixels per CSS pixel (1.25 on phones and
1.5 elsewhere before). If the globe stays below about 27 frames per second while turning it
steps down through `QUALITY_TIERS` and never back up. A software rasteriser
starts two tiers down.

Frame pacing under Chromium's software renderer in this container, where every
pixel is shaded on the CPU. This is not a GPU or phone measurement:

| Profile | `main` | This branch |
| --- | ---: | ---: |
| 1440 × 900, DPR 1, auto-rotating | 31.1 fps | 27.1 fps (tier 3) |
| 390 × 844, DPR 3, auto-rotating | 45.5 fps | 32.0 fps (tier 2) |

**No frame rate on a real GPU or a physical phone has been measured.**

## Local review

```sh
npm install
npm run dev
```

Then open `http://localhost:4321/world/` and
`http://localhost:4321/#explore-the-world`. For a phone on the same network use
the existing `node scripts/serve-phone-preview.mjs --port 5207` after
`npm run build`.

## Phone checks for the owner

1. The globe reads as a lit object, with no cyan.
2. Choosing a light turns the globe without it vanishing, and the works rise.
3. A swipe beside the globe still scrolls the page; a touch on it turns it. The
   globe is wider than before, so the lane at each side is about 39 px on a
   390 px phone (45 px before).
4. A flick coasts and settles; pinch zoom follows the fingers.
5. Moving through time dims and lights origins smoothly.
6. The tools under the globe do not crowd it.

## Validation on this branch

All of this ran in a Linux container with headless Chromium on a software
renderer. Each line is the first attempt unless it says otherwise.

- `npm test`: exit 0. The experience suite ran 135 tests: 134 passed and one
  skipped because the repository's pinned Playwright cannot find its matching
  Chromium build here. Eleven of the 135 are new (`scripts/world-globe-relief.test.mjs`).
  While writing them, three assertions sampled the wrong texel or used too tight
  a tolerance and were corrected; the code under test did not change for them.
- `npm run build`: 8,839 pages, exit 0, four times as the code settled. The
  fourth build is the committed code, and `npm test` was run again after it.
- Package: 24,759 files / 899,510,293 bytes against the 1,000,000,000-byte limit.
  Collection window and published-image checks passed.
- Globe browser audit, using a copy of `scripts/test-world-signature-browser.mjs`
  adapted only to launch the container's Chromium with a software renderer. It
  ran once on each of the four builds with the same outcome each time; the
  figures are from the fourth:
  - `chromium-1440-no-preference`: passed. First land frame 289 ms, choice to a
    loaded visible still 172 ms, centering turn 22.8 fps on the software
    renderer, whole globe above the fold (225–877 of 900 px), homepage selection
    and return, fullscreen, zero model requests, no console, page or asset
    errors, no serious or critical axe findings, no overflow, sub-12 px text,
    sub-44 px control or cyan.
  - `chromium-1440-reduce`: passed.
- **WebKit is not installed here, so the suite's two WebKit cases did not run.**
  As a stand-in only, the same two phone profiles ran in Chromium:
  - 320 × 640 reduced motion: passed.
  - 390 × 844 normal motion: passed, including fullscreen selection at phone
    width (still visible 260 ms after the choice, internal scroll restored).
    These notes first recorded a failure in this case and called it an untested
    phone-width combination. That reading was wrong:
    [it was the stand-in harness](#the-stand-in-failure-that-was-not-a-defect).
- The new resize phase failed on its own first run in reduced motion because it
  took its starting height after the selection had already been applied. The
  phase was corrected; the product code was not involved.
- The resize defect was found in the first build's audit: its fullscreen
  screenshot showed an empty canvas although both desktop cases had passed.

### After the review fixes

The same container, on the fixed code:

- `npm test`: exit 0. Experience suite 139 tests: 138 passed, the same one
  skipped. Four are new with the fixes.
- `npm run build`: 8,839 pages, exit 0, and it leaves no untracked file.
- Package: 24,759 files / 899,512,036 bytes. Collection window and
  published-image checks passed.
- Globe browser audit, same adapted copy: both Chromium cases of the suite
  passed, and so did both phone-size Chromium stand-ins. No resize frame was
  painted empty (0 of 11, 0 of 1, 0 of 12, 0 of 1), and there were no console,
  page or asset errors and no model requests.
- Each defect in the table above was reproduced on the first commit and re-run
  on the fixed code with the reviewers' own scripts.

## The stand-in failure that was not a defect

The first Chromium stand-in for the 390 × 844 case failed in `whole-world
fullscreen selection and internal-scroll restoration`, on this branch and on
`main` alike. These notes recorded it as an untested phone-width combination.
It was the harness, not the page.

The suite runs its functional phase only in the WebKit phone case and its
fullscreen phase only in the Chromium desktop case. The stand-in ran both in one
page. The functional phase ends with the Venus of Willendorf's date range
(27,500–25,000 BCE) still applied, and the fullscreen phase then chooses Egypt.
Egypt has 81 works on the globe, the earliest from 3000 BCE, and none in that
range; Austria is the only place lit in it. The phase waited seven seconds for
a still the page was right not to show.

All runs are headless Chromium on a software renderer against the same build:

| Run | Functional phase first | Fullscreen phase |
| --- | --- | --- |
| 390 × 844, fresh page, fullscreen then Egypt | no | selection shown; visible event at 402 ms |
| 390 × 844, suite phases without the functional one | no | passed: still visible in 84 ms, scroll 546 → 265 → 546 |
| 1440 × 900, functional phase put in front | yes | failed the same way as the phone stand-in |
| 390 × 844, with the phase clearing a leftover filter | yes | passed: 260 ms, scroll 0 → 190 → 0 |
| 1440 × 900, with the phase clearing a leftover filter | yes | passed: 193 ms, scroll 0 → 133 → 0 |
| 1440 × 900, the suite's own order | no | passed: 185 ms, scroll 402 → 165 → 402 |

The scroll figures are the fullscreen root's position before the choice, while
the works are shown, and after closing.

The fullscreen phase now returns to all periods first if an earlier phase left a
date filter, so it no longer depends on the order of the suite. In the suite's
own order that branch is not taken. Product code did not change, and this says
nothing about WebKit, which still has not run.

## Not established

- Any WebKit result, any physical phone, and any real-GPU frame rate.
- The 64-case page suite and the sculpture gesture suite (`test:browser`,
  `test:handling-browser`): not run here.
- Remote review and both live CDN checks: not run at the time of writing. The
  owner has since designated this session release coordinator for this pull
  request, so the remote review runs on the head that carries these notes; its
  result is recorded on the pull request, not here.
