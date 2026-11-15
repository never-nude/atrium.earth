# Road to Awwwards

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
