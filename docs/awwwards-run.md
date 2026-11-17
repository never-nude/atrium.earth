# Road to Awwwards

## Final submission review

Freeze the release candidate before the final Awwwards review. Use a binary go/no-go checklist with evidence for every item. Submit only when every item is go. A failure, missing evidence, or uncertainty is no-go. Reopen work in a new candidate if a fix is needed, then run the checklist again on that candidate. Make all design and implementation decisions before the final review.

## 2026-11-13 — Step 0 and Step 2

The baseline uses the approved artwork backdrop revision `5115f672`, merged and deployed from `dcf53240` in [PR 83](https://github.com/never-nude/atrium.earth/pull/83). The Pages deployment succeeded in [run 43549748968](https://github.com/never-nude/atrium.earth/actions/runs/43549748968).

| Baseline measure | Result |
| --- | --- |
| Public collection | 3,122 works. The homepage states the total and labels the 1,928 globe entries as works mapped by origin. |
| Uncompressed Pages tar | 967,577,600 bytes on the local build. The files inside total 861,432,483 bytes. |
| Recorded model previews | 3,141 entries. 1,048 exceed 3 MB, 812 exceed 5 MB, 193 exceed 25 MB, and 15 exceed 100 MB. Largest is 273,799,496 bytes. |
| Collection filter choices | 937 places, 1,362 materials, 7 periods, 5 wings, and 3 size statuses, excluding placeholder options. Maker groups are rendered separately from those selects. |
| Long-title Save at 375 px | Saint Jerome Save is 44 px high, its right edge is at 355 px, and page overflow is 0 px. |
| 390 px homepage | 87 text elements below 12 px and 36 controls below 44 px in at least one dimension in the Chromium baseline. |

The existing Node checks pass through `npm test`. The new Playwright suite treats the six visitor routes, the Bodies in Motion entry, and the custom 404 as release gates. It checks Chromium and WebKit at both widths. Reports and screenshots are retained by both workflows. The release gate tests the static package before upload so it exercises the same files that Pages would serve.

The baseline showed mismatched visible and spoken labels, an unnamed globe result link, and low contrast on the Surface exhibition's secondary action. The candidate uses accessible visible names, labels the globe results link, and makes the secondary action's background transparent. No 3D input or controls were changed. Text smaller than 12 px, targets smaller than 44 px, and the homepage 2.5 s / 1.5 MB Lighthouse budgets are report-only for the staged plan.

The review also caught capped globe marker counts missing from spoken labels. The browser suite tests the original CDN model bytes on the local build with a loopback-only origin allowance. A simulated foreground/background match on the `Begin exhibition` button failed the browser check at both Chromium widths. Deleting the old colour rule alone kept the button readable because a fallback already supplied a contrasting colour.

On November 14, Mike approved [PR 84](https://github.com/never-nude/atrium.earth/pull/84). The PR merged as `b4139c95` and [Pages run 43594595255](https://github.com/never-nude/atrium.earth/actions/runs/43594595255) deployed it. All 32 browser checks passed on the production build and again on atrium.earth. The release verified 6,244 artwork image files. Live Chromium at 375 px confirmed that Discobolus and the first guided stop both open, orbit, pause and resume, with normal page scrolling while paused and zero overflow. A simulated unreadable exhibition button failed all four engine and viewport combinations.

The release Lighthouse run measured 3.46 s LCP against the 2.5 s target and 467,892 transferred bytes against the 1.5 MB budget. Live Chromium and WebKit each reported 87 text elements below 12 px and 36 controls below 44 px on the 390 px homepage. These measurements are report-only in this step.

## 2026-11-14 — Step 2B draft

Branch `codex/step-2b-preview-audit`, based on main `b8b054660`. The November 14 programme was pinned for local comparisons. The public catalogue at baseline has 3,122 works, 37 assigned to Oceania, and 250 reviewed featured works.

| Check | Live baseline | Local draft |
| --- | --- | --- |
| Pressed comparison Auto-rotate text | 1.20:1, below the 4.5:1 threshold | 11.75:1 |
| Cold homepage bytes with normal motion | 3,492,904 at 1440 px and 3,461,736 at 390 px, measured without scrolling on the live site | Lighthouse measured 3,953,836 bytes, including a 2,658,137-byte hero transfer. The local Lighthouse and live browser methods differ. |
| Four homepage previews | All four reached ready, 6,697,936 total bytes at 1440 px and 6,644,396 at 390 px after scrolling | Ready frames audited with motion allowed. |
| Lighthouse LCP | Prior PR 84 record, 3.46 s | 3.74 s, above the 2.5 s report budget |
| Local Pages package | Prior audit, 967,577,600-byte tar | 971,571,200-byte tar with 865,375,415 bytes of files. The 500 MB target belongs to step 4. |

One pressed toggle rule lives in `Viewer.astro`. The test suite now inspects ready canvases and text contrast with motion enabled, alongside the eight existing routes in reduced motion. The live defect failed the new check at 390 px before the fix. Canvas checks exclude overlaid DOM elements, and a deliberately flat canvas behind a marker failed the revised check. Lighthouse serves the homepage's available GLBs through a temporary loopback relay so the production CDN's origin restriction does not hide their transfer cost. The relay was checked against the original hero bytes.

Collection counts use grouped thousands. About now describes the Examine in 3D interaction on work pages. At 375 px, Discobolus and the first guided stop were checked on live and local builds: both loaded, responded to drag, paused, scrolled, and resumed without sideways overflow. No sculpture input behaviour was changed.

Pending owner decisions: 39 straightforward casing fixes and 21 additional museum-title casing alignments, the proposed 3,000,000-byte auto-start cap, and any changes to the 34 confirmed and two unresolved promoted works in the review. The cap would affect Belvedere Torso (7,200,532 bytes) in the seven-work November 14 hero queue and none of the four previews displayed that day. The current AR/VR template uses the first of its three configured examples as its page image. The other two are not displayed as a dedicated example row.

The draft passed `npm test`, the full build, all 32 reduced-motion and 12 normal-motion browser checks across Chromium and WebKit, and the Pages, collection-window and artwork-image verification scripts. Reviewed 390 px and 1440 px screenshots of touched route types. No physical phone or live deployment checks for the draft.

No pull request or deployment for Step 2B yet. Recheck the final step after the owner's decisions. The 26 reviewed Pacific additions are checkpointed separately, with acquisition publication on hold during the Pages package work.

### Step 2B after Mike's decisions

The candidate applies 39 reversible headline-case corrections, including the eight exact titles Mike supplied. Museum wording remains recorded in the existing evidence and in `docs/step-2b-title-casing.json`. The 21 casing alignments and 17 wording alternatives are deferred to step 8.

An automatic preview is limited to a known model size of 3,000,000 bytes. Its still must decode and have a visible frame to paint before the first request. Explicit activation can open heavier works. Delaying the Lion still in Chromium and WebKit held every model request until the still painted. The alternate programme date was checked with the 7,200,532-byte Belvedere Torso. Both engines showed the still and kept the model idle until Examine in 3D was selected.

All 36 approved exclusions remain public and were removed from featured promotion. There are 250 reviewed featured works and 3,122 public works. The gallery card on the homepage picks a work from the featured list when that room has one. Rooms with none show the gallery invitation without an artwork image. This keeps Selma Burke's work out of the rotating homepage card and available in its gallery.

The current November 9–15 UTC programme compares Meissonnier's *Covered Tureen on Stand* with the Persian *Bowl with Courtly Scene* as **Ornament Follows Form**. The hero queue in order is *Bowl with Courtly Scene*, *Covered Tureen on Stand*, *Animal vessel (Underwater Panther)*, *Prestige Stool (Kuo fo)*, *Saint Jerome and the Lion*, *Belvedere Torso*, and *Lion*. The November 15 UTC build uses *Lion*.

| Measurement | November 15 UTC build | Result |
| --- | ---: | --- |
| LCP | 3.392 s | Above the 2.5 s target |
| Bytes before the hero still painted | 447,864 | Under the 1,500,000-byte budget |
| Bytes before interaction | 1,756,777 | Includes the only automatic model, the 485,848-byte Lion |

The still presented at 560 ms and the Lion request started at 900 ms in the Chromium trace. Lighthouse reports LCP with simulated throttling. The two transfer figures use observed network timing. In steps 4 and 3 the 1.5 MB transfer limit applies to bytes before the still paints. One model of up to 3,000,000 bytes may then start automatically.

The final candidate passed unit tests, the production build, 32 reduced-motion browser checks and 12 normal-motion browser checks in Chromium and WebKit. All 24 examined canvases rendered and the lowest pressed toggle contrast measured 11.75:1 after the 1.20:1 live failure. At 375 px the work page and first guided stop passed the input and scrolling comparison with no sideways overflow. Reviewed representative screenshots of the changed route types at 390 and 1440 px. The Pages tar measured 971,571,200 bytes and all collection and artwork-image checks passed. Physical phone and live deployment checks are pending.

Step 2B is prepared on `codex/step-2b-preview-audit` and awaits deployment approval.

## 2026-11-15 — Sculpture handling

Branch `codex/handling-hybrid`. The same OrbitControls input rules now apply to manual, visibility-started, and preview viewers. An initial vertical touch scrolls the page. An initial sideways touch claims orbit until release. Two-finger touch pans or pinches the sculpture, and full screen enables free orbit. The stage resumes automatic rotation four seconds after input. The first live sculpture shows one short hint and dismisses it on a turn. The still-image activation and the guided visit's wheel-zoom opt-out are preserved.

| Check | Live baseline at `8722484` | Candidate |
| --- | --- | --- |
| 390 px homepage vertical swipe | 89 px page scroll with a camera nudge | Passed native scroll with no visible camera movement |
| 390 px homepage sideways and pinch | 0.0027 camera travel, no tilt, no pinch zoom | Passed orbit, tilt and pinch with the page stationary |
| 390 px Surface vertical swipe | 0 px page scroll, camera moved | Passed native scroll with no visible camera movement |
| 1440 px homepage first drag and wheel | 0.0063 camera travel on drag, wheel passed | Both passed |
| Hint and timed rotation | First rotating preview had no hint | Hint faded on the first turn and stayed dismissed in the session. Rotation restarted 4,013 ms after release. |

The Node tests and complete 8,719-page build passed. The release checks verified 3,122 public collection cards and 6,244 artwork images. Chromium native full screen and the WebKit overlay both changed canvas touch action from `pan-y` to `none` and back. The local homepage Lighthouse run reported 3.389 s LCP, 437,112 bytes before the still, and 1,746,025 bytes before interaction. These performance measurements are report-only in this step.

Serve the built candidate for phone review with `node scripts/serve-phone-preview.mjs`. It listens on port 5196 and prints the Mac's LAN address. It resolves only catalogue-listed model URLs. Automated WebKit cannot reproduce iPhone Safari scrolling. The physical phone test comes before requesting deployment approval.

### Revised after the iPhone test

The phone test showed that deciding by the direction of the drag was hard to predict. The replacement decides at touch-down. Touching the sculpture claims the gesture and raises a purple light behind it. Touching the backdrop or touching during momentum gives the gesture to the page. A second finger can claim a pinch from the backdrop when its midpoint is on the sculpture and the page is still.

The viewer samples the alpha of its existing rendered frame at a small size. The hit test uses a 12 px touch tolerance. It excludes the grid and cast shadow, and landing does not render or read from the graphics card. If a rendered frame yields no readable silhouette, the viewer falls back to projected artwork bounds. The visible pick mode is recorded on each live stage for verification.

Automated WebKit cannot reproduce iPhone Safari scrolling. Review the updated build over Wi-Fi before asking for permission to deploy.

The revised regression suite passed all 14 location, wheel, and camera assertions on the built candidate. With motion enabled, the hint disappeared on the first turn and rotation resumed after 4,014 ms. Both Chromium and WebKit used the silhouette on all ten tested viewer slots, including the homepage previews, Surface, a guided stop, Discobolus, the paired exhibition cover, and a wing hero. The complete production build and Node suite passed.

On November 15, Mike approved the touch-down handling after the iPhone trial. [PR 88](https://github.com/never-nude/atrium.earth/pull/88) published it with a 160 ms fade in and 220 ms fade out for the light. The [Pages release](https://github.com/never-nude/atrium.earth/actions/runs/43767796471) passed 44 page checks and 14 gesture checks. The live suite passed on retry after a phone-width homepage model load timed out on the first run. Live automatic rotation resumed after 4,003 ms.

Mike then asked to remove the purple hold light. The follow-up removes the light, its styling and the silhouette center calculation used to position it. The gesture tests check whether the sculpture claims the touch by observing native cancellation on contact.
