# Shared project handoff — atrium.earth

Setup date: 2026-09-19. This section records repository setup, not a full application audit.

## Repository identity

- Repository: https://github.com/never-nude/atrium.earth
- Default branch observed: `main`.
- Scope: this repository only. Related versions are not automatically interchangeable.

## Evidence and current state

README describes the Astro sculpture museum. Inspect current source and deployment configuration before application work.

README.md was inspected for project context (observed blob `512ea6af19a98afa7d6e0b28e9ddf1dc7ce5f345`). Its existing statements are not new runtime verification.

## Handoff setup

- Task: shared Codex context across this chat and two computer checkouts.
- Owner of this documentation task: ChatGPT Codex session.
- Setup branch: `codex/shared-handoff-20260919`.
- Changes: AGENTS.md session-start/session-finish rules plus this status record; application code unchanged.
- Validation: checked availability of root instructions and status; preserved existing documents/history. No application runtime tests were performed for this documentation-only task.
- Delivery: check the setup pull request in GitHub for merge status. If these changes are on the remote default branch, they are integrated there; this does not establish deployment success or local computer synchronization.

## Unverified local work

Neither computer's checkout, uncommitted changes, unpushed commits, local paths, running tasks, nor separate Codex conversations has been inspected. Do not mark either machine synchronized based on these files alone.

## Next session

1. Read AGENTS.md and existing project instructions.
2. Inspect the local remote/branch and preserve pending work; fetch and safely integrate the shared default branch.
3. Record discovered unfinished work, its branch, actual validation, and next step here. Reconcile it with remote history before implementation.
4. At task completion, update this handoff and publish it through the existing repository workflow when authorized.

## Future handoff fields

Task / owner / branch:
Completed:
Validation actually performed:
Open issues / blockers:
Next step:
Delivery (local, pushed, merged, deployment verified):

## 2026-09-19 — 35 reviewed sculpture additions

- Task/owner: Atrium acquisition session in local Codex, publishing at the user's explicit request. Publication work was isolated in a detached worktree; the earlier working checkout was preserved. The other computer's local state has not been inspected.
- Base: application commit `4633a40134cb79a7cc1c3cde44d6993944669dbf`, followed by shared handoff commit `4e72b06cc472877cfa28023fdfc4c0190878ae67`. The concurrent handoff changes were incorporated before publication. Current user authorization covers site publication and supersedes the June handoff's harvesting-only workflow for this task.
- Completed: 35 new 3D works, real rendered thumbnails, provenance and license records, explicit size-review statuses, and six additions to existing exhibitions. All 1,224 prior catalog entries and existing assets/settings are preserved. Five new works have documented unknown production locations and use the existing Unfiled route. Newest Additions remains neutral and shows only the current batch.
- Validation: immutable source hashes and eligible licenses for all 35; four-angle geometry review; final thumbnails; asset verification; addition grouping; wing routing; museum-label tests; production build; browser checks of all 35 newest links and interactive samples for Canova, Summers and Zariņš. Browser checks recorded no page errors or failed asset requests. Local and uploaded Git trees were compared.
- Known baseline issue: the full physical-dimensions test encounters 147 older public works without explicit review entries, beginning with `americas/lewitt-cubic-modular-wall-structure`. All 35 new dimension entries pass separate validation; prior dimension records were preserved. No physical-scale calibration was added.
- Remaining acquisitions: of 50 discoveries, 12 await actual source files and three scans are held for missing or uncertain surfaces. Exact identities and reasons are in `docs/ingest/new-additions-20260919.json`. These 15 are not counted as published works.
- Delivery: this changeset is the authorized publication of batch `new-additions-20260919`. Production deployment must be verified against its GitHub Pages run; local checks alone do not establish that it is live.
- Next step: verify the deployed batch at `/newest/`; retain the 12 download leads and three scan holds for future acquisition work. No state is inferred for another machine's checkout.

### Production confirmation — 2026-09-19

