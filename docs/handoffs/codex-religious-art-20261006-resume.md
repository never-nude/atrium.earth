# Codex resume: religious-art-global-20261006, Chunk 1 orientation review

Written 2026-10-06 by the Claude Code session that took over from the earlier Codex handoff.
Read `AGENTS.md`, `STATUS.md`, `INGEST.md` and this file first. The earlier operational handoff
(`docs/handoffs/claude-code-religious-art-20261006.md`, removed from the tree in `6735f145`;
recover it with `git show 80d04c8c:docs/handoffs/claude-code-religious-art-20261006.md`)
still governs the overall plan: about 200 works in four sequential 50-work chunks, one logical
batch `religious-art-global-20261006`, published together under the owner's standing authorization.

- Worktree: `/Users/mike/Documents/Codex/2026-09-17/lwt/work/atrium-religious-expansion-20261005`
- Branch: `codex/religious-art-global-20261006` (pushed; head is the commit that adds this file)
- Nothing from this batch is on `main` or live.

## Done

1. **Chunk 1 curation (commit `6735f145`, earlier Claude session).** Removed the exact-duplicate
   `ancient-near-east/assyrian-winged-genius-ec414d`, the Sumerian cylinder seal and the Oświęcim
   congregation stamp from catalog, previews, renders, thumbnails/posters and the round-2 list.
   Verified: catalog diff is only those three removals, derived `index`/`total` renumbering and the
   Tanit artist change. Tanit now reads "Unknown coroplast (probably Sicilian)", which the museum's
   own description supports (clay composition points to Sicily). **Chunk 1 now has 39 works.**
   Note: `orientations.json` had no entries for the removed slugs, so nothing was needed there.
2. **Stray run cancelled.** Push-triggered `orientation-sheets.yml` run 37546977357 (default
   African batch, nonexistent slug file) was cancelled. Both temporary review workflows fire on
   any push touching `docs/ingest/*-orientation-round2.txt` or `docs/ingest/*-rerender.txt` and
   then use stale African defaults. Avoid those filename suffixes for new slug lists and dispatch
   manually instead.
3. **15 of 24 round-2 orientations decided and committed** (`fc1a7acd`) in `src/data/orientations.json`
   with `status: "reviewed"`, `upAxis: "y"`, `yaw: 0`. Each decision was checked against the
   ten-view sheet and the source's Sketchfab preview (`reference_image_url` in the lead file).
   - +Y up `[0,0,0]`: Faravahar, Mshatta façade section, black kippah, Mithraic relief MAK 3475,
     Arslanhane mihrab, Palki Sahib, Kamionka Strumiłowa / Chodorów / Lanckorona synagogues,
     Nine-Dome Mosque, Tanit bust, Malindi Mosque, woman-and-water-buffalo rhyton, ataurique panel.
   - −Y up `[180,0,0]`: Córdoba mihrab detail (frieze runs horizontally, matching the source preview).
   - Mshatta yaw is unconfirmed: check its rerendered thumbnail shows the decorated outer face.
4. **Six auto-posed works found misoriented** in the existing Chunk 1 thumbnails, although the
   pipeline did not flag them: incised bowl with blue trails and turquoise-glazed bowl (upside down),
   Mughal brass ewer (lying on its side), Córdoba Mosque–Cathedral doorway (shows its plain back),
   Oświęcim floor tiles (edge-on), and the zodiac marble fragment (ambiguous two-piece view).
   Slug list: `docs/ingest/religious-art-global-20261006-chunk-1-orientation-extra.txt`.
   Sheets requested as run **37547775157** (`batch=religious-art-global-20261006-chunk-1-extra`);
   it publishes to `claude/atrium-orientation-sheets-religious-art-global-20261006-chunk-1-extra-round2`.
5. The other nine auto-posed works have correct thumbnails: magic-inscription bowl, Gudea,
   buff-ware bowl, slip-painted bowl, Book of Esther, Esther scroll, Pentateuch Add MS 4709,
   Tik Torah case, Hanukkah lamp.
