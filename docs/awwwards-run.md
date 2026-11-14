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

Step 2 remains in review and is not deployed. The local preview is on port 5192.
