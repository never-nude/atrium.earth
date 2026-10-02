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

### Rolling 24 newest works — live confirmation

- Commit `c84b049483c3bbd867929169fd7ef1eeed3e1a70` is deployment-verified; [Pages run 36399134435](https://github.com/never-nude/atrium.earth/actions/runs/36399134435) succeeded. The production build generated 4,113 pages.
- Live Newest Additions contains exactly the expected 24 newest public works in order across two imports. The homepage shows the same first four. All 24 work pages return HTTP 200.
- Do Ho Suh’s Fallen Star and Carlos Cruz-Diez’s Indução do Amarelo object routes return HTTP 404. Both are absent from live collection, AR/VR and sitemap pages; Cruz-Diez is also absent from The Work of the Surface. Public collection: 1,522 works.
- Implementation, publication and live verification are complete. No publishing action remains.


## 2026-09-28 — Adult intimacy acquisitions

- This local Codex session owns branch `codex/adult-intimacy-20260928`, based on `f45f32a`. The user asked for more daring depictions of adult intimacy, retaining 3D-only acquisitions and standing publication/completion-email authorization.
- The accepted batch contains three new licensed scans: Ismael Smith’s El petó (The Kiss), and Tauno Kangro’s A Moment Before the Kiss and A Moment After the Kiss. Official museum interpretation supports Smith’s unsettling, unequal embrace; the Kangro identities were matched to the artist’s named photographs. Adult subjects, exact source IDs, permissions, metadata and composition duplicates were reviewed.
- Actual source bytes and optimized assets are archived with hashes. All three models passed four-angle visual review, material checks and inspected production thumbnails. Extraneous ground around the Kangro plinths was conservatively trimmed; narrow remaining capture fringes are disclosed. Original photographic color is retained. AR uses approximate artist-published heights of 2.1 m and 1.75 m for Kangro and a clearly labeled adjustable display size for Smith; no unverified size is claimed as exact.
- All 1,538 baseline catalog records are preserved, including earlier withdrawals. Newest Additions remains the rolling 24 most recent public works across batches; ingest documentation now describes that behavior. Smith joins The Work of the Surface. Brâncuși, Claudel and Gargallo are recorded as license/download holds rather than acquired works.
- Batch integrity and preservation, additions, wings, asset completeness, material compatibility, built-page order, exhibition placement and whitespace checks passed. Production build passed: 4,123 pages. Catalog: 1,541 total / 1,525 public. Existing dimension-review and unknown-origin backlogs remain unchanged.
- Next: publish this exact validated tree against freshly fetched main, confirm Pages success, verify all three new pages and six asset hashes plus the rolling newest list, then send the completion email. No deployment success is claimed in this preparation entry.

### Adult intimacy acquisitions — live confirmation

- Acquisition commit `6c204cfb51d32d41858ecda69ebd46c5d58da8ce` is deployment-verified; [GitHub Pages run 36432904260](https://github.com/never-nude/atrium.earth/actions/runs/36432904260) succeeded. The published tree `4ff8221490a499fe253dcb126bf853082f5dbdd5` exactly matches the tested local tree.
- Live verification passed for all three new work pages, all six model/thumbnail SHA-256 checks, the exact ordered rolling 24-work newest list, and Smith’s placement in The Work of the Surface. Catalog: 1,541 records / 1,525 public works. Actual AR hardware was not tested; size labels remain approximate or unknown as documented.
- The requested completion email was sent after successful verification. The three-work acquisition and publication are complete; no publishing action remains. Other research leads remain documented holds, and the existing dimension-review/unknown-origin backlogs are unchanged.


## 2026-09-28 — Further intimacy and surrealist sculpture research

- This local Codex session owns branch `codex/intimacy-expansion-20260928`, based on `e71d20d`. The user requested a further group of provocative fine-art 3D works, following the adult-intimacy acquisitions. Standing publication and completion-email authorization remains applicable.
- Source discovery, creator identity, licensing, composition duplicates and geometry review are underway in a separate local acquisition folder. No candidate is counted as acquired before its source asset and visual review pass.
- Preserve the 1,541 baseline catalog records, all existing withdrawals, origin-based wings and rolling 24 public newest works. Next: finish source review, prepare qualifying records/assets, test and publish the exact reviewed batch.

### Reviewed acquisition batch

- Four new works are accepted: Jef Lambeaux’s Le Faune mordu and Adam and Eve Expelled from Paradise, Jane Aypel’s Le Couple, and Maria Martins’s Orpheus. Adult figure context, artist/work identity, permissive licensing and composition duplicates were reviewed. The Adam/Eve title corrects the uploader’s L’étreinte identification using a photographed heritage survey; Martins’s modeled cast remains explicitly unverified.
- Source GLBs are retained locally with independent SHA-256 checks. All four derivatives passed source-versus-final four-angle review and inspected 900×1125 production thumbnails. The Aypel ground apron is conservatively cropped with a narrow fringe retained. Three vertex-colored scans use neutral white textures to preserve authored colors through the existing material path; source colors and material factors are retained. All four AR sizes remain clearly adjustable and unverified.
- Batch integrity/preservation, material compatibility, additions, wings, asset completeness, built pages and whitespace checks passed. Production build: 4,135 pages. The 1,541 baseline records and all 16 withdrawals are preserved; catalog is now 1,545 total / 1,529 public. Newest remains exactly the ordered latest 24 public works. Le Faune mordu joins Bodies in Motion with a caption explaining resistance and balance.
- Sarah Lucas’s NUD25 is an account-download hold; other restricted, duplicate, unidentified or incomplete models remain documented research leads, not acquisitions. Existing dimension-review and unknown-origin backlogs are unchanged.
- Next: publish the exact validated tree against freshly fetched main, verify Pages and all eight model/thumbnail hashes plus the four pages and newest order, then send the authorized completion email. No deployment success is claimed in this preparation entry.

### Further intimacy and surrealist acquisitions — live confirmation

- Acquisition commit `f49a9afb6f5f92efdc0773bffc58edcd3a288163` is deployment-verified; [GitHub Pages run 36436594818](https://github.com/never-nude/atrium.earth/actions/runs/36436594818) succeeded. The published tree `d4c3bcc1ffc7a7569f0b80fb5966a0c967bc73ad` matches the tested local tree.
- Live verification passed for all four new pages, all eight model/thumbnail SHA-256 checks, the exact ordered rolling 24-work newest list, and the Le Faune mordu placement in Bodies in Motion. Catalog: 1,545 records / 1,529 public works. No physical AR hardware test is claimed.
- The authorized completion email was sent after verification. This four-work acquisition is complete; no publishing action remains. Source evidence and held candidates remain in the local acquisition archive. Sarah Lucas remains an account-access hold; existing catalog backlogs are unchanged.

## 2026-09-28 — Dragon’s Mouth, direct artist submission

- This session owns `codex/dragons-mouth-20260928`, based on `315b3cb`. At the user’s request, African acquisitions are paused; the regional source packages and unfinished visual reviews remain preserved locally, with no African imports published in this change.
- The user supplied Dragon’s Mouth as a USDZ, confirmed the credit **Michael Conor Kushman**, and identified the materials as aluminum, acrylic, and spray paint. Publication is authorized directly by the artist, with all rights retained; no Creative Commons grant is inferred. The creation date and country remain unspecified, so the work is searchable and public without an invented regional assignment.
- The original USDZ is retained locally. The web conversion preserves all 19,918 triangles, surface color, normal map and ambient-occlusion map. The converter’s geometry/UV data and decoded texture pixels were independently compared with the USD source. Source-versus-optimized four-angle review and the final 900×1125 thumbnail passed. No geometry was simplified or added.
- Dimensions are explicitly approximate and metric: **25.4 × 19.7 × 21.1 cm (H × W × D)**. Height comes from the artist’s estimate; width and depth come from model proportions. AR starts at an approximate 0.254 m height and does not claim verified measurement. The work also joins The Work of the Surface.
- Batch preservation, source/material integrity, metric labels, additions, wings, asset completeness, exact rolling-24 built order and whitespace checks passed. Production build passed: 4,139 pages. All 1,545 previous records and 16 withdrawals are preserved; catalog now has 1,546 total / 1,530 public works.
- Next: publish the exact validated tree, confirm Pages success and the new page plus model/thumbnail hashes and newest order, then send the authorized completion email. No live deployment success is claimed in this preparation entry.

## 2026-09-28 — Tetra and Songbird, direct artist submissions; Dragon’s Mouth corrections

- This Claude Code cloud session owns branch `claude/atrium-african-expansion-6xlkhd`, based on production `4e09261`. The user supplied **Tetra** and **Songbird** (file `Oscen.usdz`, retitled by the artist) as RealityKit Object Capture USDZ files, credited to **Michael Conor Kushman**: aluminum, acrylic, and spray paint; 2023; American. Publication is authorized directly by the artist with all rights retained; no Creative Commons grant is inferred.
- The artist also corrected Dragon’s Mouth: year **2023** and American origin. Its record now has `year_sort: 2023`, United States geography, and the Americas wing instead of Unfiled. Its URL, model, thumbnail, dimensions and import identity are unchanged. The artist confirmed all three works are American.
- Conversion: `scripts/convert-object-capture-usdz.py` (Pixar USD) copies every triangle, point, vertex normal and UV into a self-contained GLB. It flips V only for glTF’s texture origin, embeds the original PNGs byte-for-byte, and applies one uniform scale to the artist’s height. The previews use meshopt and 2048-pixel WebP with no simplification: Tetra keeps 16,300 triangles (426 KB), Songbird 18,686 (442 KB). Source/optimized six-view review and final 900×1125 thumbnails from the production renderer passed. No floor, mount or geometry was removed or added. Internal capture paths and capture-identifier labels are not carried into the web files.
- Metric dimensions are approximate. Height comes from the artist (7.3 in and 5.8 in). Width and depth are bounding-box extents relative to each opening view. Tetra: **18.5 × 22.6 × 26.2 cm**. Songbird: **14.7 × 15.5 × 20.9 cm** (H × W × D). AR starts at the approximate height and does not claim a verified measurement.
- No exhibition placements: Dragon’s Mouth already represents this artist in The Work of the Surface. Batch `new-additions-20260928-e`; provenance and hashes are in `docs/ingest/new-additions-20260928-e.json`. Catalog: 1,548 total / 1,532 public; all prior records, settings and 16 withdrawals are preserved. Rolling Newest begins Songbird, Tetra, Dragon’s Mouth.
- Validation: additions, wings (1,512 filed / 20 unfiled), asset verification, model normalization, spatial, display support, museum labels (4,596 layouts; local Chromium), whitespace, and a production build of 4,144 pages all pass. The dimension-review, spatial-eligibility (211-work gap) and spatial-access failures are identical on unmodified `4e09261`.
- Source files: the original USDZs are the artist’s files (SHA-256 `0d2eda2c…4515c4cf` Tetra, `9f1d9e79…e888830da` Songbird). The lossless intermediate GLBs existed only in the ephemeral cloud container and can be regenerated exactly with the converter. Hashes are in the ingest report.
- African expansion: not resumed in this session. The handoff’s acquisition folders and the staged, unpushed Dragon’s Mouth STATUS confirmation are on the owner’s Mac; this cloud container cannot reach them. Its network policy also blocks Sketchfab, museum APIs and atrium.earth. When that Mac checkout next fetches, it must preserve its staged STATUS change while integrating this entry. Both touch the end of this file.
- Pre-merge fix: the independent site check found that the word “silvery” in Tetra’s description made the site infer Silver, using the tarnished-silver appearance and filter. The description was reworded and Tetra’s thumbnail re-rendered; all three works now use the neutral profile and none is tagged Silver. Rebuilt: 4,144 pages.
- Delivery: the owner authorized merging and live deployment after independent verification (conversion fidelity, data integrity and built-site behaviour). This is published through [PR #73](https://github.com/never-nude/atrium.earth/pull/73) to `main`; the deployment and Pages run are recorded below after they are confirmed. This preparation entry does not claim deployment.
- Next: after deployment, confirm the Pages run and published blob hashes. Resume African acquisitions from the Mac checkout that holds the preserved sources, integrating this entry first.

### Tetra, Songbird and Dragon’s Mouth correction — deployment confirmation

- [PR #73](https://github.com/never-nude/atrium.earth/pull/73) was squash-merged to `main` as `2a48a74118d0966378a9924f9eb07356fb0256d6`. Its tree `48a8916a9fc8c6b309ee39cec3ddc3f83b869eba` is identical to the tested tree. [GitHub Pages run 36449336362](https://github.com/never-nude/atrium.earth/actions/runs/36449336362) succeeded: build and deploy both passed, and the Pages artifact digest is `sha256:29fc30a3…d2d8c0`.
- Direct live verification was not possible from this cloud session. Its network policy denies atrium.earth, the web fetcher and the Actions artifact blob storage. This entry confirms a successful Pages deployment of the exact tested tree, not a fresh live page/hash audit. The expected live SHA-256 values are in `docs/ingest/new-additions-20260928-e.json` (Tetra preview `e7eb552f…`, thumb `a62a596a…`; Songbird preview `0e2ea3af…`, thumb `3ee6b645…`). The next session with site access should fetch the three work pages, both new models and thumbnails, and `/newest/` (expected order: Songbird, Tetra, Dragon’s Mouth).
- The batch is on `main` and fetchable by both computers. The Mac checkout still holds its own staged Dragon’s Mouth confirmation and the paused African acquisition folders; integrate this entry there before resuming. The next ingest batch ID should be `new-additions-20260928-f` or later. The African baseline must be recomputed from the current 1,548-record catalog.


## 2026-10-02 — African art acquisition (33 works)

- Task/owner: Claude Code session on this Mac, worktree `.tmp/african-art-20261002`, branch `claude/african-art-20261002`, at the user's request to "add some African art to atrium, fetch and deploy as many as possible". Base: `eb391b4` (origin/main). The other computer's state has not been inspected.
- Discovery: Sketchfab search plus full enumeration of museum/library/university accounts, filtered to downloadable CC0 / CC BY / CC BY-SA models with an African provenance signal (5,600 CC-licensed models screened; 259 finalists from accepted institutional publishers after Cleveland and Mia department checks through their APIs). Ancient Egyptian antiquities, non-African objects and undocumented private uploads were excluded and are listed in `docs/ingest/african-art-20261002.json`.
- Acquisition: the Sketchfab download API needs `SKETCHFAB_TOKEN` (not available), so sources came from licensed archive copies: Zenodo "3D Big Data Space" records (found by file-key lookup of the Sketchfab UID) and Objaverse 1.0. 47 finalists had archive copies; after review 35 were fetched, 33 published (one Małopolska manilla record duplicated the other's accession; one University of Iowa beaded-skirt scan was dropped as a shapeless untextured mesh).
- Completed: 33 catalog records (13 Olkusz African Museum / Virtual Museums of Małopolska, 4 AARLCC, 3 Världskulturmuseerna, 3 Yale Peabody, 2 Arms Museum, 2 Hunt Museum, Williams College, Glasgow Museums, British Library, University of Queensland Anthropology Museum, Agnes Etherington Art Centre, and Jonathan Mhondorohuma's Bonsa Drummer under `modern/` with wing `africa`), optimized Draco previews uploaded to R2 under content-hashed names, rendered thumbnails and posters, orientation entries reviewed against the publishers' reference images (two rotations: Ere Ibeji stood upright, manilla board turned to its front), culture/geography/dimension reviews (13 documented, 20 unresolved), spatial-eligibility, display-default and appearance entries, batch `african-art-20261002` in `additions.json`, and `scripts/ingest-utils.mjs` now sends a User-Agent (Zenodo refuses downloads without one). Four scans carry vertex colours only (Hunt charm and ivory pot, UQ Ere Ibeji, Bonsa Drummer) and are shown in a neutral study material; their records say so.
- Validation performed: fetch sha256 records; auto-orientation/integrity pass with the componentized-mesh flag (all are photogrammetry scans); `verify:assets`; all 33 R2 URLs return 200 `model/gltf-binary`; production build (4,224 pages); `test:additions`, `test:wings`, `test:display-support`, `test:model-normalization` pass. Pre-existing baseline failures unchanged: `test:dimensions` still stops at the older LeWitt entry and `test:spatial-eligibility` still reports older works without decisions (the 33 new works have entries in both files).
- Not acquired: 175 institutional African scans exist only on Sketchfab (AARLCC 62, University at Buffalo Cravens Collection 22, Global Digital Heritage 19, Grinnell 10, Cleveland 8, Rietberg 7, Szczecin 7, MNHN Chile 6, Sainsbury Centre 6, and others). They are saved in candidate format at `docs/ingest/african-art-20261002-leads.json`; with `SKETCHFAB_TOKEN` set, `npm run ingest:fetch` / `ingest:assemble` can continue the batch. The Met's Ethiopian Double Diptych Icon Pendant (1997.81.1) is served through a VNTANA embed without a file URL.
- Delivery: committed on `claude/african-art-20261002` and pushed to `main` for the GitHub Pages workflow; live verification recorded below once the run completes.

### Production confirmation — African art batch

Acquisition commit `40ce531` is deployment-verified. [GitHub Pages run 36996006911](https://github.com/never-nude/atrium.earth/actions/runs/36996006911) completed successfully. Live checks on 2026-10-02: all 33 work pages return 200 with their titles, all 33 thumbnails and all 33 content-hashed R2 models return 200 (`model/gltf-binary`), `/newest/` lists the batch, and the Djimini-Senoufo mask page reached the live WebGL viewer from R2 in a real browser with no console errors. The worktree was clean at the acquisition commit; no state is inferred for the other computer. This confirmation changes documentation only. The 175 token-dependent leads in `docs/ingest/african-art-20261002-leads.json` remain the next acquisition step.

## 2026-10-02 — Undine published, outside Newest Additions

- `modern/undine-sb3d` returns to the public catalog at the editor’s direction. The hold flags are removed; the identity review file records the decision and keeps its age finding unchanged.
- The work is kept off the Newest Additions rail and the batch archive by a new catalog flag, `exclude_from_additions`, honored in `src/lib/addition-batches.mjs` and covered by `test:additions`. Its preserved dimension review is restored to `physical-dimensions.json`. The Bodies in Motion placement is not restored.

## 2026-10-02 — Cloudflare R2 uploads in CI; African leads acquisition run

- Task/owner: Claude Code cloud session on branch `claude/atrium-pieces-deploy-4nay07` (base `dba1fae`), at the user's request to fetch as many spectacular African pieces as possible and to wire in Cloudflare. This container cannot reach Sketchfab, museum hosts, Cloudflare or atrium.earth, so fetching runs on GitHub's runners.
- Added `scripts/upload-previews-r2.mjs` (`npm run models:upload-r2`) with a dependency-free SigV4 signer (`scripts/r2-sigv4.mjs`). It uploads previews to the `atrium-models` bucket as `models/previews/<slug>/preview-<sha256:12>.glb`, re-downloads the public copy from models.atrium.earth and compares SHA-256 before updating `previews.json`. It refuses to move a preview that dimension or spatial-eligibility records are bound to. `npm run test:r2-upload` checks four AWS reference signatures and runs a mock end-to-end upload.
- Added `.github/workflows/acquire-leads.yml`. It fetches a saved candidate file (default `docs/ingest/african-art-20261002-leads.json`, 175 Sketchfab leads), assembles optimized (Draco/WebP) previews, uploads them to R2, renders thumbnails and pushes to `claude/atrium-africa-review-<run>-<attempt>`. It never touches `main`. `ingest.yml` uploads too when all four R2 secrets exist. Its Chromium path lookup is fixed: since late August every scheduled run had failed at thumbnails.
- Fixed a data-loss bug: `generate-previews.py` rebuilt `previews.json` from local files only. On a fresh checkout that dropped all 1,091 R2 entries (reproduced: 1,581 → 490). It now updates only the previews it wrote. `assemble-piece.mjs` accepts `--optimize-source-glb`.
- Repository secrets set by the owner: `SKETCHFAB_TOKEN`, `R2_ACCOUNT_ID`, `R2_BUCKET` (`atrium-models`), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. No values are recorded here.
- Validation: `test:r2-upload` passes; `generate-previews.py` preserves all 1,581 records on this checkout; workflow YAML parses. An independent adversarial review confirmed the issues fixed above. The workflow run itself is not yet verified.
- Next: when the run finishes, curate its review branch. Keep only strong works, drop the rest from catalog/previews/renders, add orientation and dimension reviews and exhibition placements, then publish through a PR to `main`. Previews of works that are not kept stay in R2 as unreferenced objects.

### First acquisition run (37017612692) and continuation

- Run [37017612692](https://github.com/never-nude/atrium.earth/actions/runs/37017612692) fetched 29 of 175 leads. The other 146 returned Sketchfab HTTP 429 (rate limit; the fetcher sent requests back to back). All 29 previews were uploaded to R2 and verified against the public copy (`r2-upload.json`: 29 uploaded, 0 failed). The catalog went from 1,581 to 1,610 records, with no existing record changed except `total`; all 1,581 earlier `previews.json` entries were preserved. Rendering stopped after 10 thumbnails when one model (`ci-wara-headdress-gdh`) timed out under SwiftShader.
- These 29 records, 10 thumbnails, 29 posters and the run report (`docs/ingest/african-art-20261002-b-run-37017612692/`) are staged on this branch. They are not yet curated; nothing is published until PR #75 merges.
- Fixes for the continuation run:
  - `fetch-source.mjs` skips already-catalogued leads, spaces out Sketchfab API calls, honours `Retry-After` on 429, and caps total waiting per run.
  - `render-thumbnails.mjs` takes `RENDER_TIMEOUT_MS` and continues past a failed model.
  - New `models:mirror-r2` pulls R2 previews back down so missing batch thumbnails can be rendered.
  - The workflow renders every batch work without a thumbnail and commits only this batch's posters. The poster generator otherwise rewrote 1,317 unrelated posters.
  - Validation: the mock tests cover the 429 retry, the give-up path, the mirror round-trip and the hash mismatch; the workflow shell logic was simulated against run-1 data (19 to render, 10 present, 29 posters kept).