6. Chunks 2 and 3 were re-checked against the current catalog: no slug or source-UID clashes,
   no internal duplicates.
7. Metadata spot-audit of all 39 Chunk 1 records: open licenses, origin-based wings, reconstructions
   labeled as such. Only 6 of 39 have `dimensions`; AR-size review is still open for the rest.

## Orientation conventions (verified from `public/model-render-utils.js`)

- No orientation entry means `upAxis: "auto"`, which turns a model Z-up when it looks tall in Z.
  That is why a sheet's "A · current" is sometimes identical to "D · +Z up" rather than "B · +Y up".
  Always write explicit entries.
- `modelRotation` is degrees added to three.js `rotation.x/y/z` (Euler XYZ). Axis-up mapping with
  `upAxis: "y"`: +Y `[0,0,0]`, −Y `[180,0,0]`, +Z `[-90,0,0]`, −Z `[90,0,0]`, +X `[0,0,90]`, −X `[0,0,-90]`.
- `yaw` is added to `rotation.y`, so it is a true vertical turn only when X and Z rotations are 0 or
  180. For ±Z/±X-up choices keep `yaw: 0` or verify with a rerender.

## In flight when paused

Orientation run **37545902463** (27-slug list from `d46d5ee2`):
- Shards 0, 1, 2, 4, 5, 9 succeeded; their artifacts are `sheets-0` … `sheets-9` on that run
  (`gh run download 37545902463 -R never-nude/atrium.earth -n sheets-N`).
- Shards 3 and 6 **failed**: a single variant exceeded `RENDER_TIMEOUT_MS=180000` (shard 6:
  Suchowola variant I after the heavy Sidi Abid mesh). Shards 7 and 8 were still running.
- Because shards failed, the publish job will not create the sheet branch.

Still undecided (9): Sopoćkinie and Suchowola synagogues, Qarawiyyin minbar, Miri Piri Nishan Sahib,
Sidi Abid mihrab niche, lion statuette, Sinan Pasha Mosque, Moshir Mosque entrance, twelve-sided ewer.
Shard map: 3 = minbar, Miri Piri, Sopoćkinie; 6 = Sidi Abid, Suchowola (plus the removed seal);
7 = lion, Sinan Pasha; 8 = Moshir, twelve-sided ewer.

## Next steps

1. When 37545902463 finishes, rerun failed shards (`gh run rerun 37545902463 --failed -R never-nude/atrium.earth`)
   or dispatch a fresh run with a list of only the unfinished slugs (name it without `-round2.txt`
   / `-rerender.txt`). If publish cannot collect earlier artifacts, download per-shard artifacts.
2. Review the 9 remaining sheets and the 6 extra sheets; add explicit `reviewed` entries.
3. Put all 30 changed slugs (15 decided + 9 + 6) in a list such as
   `docs/ingest/religious-art-global-20261006-chunk-1-thumbs.txt` and dispatch
   `rerender-thumbnails.yml` with that `slugs_file`; copy the reviewed thumbnails into the branch,
   then inspect a full 39-work contact sheet.
4. Curation calls left open: the Claude session recommends keeping all five wooden-synagogue
   reconstructions (distinct destroyed buildings, labeled as reconstructions). The Miri Piri Nishan
   Sahib is a contemporary digital model of two flagpoles, not a scan of an object; it is the weakest
   record and the owner has not yet decided on it.
5. Then continue the original plan: push the corrected cumulative branch, dispatch Chunk 2 with
   `base_ref=codex/religious-art-global-20261006`, review, then Chunk 3, then build and revalidate
   Chunk 4 from its shortlist. Never run two catalog-writing acquisitions concurrently. Full test,
   build and live-verification sequence before publication is listed in the earlier handoff.

## Permission note

The Claude Code auto-mode classifier blocked reading `scripts/render-orientation-variants.mjs`.
The conventions above were derived from the viewer helper and earlier applied decisions instead.