Acquisition commit `f1d6d6af8fd45af658c25d0db4cdddcbce34122d` is deployment-verified. [GitHub Pages run 35439817021](https://github.com/never-nude/atrium.earth/actions/runs/35439817021) completed successfully. Live checks found exactly 35 selected works at `/newest/`, fetched all 35 work pages, matched SHA-256 hashes for all 35 models and 35 thumbnails, and confirmed all six exhibition placements. The publication worktree was clean at that commit; the earlier checkout and other computer remain outside this synchronization claim. This confirmation changes documentation only. The next acquisition work is the 12 pending downloads and three quality holds documented above; the 147 older missing dimension-review entries remain a separate backlog.

## 2026-09-19 — Stronger desire and intimacy acquisition search

- Task: the user requested 50 more 3D artworks with a stronger erotic emphasis. Local Codex owns this acquisition task on `codex/desire-acquisitions-20260919`, starting from `3d9e2f22a9dab5e59f88130ad25970082cd8c3a4`.
- Current stage: discovery, source verification and duplicate screening against the 1,259-record catalog. Prior publication and source-quality requirements remain in force. No new acquisition in this continuation is counted as live yet.
- Next step: acquire actual eligible files, review geometry and metadata, prepare thumbnails and appropriate placements, validate and publish the accepted additions under the user's continuing authorization. Unavailable files and rejected scans must remain separately reported.

### Prepared publication — eleven modern figurative additions

- Revised scope: the user requested more realistic modern sculpture with adult intimacy central. Eleven distinct works passed source acquisition and geometry review; the requested target of 50 was not reached. Historical artifacts and abstract symbols from the earlier search are held outside this batch. Search hits are not counted as acquired works.
- Completed: 11 optimized, self-contained 3D models, 11 rendered thumbnails, source hashes and CC BY attribution records, explicit dimension reviews, and three placements in existing exhibitions. All 1,259 earlier catalog entries and their settings are preserved; the resulting catalog has 1,270 records and 1,258 public works. Newest Additions shows only the eleven latest works with neutral wording. Two pieces with unverified origins have explicit Unfiled explanations.
- Quality qualifications: the accepted alternate Rivoire scan has complete figures with rough peripheral base edges; the original scan was rejected for missing rear surfaces. Benítez’s untextured scan retains its bench and pavement. Uncertain attributions, unknown dates and unknown dimensions remain explicitly qualified.
- Validation performed: immutable source hashes and self-contained GLBs for all eleven; four-angle review and final hero review; asset verification; addition grouping; wing routing; production build; museum-label checks across all 1,258 public works; independent dimension validation for all eleven additions. The full dimensions test still fails at the same older LeWitt entry; exactly 147 older public works lack reviews before and after this import. No scale calibration was inferred from text alone.
- Publication authorization: the user explicitly authorized pushing all the way to Atrium and requested email notification after live verification. No private notification address is stored here. Main was fetched and remains at the stated base; another machine’s uncommitted work is not observable.
- Delivery: this changeset prepares batch `new-additions-20260919-b` for the authorized publication. Deployment and live asset checks must be recorded separately after the push.
- Final local browser verification: exactly eleven newest links and all thumbnails load; Puttinati, Canto da Maya and Rivoire reach live 3D rendering and remain interactive after dragging. No application errors or artwork asset failures occurred. Chromium blocked the shared third-party analytics script; that separate non-blocking warning is retained in the local browser report.

### Production confirmation — eleven-work batch

Acquisition commit `ab9f6005b99403701c396fc7097ddecf58637b67` is deployment-verified. [GitHub Pages run 35443548737](https://github.com/never-nude/atrium.earth/actions/runs/35443548737) succeeded. Live checks found exactly the selected eleven works at `/newest/`, fetched all eleven work pages, matched SHA-256 hashes for all eleven models and eleven thumbnails, and confirmed all three exhibition placements. The publication task branch was clean at the acquisition commit. The requested completion email was sent after those checks. This confirmation changes documentation only. The target of fifty remains unmet; no further acquisitions are implied, and held sources and quality exclusions remain in the ingestion report. The existing 147-entry dimension-review backlog remains separate.


## 2026-09-19 — Seven reviewed sculptures and Pauline scan upgrade

- Task/owner: this local Codex acquisition session on `codex/sensual-sculpture-20260919`; user reviewed eight local candidates, requested a publication hold, then explicitly authorized publication with “push”. Other computer state has not been inspected.
- Concurrent reconciliation: main advanced from `4633a40` to `b831aae` while approval was pending. All 46 concurrent additions are retained. One is the same Canova composition, accession LIV, so the approved clearer MTP/Polycam scan upgrades `europe/pauline-bonaparte-canova-borghese` instead of adding a duplicate. Its canonical URL, index and original ingestion metadata are retained; replaced-scan provenance is recorded in the next-pass ingestion report.
- Completed: seven new works plus that one scan upgrade, reviewed orientations and real thumbnails, visible source/quality credits, exact model and thumbnail hashes, and explicit dimension reviews. Catalog has 1,277 records and 1,265 public works. Newest Additions lists seven new works. The other 1,269 earlier catalog records and their runtime settings are unchanged. No new physical-scale calibration is asserted.
- Licensing: seven approved scans are CC BY 4.0; Mia’s Yogini scan and its adapted model and renders are CC BY-SA 4.0. All source downloads used public access; login-dependent sources were skipped.
- Validation: three-angle full-object review, original/cleaned comparisons for Paolina and Clodion, independent metadata and asset audit, wing routing, newest grouping, catalog assets, whitespace checks, 3,359-page production build, museum-label checks across 3,795 layouts, and local HTTP/hash checks of all eight canonical pages/models/thumbnails. Interactive browser verification is unavailable because the Mac is locked; local full-model renders were reviewed. Existing 147-entry dimension-review backlog is outside this change.
- Delivery: user-approved publication is prepared in this changeset. Deployment is not inferred from a local build; next step is to push the reconciled commit and verify its GitHub Pages run plus all eight live pages and asset hashes. Report deployment confirmation separately.

### Production confirmation — seven additions and Pauline upgrade

Publication commit `46de11f4f4fafaa9acda6279fd5661f575c15c83` is deployment-verified. [GitHub Pages run 35446937659](https://github.com/never-nude/atrium.earth/actions/runs/35446937659) succeeded. Live checks found exactly the seven new works at `/newest/`, verified all eight canonical work pages and full source credits, and matched SHA-256 hashes for every approved model and thumbnail, including the MTP scan replacing Pauline. The working tree was clean after publication; no state is inferred for the other computer. This confirmation changes documentation only. No publication action remains for these reviewed works; earlier acquisition holds and the separate dimension-review backlog remain unchanged.

## 2026-09-19 — Twenty further figurative additions

- Task/owner: this ChatGPT Codex acquisition session, on `codex/charged-publication-20260919`, continuing the user’s request for twenty more charged works with lesser-known works welcome.
- Reconciliation: the original isolated draft began at `b831aae`; publication now starts from `c22c09f37bc3adf2e94e051bc19742d699b20b9b`. The seven concurrent acquisitions and Pauline scan upgrade are preserved. Clodion’s group and the Harvard reclining nymph were already added by that update, so those two draft entries were replaced with distinct reviewed works. The batch adds twenty new catalog entries, with no duplicate composition counted as an addition.
- Prepared: twenty openly licensed, self-contained GLBs, catalog attribution and source hashes, twenty explicit dimension reviews, neutral Newest Additions metadata, and three placements in existing exhibitions. All 1,277 previous records and their settings are retained. The resulting catalog contains 1,297 records and 1,285 public works.
- Quality: maker, date and origin uncertainties remain explicit. Rough scan texture and peripheral ground are disclosed. Separate scan platforms or excess floor context were trimmed only where clearly identified. A large Rivière scan was compacted from 18.3 MB to 1.29 MB and reviewed again from four directions; no missing sculptural surfaces were reconstructed.
- Validation completed: all twenty models are self-contained and match recorded hashes; twenty final thumbnails were rendered and reviewed; newest grouping and wing tests passed; the reconciled production build generated 3,410 pages. Browser checks loaded all twenty newest links and thumbnails, exercised three interactive models, and passed sixty museum-label layouts with no application errors or failed local requests. A semantic audit preserves all 1,277 prior records/settings. The separate 147-entry dimension-review backlog remains unchanged; no physical-scale calibration is added.
- Delivery: this changeset prepares the authorized publication. Next step is to publish the exact validated tree and verify its GitHub Pages deployment; no deployment success is inferred from local checks. Other computer state has not been inspected.


### Deployment confirmation — twenty-work batch

Publication commit `dcb347d47e00bf9e6b316a25987e531d751b018c` was published successfully by [GitHub Pages run 35456017002](https://github.com/never-nude/atrium.earth/actions/runs/35456017002); both build and deploy completed successfully. This ChatGPT Work continuation recovered the interrupted upload, verified all 50 publication files against their saved Git blob hashes, completed the remaining uploads, and confirmed that the GitHub tree exactly matches the validated local tree (`25c2ae12c386f10d15f6f76463730ea1a27cd6ed`). The twenty-work batch is on `main` and can be fetched by other checkouts.

The recovered local validation covers all twenty models and thumbnails, twenty Newest Additions links, sixty museum-label layouts, three interactive samples, a successful 3,410-page production build, and preservation of all 1,277 prior records and settings. A fresh semantic and asset-integrity check passed during this continuation. Direct post-deployment page/model/thumbnail requests could not be completed: this environment received HTTP 403 from the site, and the remote browser reported `ERR_BLOCKED_BY_CLIENT`. Therefore this entry confirms successful GitHub Pages deployment, not a fresh live visual or asset-hash audit. A user-device spot check at `/newest/` remains useful when accessible; no additional publication action is pending for this batch. The three untracked local QA scripts from the interrupted session remain preserved. No state is inferred for either computer’s checkout.


## 2026-09-19 — The Body Under Pressure: Michelangelo & Rodin

- Task/owner: this ChatGPT Work session, on `codex/rodin-michelangelo-exhibition-20260919`, continuing the user’s request to curate and publish an exhibition comparing specific works by the two sculptors. Base: `431d8345818930be00e64bb4f58db4d5e74bf3e7`.
- Completed: six paired encounters / twelve existing sculptures at `/exhibitions/michelangelo-and-rodin/`, original comparative texts, looking prompts, object notes and institutional source links. The pairings are David / The Age of Bronze; Lorenzo / The Thinker; Rebellious Slave / Adam; Crouching Boy / Crouching Woman; Pietà / The Kiss; Bearded Captive / The Walking Man. Documented influence is distinguished from curatorial visual comparison. Plaster-cast provenance and independent display scale are explained.
- Presentation: an optional paired exhibition format keeps both sculptures visible together, with longer notes stacking on narrow screens. It integrates into the exhibition directory, next-exhibition navigation and all twelve object records. Existing exhibitions retain their linear presentation. All previous exhibition data, catalog records, asset URLs, rendering overrides and Newest Additions are preserved.
- Validation: successful 3,411-page production build; six side-by-side layouts at 1440, 390 and 320 pixels; control and source-disclosure interaction checks; four interactive sample models; no application errors or tested asset failures. Desktop and phone screenshots were inspected. Static checks confirmed twelve selected public records, twelve thumbnails, twelve object backlinks, unique anchors and unchanged prior exhibition content. `git diff --check` passed.
- Verification limit: the live site and model CDN still reject this environment’s requests. Browser tests therefore use local repository fixtures. David matches its recorded hash; the current local Bearded Captive is used directly; The Walking Man matches its unchanged migration manifest. The Age of Bronze fixture uses its pre-CDN uncompressed geometry. These tests verify the paired interface, not current remote asset byte identity. Details and reproducible test instructions are in `docs/exhibitions/michelangelo-and-rodin-20260919.md`.
- Delivery: prepared for authorized publication. Next step: publish the exact tested tree and confirm the GitHub Pages deployment. A direct live visual check remains unavailable from this environment. Other computer checkouts and the three pre-existing untracked QA scripts remain outside this task.


### Deployment confirmation — Michelangelo and Rodin

Publication commit `45cc8b4689f80062e15b254f09fc9a35c6ccc8e8` was deployed successfully by [GitHub Pages run 35457432179](https://github.com/never-nude/atrium.earth/actions/runs/35457432179). The published Git tree (`604a74873e6de8db8f81971885cdcfff7ac7caad`) matches the tested local tree. [The Body Under Pressure: Michelangelo & Rodin](https://atrium.earth/exhibitions/michelangelo-and-rodin/) contains all six comparisons and twelve existing works, with links from the exhibition directory and each participating object page.

This confirms successful deployment and the local validation described above; direct live visual and CDN checks remain blocked from this environment. The local publication checkout is on `codex/rodin-michelangelo-published-20260919`, tracking `origin/main`, with the three earlier untracked QA scripts preserved. No further publication action remains for this exhibition. This confirmation changes documentation only; no state is inferred for other computers.

## 2026-09-19 — Undine identity review and major-museum acquisitions

- Local Codex task branch: `codex/world-museums-50-20260919`, based on `bb1a3fd4fff465b5e1078c195e15b7ca323c7637`; all concurrent imports and the Michelangelo/Rodin exhibition were preserved.
- User requested fifty new pieces from underrepresented major museums, prioritizing monumental sculpture and a meaningful full-scale AR experience. Discovery continues separately from this corrective change.
- Immediate correction: temporarily unpublish `modern/undine-sb3d` after the user questioned the subject’s age. The uploader provides only a title and “statue nude,” without verified artist, date, object identity or age. Minority is not established; adulthood is likewise unverified, so its inclusion in the earlier adult-intimacy selection was unsupported. Removed its Bodies in Motion placement and preserved the record, assets, and review evidence for further identification. The separately identified Ives work is unchanged.
- Validation: addition-group and wing tests pass; production build passes; built Newest Additions and Bodies in Motion have no link to the held work, and its canonical page is not generated. Live deployment remains to be verified after this corrective commit.

Undine hold deployment verified: commit `d65e74219b4c9e8e1a9f3da7eeeebff1923cecea`, successful Pages run `35458709703`; live Newest Additions and Bodies in Motion omit the held work, and its canonical URL returns 404. Museum acquisition discovery continues toward fifty.


## 2026-09-19 — Fifty major-museum acquisitions

- Local Codex task on `codex/world-museums-50-20260919`, based on `d65e74219b4c9e8e1a9f3da7eeeebff1923cecea`. Preserves all 1,297 prior catalog records and their settings, including concurrent imports and the Undine hold.
- Adds exactly fifty distinct, acquired and openly licensed 3D works from underrepresented collections, including the British Museum, Musée d’Orsay, V&A, Uffizi, Rijksmuseum, Ashmolean, National Museum of Scotland, Art Institute of Chicago, SFMOMA, Philadelphia, Ny Carlsberg and Middelheim. The catalog now contains 1,347 records and 1,334 public works.
- Monumental highlights include the 5.78 m Amitābha, 4.15 m Pisa pulpit cast, Orsay’s Rhinoceros and Horse, the Halikarnassos dynastic figures, Hoa Hakananaiʻa and Tršar’s 3.06 m-wide Demonstrators. No di Suvero or Storm King acquisition is implied. Casts, historical losses, unscanned surfaces, supports and approximate boundaries are disclosed.
- All fifty models passed source-integrity, self-contained GLB and four-angle visual review; fifty final thumbnails were rendered and inspected. Eleven model-specific size references retain source and geometry evidence: two verified, nine approximate. Across the batch, twenty-nine works have approximate starting dimensions and nineteen have explicitly unknown size. All previous dimension and eligibility records are preserved.
- Newest Additions is neutral and contains only this fifty-work batch. Origin-based wings are applied; four clear placements were added to Power and Presence, Sacred Forms, What Survives, and The Work of the Surface.
- Validation: batch integrity, source preservation, size-binding checks, additions, wings, catalog assets, whitespace checks and a 3,572-page production build pass. Existing global dimension/spatial test failures were reproduced before this import (missing older review/eligibility entries); the isolated fifty-work validation passes without changing that backlog.
- Publication is authorized. Assets are uploaded as Git objects; the branch has not yet been advanced to this acquisition tree. Next: publish the exact tested tree, confirm Pages success, then verify all fifty live work pages and all one hundred asset hashes.


### Production confirmation — fifty major-museum works

Acquisition commit `db91718c56b24244241b6c49d8ecbeedd41e23b9` is deployment-verified. [GitHub Pages run 35461023499](https://github.com/never-nude/atrium.earth/actions/runs/35461023499) succeeded. The published tree `827c6cd338391f150e0ef3f5ce9da8e14f60da35` matches the tested local tree. Live checks found exactly the selected fifty works at `/newest/`, fetched all fifty work pages, matched SHA-256 for all fifty models and fifty thumbnails, and confirmed all four exhibition placements. Six representative models also passed local interactive-browser checks with correct verified/approximate size labels; desktop and mobile views were inspected. The requested completion email was sent after live verification. No acquisition or publication action remains for this fifty-work batch. The previous dimension-review backlog and unselected reserves are unchanged.


## 2026-09-19 — Fifty works by other sculptors and makers

- Local branch `codex/makers-50-20260919`, based on `88c06651a57132ca0779aea3bfa1fa9b8ce7e89a`. User authorized acquisition and live publication of fifty works by other well-known makers, across periods, with monumental sculpture and AR in mind.
- Adds exactly fifty distinct 3D works by twenty-six artists, including six Henry Moore compositions, Alexander Calder’s monumental Peau Rouge Indiana, Andy Goldsworthy’s Sapsucker Cairn, Niki de Saint Phalle, Marisol, Takamura Kōun, Botero, Canova, Carpeaux and others. No Rodin or Michelangelo additions. Giacometti and Richard Serra remain held because no suitable downloadable permissively licensed models were acquired.
- The selections span historical, modern and contemporary sculpture. Six digital reconstructions are explicitly identified (Calder’s Spider, Kusama’s Toko-chan and four Kobro compositions); casts, scan limitations and surface alterations are disclosed. All prior 1,347 records and their settings are preserved: 1,397 catalog records, 1,384 public works.
- All fifty assets passed source-integrity, license, self-contained GLB and four-angle visual review. Fifty final thumbnails were rendered and inspected. Bourdelle’s horse was reduced from 28.66 MB to 3.99 MB with a four-angle quality comparison. The optimized batch totals 47.57 MiB.
- Physical size remains explicitly approximate for thirty works and unknown for twenty; no new work claims verified dimensions. Four additional model-specific scale references are bound to the exact model and orientation, including Calder’s approximately 12.2 m height. Original plaster, support extents and unresolved measurements are disclosed; unknown-size models retain an explicit 1 m default.
- Origin-based wings are applied. Newest Additions remains neutral and shows only this fifty-work batch. Five clear placements join The Work of the Surface, Bodies in Motion, Power and Presence, and What Survives.
- Batch integrity, prior-record preservation, size binding, additions, wings, asset checks and whitespace validation pass. Final production build and deployment verification are recorded below when completed. The previously documented global dimension-review backlog is unchanged.
- Publication is authorized. Next: publish the exact tested tree, confirm Pages success, verify all fifty live work pages and all one hundred asset hashes, then send the requested completion email.

### Production confirmation — fifty other sculptors and makers

Acquisition commit `9f91c7bc7a0f63d2f174562d52e73908533cc98c` is deployment-verified. [GitHub Pages run 35472615365](https://github.com/never-nude/atrium.earth/actions/runs/35472615365) succeeded. The published tree `f6201eaf32c868e76592dc7643602db4886c728c` matches the tested local tree. The final production build completed 3,705 pages. Live verification found exactly the selected fifty works at `/newest/`, fetched every work page, matched SHA-256 for all fifty models and fifty thumbnails, and confirmed all five exhibition placements. Interactive checks confirmed Calder’s approximate AR height and Goldsworthy’s unknown-size label; the final neutral newest page was inspected live. The requested completion email was sent after verification. No acquisition or publication action remains for this fifty-work batch. Giacometti and Serra remain researched holds, not acquired works. The prior dimension-review backlog is unchanged.


## 2026-09-27 — Broad collection expansion

- This local Codex task owns branch `codex/collection-expansion-20260927`, based on `40e998c8b9fa2af22d5a0538f50fd71488c60562`. The user requested as many qualifying works as practical in one batch, with standing authorization to publish and send a completion email. During acquisition the user additionally requested Cattelan’s taped banana and gunfire work.
- Adds 135 distinct 3D works: 39 modern/contemporary acquisitions, 45 global museum objects, 49 historical works, Meissonnier’s Cleveland tureen, and an independent digital reconstruction after Cattelan’s Comedian. Artists include Barry Flanagan, Xavier Veilhan, Jeff Koons, Jean-Michel Folon, Agustín Cárdenas, Bruno Catalano, Nicolas Coustou, Alonso Berruguete and Pedro de Mena. No Rodin or Michelangelo additions. All six wings gain works; dates span the sixth millennium BCE through contemporary sculpture.
- Comedian is explicitly described as a third-party digital reconstruction, not an authorized edition or museum scan. Its banana and tape are mounted on a simple modeled backing; the 0.6 m starting display extent is a chosen adjustable size, not an authentic installation measurement. Cattelan’s Sunday (2024) was identified from Gagosian’s primary page, but focused live searches found no qualifying downloadable 3D model, so it remains a documented hold.
- All 1,397 baseline catalog records and their settings remain unchanged. The resulting catalog contains 1,532 records and 1,519 public works. Newest Additions remains neutral and includes only this 135-work batch. Nine source-supported exhibition placements join Sacred Forms, Bodies in Motion, Power and Presence, The Work of the Surface, and What Survives.
- Accepted source files passed exact archive-hash verification, permissive license review, self-contained GLB checks and actual four-angle visual inspection. Real final thumbnails were rendered and inspected. Duplicates, noncommercial licenses, incomplete scans and unclear identities were held. Recent live Sketchfab requests sometimes returned HTTP 429; those records accurately rely on the licensed immutable archive and do not claim a successful live license check.
- A final material audit caught three deprecated specular/glossiness assets. The Colima Dog, Récamier portrait and Our Lady of Sorrows were converted from their unchanged source files to supported materials, restoring their archived surface textures; four new views were checked. The Seated Apostle’s opening view was corrected. Source textures and vertex colors are retained; genuinely untextured models and museum digital reconstruction/fill work are disclosed.
- Physical-size access is approximate for 78 works and uses a clearly labeled chosen display size for 57; none claims newly verified physical scale. Veilhan’s complete lion is bound to its exact model/orientation with an approximate 6 m sculpture height above the retained thin ground slab. Published dimensions, model-version uncertainty, supports, casts and variable dimensions remain explicit. A few geometry-heavy assets remain above 10 MB to preserve reviewed detail; the 245 MB helmet source was reduced to 14.2 MB.
- Batch integrity, prior-record preservation, approximate size binding, additions, wings, asset completeness and whitespace checks pass. The existing global dimension-review and unknown-origin backlogs are unchanged. Production build and live confirmation are recorded below once completed.
- Next: publish the exact tested tree against freshly fetched main, confirm Pages success, verify all 135 work pages and 270 asset hashes, and send the requested completion email. No deployment success is claimed in this preparation entry.

### Production confirmation — 135 new works

Acquisition commit `6f56f0311a4ea6bc2f58f8a6120c58af0da03790` is deployment-verified. [GitHub Pages run 36371356281](https://github.com/never-nude/atrium.earth/actions/runs/36371356281) succeeded. The published tree `fb63b28985006f99db6cc68a3a27c4c6974ee371` matches the exact tested local tree. The final production build completed 4,104 pages. Live verification found exactly the selected 135 works at `/newest/`, fetched every new work page, matched SHA-256 for all 135 models and 135 thumbnails, and confirmed all nine exhibition placements. Browser checks confirmed the neutral newest page, Comedian’s correctly oriented interactive model and chosen 60 cm display label, and the lion’s approximate 6 m label. The requested completion email was sent after verification. Cattelan’s Sunday remains a researched hold because no qualifying 3D model was found. No acquisition or publication action remains for this batch; prior dimension and unknown-origin backlogs are unchanged.


## 2026-09-28 — Spatial modern sculpture acquisitions

- This local Codex session owns branch `codex/spatial-sculpture-20260928`, based on `5b581a7d957b4c5acc3f91bf9153088a5905dc32`. The user requested further acquisitions prioritizing Richard Serra, Frank Stella, Isamu Noguchi, then James Turrell as the highest priority. Standing authorization includes publication and a completion email.
- The reviewed batch contains 6 distinct 3D works by Carlos Cruz-Diez, Do Ho Suh, Isamu Noguchi, James Turrell, Jean (Hans) Arp. Download, license, identity and geometry limits for unavailable or rejected candidates are recorded in the ingest report; candidate discoveries are not counted as acquisitions.
- All accepted assets passed source integrity, permissive licensing, composition duplicate checks and actual four-angle visual review. Final thumbnails were rendered with the production renderer and inspected. Reconstructions, scan limitations and any background trimming are disclosed in the object records.
- All 1532 baseline catalog records and their settings remain preserved. Newest Additions stays neutral and shows only this batch; works are filed through origin-based wing rules. AR size access comprises 3 approximate references and 3 clearly labeled chosen display sizes. No unverified scale is presented as exact.
- Batch integrity, additions, wings, assets, material compatibility and whitespace checks pass. Production build passed: 4,122 pages in 13.95 seconds. Live verification is recorded below after completion. Existing dimension-review and unknown-origin backlogs remain unchanged.
- Next: publish the exact validated tree against freshly fetched main, confirm Pages success, verify every new page and model/thumbnail hash, then send the completion email. No deployment success is claimed in this preparation entry.

### Production confirmation — 2026-09-28

- Published six reviewed works in commit `3fd683f7bdc7310e9853691a9909909553c6e418`; GitHub Pages run [36392843046](https://github.com/never-nude/atrium.earth/actions/runs/36392843046) completed successfully. Catalog: 1,538 total / 1,525 public.
- Production verification passed for all six object pages, all twelve model and thumbnail SHA-256 checks, exact six-work Newest Additions membership, and both placements in The Work of the Surface.
- Live browser review confirmed the neutral six-work Newest Additions page, rendered Turrell crater model, and truthful unknown-size AR/VR disclosure. Physical AR hardware was not tested.
- Completion email sent to the user through their connected Gmail account, message `1a0e6f9fcc0445b7`.
- Serra and Greg Bailey searches produced no eligible downloadable 3D models; Stella’s Indian Birds scan failed original/optimized geometry review. These are preserved as holds, not acquired works.
- Batch evidence and source archives remain in `work/acquisition-spatial-20260928` outside the public deployment. This acquisition is complete; no further publication is pending.

## 2026-09-28 — Withdraw the Turrell crater model

- This local Codex session owns branch `codex/remove-turrell-20260928`. The user requested removing James Turrell’s Irish Sky Garden crater-interior model because it is awkward.
- Marked this work hidden using the existing public-catalog filter, removed its newest highlight and cleared its public dimension/AR eligibility entries. The other five additions remain published. Source metadata and assets are preserved for provenance; the public object route and all collection listings will exclude the withdrawn work.
- Additions checks and the production build passed. Generated Newest Additions contains exactly the five remaining works; Turrell’s canonical and legacy pages are absent, with no references in generated HTML, sitemaps or redirects. All other catalog records are unchanged. Next: publish the tested tree and confirm these removals live.
- The broader spatial-eligibility test fails on a pre-existing 211-record coverage gap (1,314 decisions / 1,525 public works before; 1,313 / 1,524 after). The gap is unchanged, and a focused comparison confirms only Turrell was removed from both public dimension maps.

### Turrell withdrawal — live confirmation

- Commit `89d537b7012be63791f1e298f73b6f7ecce07be1` is deployment-verified; [Pages run 36395692745](https://github.com/never-nude/atrium.earth/actions/runs/36395692745) succeeded.
- The old Turrell object page now returns HTTP 404. Newest Additions shows exactly the five remaining works, all five pages return HTTP 200, and collection, AR/VR and sitemap checks contain no Turrell reference. Public collection: 1,524 works.
- Withdrawal is complete; no publishing action remains. Source history and assets are retained. The existing dimension-review backlog is unchanged.

## 2026-09-28 — Rolling 24 newest works and two withdrawals

- This local Codex session owns branch `codex/newest-24-20260928`, based on `1abaad98f6c568f46d8e3779202201b6e61a5dcc`. The user requested removing Do Ho Suh’s Fallen Star and Carlos Cruz-Diez’s Indução do Amarelo digital reconstructions and showing the 24 most recent works across imports.
- Both records are hidden through the existing public catalog filter; their public dimension/AR eligibility entries are removed. Cruz-Diez’s placement and caption in The Work of the Surface are removed. Source records and assets remain preserved; all other catalog records are unchanged.
- Newest Additions will show a rolling set of 24 public works ordered by each work’s import time, independent of batch grouping. The homepage will use the same list for its four newest cards; historical batch links continue to redirect to the neutral newest page.
- Focused newest tests passed for cross-batch imports, continuations, timestamp/date fallbacks, deterministic ties, hidden works, duplicates and the 24-item cap. The production build passed; independent output checks confirm the exact 24 works across two imports, matching homepage first four, both withdrawn pages absent and no references in generated HTML, collection, AR, sitemap or the affected exhibition. All other catalog records and dimension entries are preserved. Next: publish and verify live. Existing dimension-review coverage backlog remains outside this change.
