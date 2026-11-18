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

### Release authorization

Mike subsequently instructed Codex to push and deploy this batch. The earlier
phone-review restriction is superseded for this release. Remote review and live
deployment still need passing evidence; consult STATUS.md and the pull request
for their actual outcome.

### Current coordinator handoff

The latest instruction supersedes that deployment authorization: follow
[Issue 109](https://github.com/never-nude/atrium.earth/issues/109). This Codex chat
is a branch contributor; the designated ChatGPT conversation owns releases and
the existing CDN failure. Do not merge, deploy, cancel another thread's jobs or
start new CDN checks here without explicit reassignment.

The candidate integrates main `7b3cd20e` / PR 108 and preserves its homepage and
opening camera perspectives. Combined local validation passed: full Node suite
with 124 experience tests, production build, eight existing world-route browser
cases, four signature audit cases, and package/collection/image checks. The
package is 24,755 files / 910,383,071 bytes. The latest normal-motion Mac-hosted
WebKit measurements are 211 ms to land / 121 ms to the loaded visible still /
44.7 fps; Chromium is 357 ms / 277.6 ms / 77.6 fps. They are not iPhone results.

Earlier remote reviews failed on a 429, then an isolated body deadline. A later
recheck passed both CDN sweeps but recorded two browser model-delivery timeouts
and stalled between WebKit cases; it was cancelled and is not a pass. The branch
now bounds and checkpoints the old browser runner, with fresh processes and
unchanged case assertions/network deadlines. Five deterministic runner fixtures
and all eight real local world cases passed, including cleanup. The full remote
64-case page and gesture suites have not been run on this integrated head.

The handoff push suppresses its automatic review trigger to honor the CDN hold.
This leaves checks unrun, not passing. The coordinator must order the complete
review on the exact head before merge and verify production afterward.

The [sanitized validation handoff](step-6-validation-20261118.json) identifies the
tested code commit, local outcomes, earlier failed/cancelled runs and the gates
that remain unverified. It contains no private workspace inventories or keys.

## Prompt for Claude's independent critique

```text
Review Atrium.Earth independently, both visually and under the hood, then choose
one bounded next improvement.

Site: https://atrium.earth
Repo: https://github.com/never-nude/atrium.earth
Coordination: https://github.com/never-nude/atrium.earth/issues/109
Globe candidate: https://github.com/never-nude/atrium.earth/pull/107

Read Issue 109, AGENTS.md, STATUS.md, docs/awwwards-run.md and
docs/step-6-globe.md. Verify current main, the deployed version and pending PRs;
do not assume this candidate is live or that historical notes are current.

Inspect desktop and phone-sized visitor journeys: homepage, collection search,
artwork inspection, exhibitions/guided visits, globe, filtered collection and
fullscreen. Critique hierarchy, identity, typography, pacing, discovery, loading,
accessibility and whether the art gets sufficient space. Inspect architecture,
data projections, rendering/lifecycle costs, asset delivery and test reliability.
Be candid; challenge the existing decisions when evidence warrants it.

Give five prioritized findings. Each needs a specific URL or file/line, evidence,
visitor impact, smallest useful correction and testable acceptance criteria.
Separate observed defects, design preferences and unverified concerns. Desktop
WebKit emulation does not establish physical-iPhone behavior. Preserve and report
first-attempt failures and timeouts; do not erase them with later passes or invent
a cause. Existing CDN failures belong to the release coordinator.

Choose one high-impact improvement within the permitted scope. If you have repo
tools, implement it on a separate branch from current main, preserve others' work,
self-audit and provide local desktop and phone previews. Otherwise give one
Codex-ready brief with scope, file targets, acceptance checks and phone checklist.

Follow Issue 109: no merges, deployments, new CDN checks or cancellation of
another thread's jobs. The designated ChatGPT conversation coordinates releases.
Preserve models, provenance holds and accepted sculpture handling. Do not acquire
works or roll out more first views. Stage 3 file removal, wings, grounding and the
tilt limit remain parked. Automatic AI generation remains off.

The final Awwwards review will freeze one candidate and use a binary GO/NO-GO
checklist: every item needs passing evidence; uncertainty is NO-GO. Fixes create
a new candidate and require a fresh checklist pass. Make design decisions before
that final gate.
```

## Scope protections

Models, catalogue records, orientations and artwork-page handling are unchanged.
The shared thumbnail matte routine is extracted without changing its existing
behavior, so small world stills use the same transparent treatment. Original
stills, model files and the retained Pages copies stay protected. No acquisitions
or first-view conversions are part of this step.
