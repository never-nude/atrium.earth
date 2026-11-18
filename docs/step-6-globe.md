# Step 6 globe review

The review branch is `codex/step-6-globe`, based on production commit `cbd17587`.
This step requires Mike's phone verdict and explicit approval before merging or
deploying. The wings, sculpture tilt limit and other pages' visual identities are
outside this step.

## Visitor behavior

- `/world/` uses Atrium's dark ground, typography, gold and purple. The homepage's
  compact explorer keeps its existing presentation.
- Each documented origin is a light. Its size and brightness follow its full
  count, without the old numeric caps. Hover, keyboard focus and selection expose
  the place name and count. An equivalent place directory supports keyboard and
  screen-reader selection.
- A place selection turns the globe over 800 ms and reveals at most twelve
  curator-ranked works. These are lazy-loaded 320 px WebP stills, not models.
  Closing restores the prior view, Globe/Map mode and page position.
- The period control drives the same origin counts and selected works. “See all”
  carries the exact documented origin and period into the collection. It does
  not substitute a broader geography facet. Invalid origin metadata fails
  closed, and the collection shows a removable place filter.
- Rotation is enabled by default. Handling and keyboard focus pause it, with
  approximately four seconds before resuming. A touch starting on the globe
  controls it; one on its surrounding backdrop scrolls the page. Touch and
  trackpad pinch zoom. Reduced motion stops automatic rotation, jumps to the
  selected place and removes reveal/point animations.

The Willendorf record's written date remains “c. 29,500 years ago.” A narrowly
guarded world projection uses its existing approximate catalogue coordinate,
27,500 BCE, so it is reachable through prehistoric time. No catalogue date is
edited and other relative-age records are not given invented absolute dates.

## Local review

```sh
npm test
npm run build
node scripts/serve-phone-preview.mjs --port 5207
```

The server prints the computer and Wi-Fi addresses. Keep the Mac awake and use
the same network on the phone. The existing restricted model relay continues to
work if a visitor follows a still to its artwork page.

```sh
BROWSER_CHECK_ORIGIN=http://127.0.0.1:5207 \
  node scripts/test-world-signature-browser.mjs
```

Each audit invocation preserves a separate timestamped report. It uses fresh
browser contexts, explicit phase deadlines and no scripted retries. It measures
navigation to the first globe frame containing land, place selection to a loaded
first still being at least half visible, and frame rate during the centering turn.
Viewport emulation on a Mac is not a physical-iPhone performance measurement.
The report also checks page errors, model requests, small controls/text,
overflow, accessibility, place/period collection membership and Willendorf.

## Phone gate

1. The page looks like Atrium, with no cyan.
2. A light centers smoothly and real works rise into view.
3. “See all” opens the matching collection and Clear removes the place filter.
4. A swipe beside the globe scrolls the page; a touch on it turns it.
5. Moving through time changes the lights. Austria includes Willendorf in
   prehistoric time.

No merge or deployment follows until Mike says the phone feels right and gives
approval.

## Frozen local candidate — 18 November 2026

The production build and full Node suite passed, including 112 experience
checks without skips. The final browser audit passed all four cases in one
invocation, with fresh contexts and no retries:

| Desktop-hosted profile | First land frame | Choose to loaded, visible still | Turn frame rate |
| --- | ---: | ---: | ---: |
| WebKit, 390 × 844, DPR 3 | 174 ms | 127 ms | 46.4 fps |
| WebKit, 320 × 640, reduced motion, DPR 3 | 236 ms | 52 ms | No animated turn |
| Chromium, 1440 × 900 | 345 ms | 275 ms | 80.8 fps |
| Chromium, 1440 × 900, reduced motion | 330 ms | 55.4 ms | No animated turn |

These are local Mac measurements, not iPhone results. The approximately 31%
reduction in phone canvas pixels did not produce a meaningful measured frame-rate
gain: the earlier DPR 3 candidate measured 46 fps. Physical-phone smoothness is
an open owner review gate.

The final audit found no model requests, browser/network errors, visible cyan,
sub-12 px phone text, sub-44 px visible controls, horizontal page overflow, or
serious/critical axe findings. Exact origin/time collection membership, Willendorf,
keyboard selection, Globe/Map restoration and selection inside fullscreen passed.
All 3,160 generated world stills have transparency and fit within 320 × 400 px;
their total is 33,142,508 bytes, 95th-percentile size 16,440 bytes, largest 36,566
bytes. Only the chosen row's lazy images are requested.

Earlier failed invocations remain recorded. The first production audit exposed
undersized footer targets and redundant artwork-link labels. The next exposed
WebKit's 22 px native place select when its directory was opened. Those were
corrected before the final invocation; this is not a claim that the first
candidate passed. No failed job was rerun to conceal a first-attempt result.

The branch has not been merged or deployed. Preview uses port 5207 with the
existing restricted model relay; the final phone verdict is pending.

The final package, bounded-collection and published-image checks each passed on
their first invocation. The package contains 24,755 files / 910,381,838 bytes,
below the existing 1,000,000,000-byte cap. All 3,160 public collection records have
unique cards, and all 6,320 published WebP/JPEG paths passed verification. The
separately gated Stage 3 reduction has not happened.

## Scope protections

Models, catalogue records, orientations and artwork-page handling are unchanged.
The shared thumbnail matte routine is extracted without changing its existing
behavior, so small world stills use the same transparent treatment. Original
stills, model files and the retained Pages copies stay protected. No acquisitions
or first-view conversions are part of this step.
