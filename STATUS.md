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

### Continuation run (37019814481) and first curation pass

- Run [37019814481](https://github.com/never-nude/atrium.earth/actions/runs/37019814481) fetched 125 more leads and accepted 124. All 124 previews uploaded to R2 with no failures, and all 153 batch works rendered thumbnails. 20 leads were still rate-limited (the run's wait budget ran out); later runs retry them.
- Curation of all 153 thumbnails and source records withheld 24 works. Each is listed with its reason in `docs/ingest/african-art-20261002-b-rejected.json`:
  - non-African: a Papua New Guinea yam mask and neck rest, a Manolo Hugué terracotta, a sculpture-park hippo
  - scale bars or label boards baked into the scan: 7 Szczecin works
  - unidentified fragments or accession-only titles
  - vessels and souvenirs
  - duplicate scans
- Their R2 previews stay as unreferenced objects. The workflow now drops rejected leads before fetching.
- 129 works remain staged; the catalog has 1,710 records, and existing records are unchanged apart from `total`. 47 need an orientation decision (`docs/ingest/african-art-20261002-b-orientation-requests.txt`), mostly masks rendered from behind and works lying on their side. `render-orientation-variants.mjs` renders each one in 10 candidate orientations for review; it was tested locally with SwiftShader WebGL, which does work in the cloud sandbox.
- Still to do before publishing: apply orientations and re-render; clean up metadata (several `year` values are scan or acquisition years, some materials are wrong); add dimension, spatial, display and appearance entries; add the Newest Additions batch record; run the tests.

### First publication: 80 works live, 47 held for orientation

- At the owner's request, the 80 works whose orientation was already right are published first. The other 47 are in the catalog with `hidden: true`, listed in `docs/ingest/african-art-20261002-b-orientation-requests.txt`. Their dimension and spatial-eligibility records are parked in `docs/ingest/african-art-20261002-b-held.json`, because the dimension test rejects records for hidden works.
- Newest Additions now shows the whole latest batch when it exceeds 24 works (`buildNewestWorks`, covered by `test:additions`). All 127 works share one `ingested_at` (the batch's first import time). The catalog order leads with the Chokwe throne, the head of Oba Osemwende, the Baga serpent headdress and the Songye nkishi.
- `docs/ingest/african-art-20261002-b.json` records provenance for all 127: source and preview SHA-256 hashes, R2 URLs, licences, dimension status and publication state. It also lists the 26 withheld works and the 21 leads still rate-limited.
- Validation on this tree:
  - `test:additions`, `test:wings` (1,625 filed / 21 documented unknown origins), `verify:assets`, `test:display-support`, `test:model-normalization`, `test:r2-upload` and `test:museum-labels` all pass.
  - The production build passes; all 80 work pages are built and the held pages are not.
  - `test:dimensions` and `test:spatial-eligibility` stop at the same first assertions as on `main` (`americas/lewitt-cubic-modular-wall-structure`; "Every public work has an explicit decision"). Their rules were checked directly against the 80 new works, which pass.
- Local rendering works in the cloud sandbox but is slow (~1 minute per render with SwiftShader). Review renders run on GitHub runners instead, through the temporary workflows kept off `main`: `mirror-previews.yml`, `orientation-sheets.yml` and `rerender-thumbnails.yml`.
- Next:
  1. Choose orientations from the review sheets.
  2. Re-render the 47 thumbnails and regenerate their posters (posters embed the thumbnail).
  3. Restore their parked records, un-hide them, and publish them in a follow-up PR.

### Production confirmation — 80 African works

- [PR #75](https://github.com/never-nude/atrium.earth/pull/75) was squash-merged to `main` as `c6fce00723070051d2ed3cd888c0836108af44bf`. [GitHub Pages run 37032690840](https://github.com/never-nude/atrium.earth/actions/runs/37032690840) succeeded; build and deploy both passed.
- Live verification ran from a GitHub runner, [run 37033095140](https://github.com/never-nude/atrium.earth/actions/runs/37033095140), at 2026-10-02T16:19:53Z; the report is on branch `claude/atrium-live-verify-african-art-20261002-b`. All 80 work pages returned 200 with their titles and all 80 thumbnails returned 200. All 80 R2 models returned 200 `model/gltf-binary` with SHA-256 matching their content-hashed filenames. `/newest/` lists exactly the 80 works in the intended order, starting with the Chokwe throne, and the 47 held works are not public (404).
- The owner reviewed the live works and approved them.
- Next: publish the 47 held works once their orientation is fixed (follow-up PR from this branch, restarted at `c6fce00`).

### Runbook: publish the 20 held African works (next session)

State at hand-off: 80 works from batch `african-art-20261002-b` are live. 20 more are in the catalog with `hidden: true`; their slugs are in `docs/ingest/african-art-20261002-b-orientation-requests.txt`. Their dimension and eligibility records are parked in `docs/ingest/african-art-20261002-b-held.json`. Their previews are already on R2, and their thumbnails show the wrong orientation. The other 27 held works were withheld (reasons in `-rejected.json`). The sandbox cannot reach atrium.earth, Sketchfab or R2, so all rendering and live checks run through the temporary workflows on this branch. Each one triggers when its request file is pushed, from any branch.

1. **Start.** `git fetch origin claude/atrium-pieces-deploy-4nay07 && git checkout -B <your-branch> FETCH_HEAD && npm ci && pip install pillow`.
2. **Review sheets.** `git fetch origin claude/atrium-orientation-sheets-african-art-20261002-b && mkdir -p /tmp/sheets && git archive FETCH_HEAD sheets | tar -x -C /tmp/sheets`. Each work has `sheets/sub-saharan-africa__<name>.webp`, a row of ten labelled renders; convert to JPEG with Pillow to view. Pick the variant where the work stands as displayed with its front toward the viewer (for a mask, the face visible).
   - A = current entry in `src/data/orientations.json` (`"auto"` if none)
   - B = `{"upAxis":"y","modelRotation":[0,0,0],"yaw":0}`
   - C = `[180,0,0]`
   - D = `[-90,0,0]`
   - E = `[90,0,0]`
   - F = `[0,0,90]`
   - G = `[0,0,-90]` (C–G keep `upAxis` `"y"` and `yaw` 0)
   - H/I/J = the current entry with `yaw` +90/+180/+270; if there is no entry, `{"upAxis":"auto","yaw":N}`
3. **Write orientations.** Write the choices into `src/data/orientations.json` (Python: `json.dumps(data, indent=2, ensure_ascii=False) + "\n"`, which keeps the existing formatting). If no variant is right:
   - either set a better base orientation and list the work in `docs/ingest/african-art-20261002-b-orientation-round2.txt` (pushing it renders new sheets to branch `…-round2`),
   - or withdraw the work the same way the other 27 were withdrawn.
4. **Re-render.** `cp docs/ingest/african-art-20261002-b-orientation-requests.txt docs/ingest/african-art-20261002-b-rerender.txt`, then commit and push with the orientations. `rerender-thumbnails.yml` pushes `rerendered/<slug>/thumb.webp` to branch `claude/atrium-rerender-african-art-20261002-b` in about 15 minutes. Copy each into `public/previews/renders/<slug>/thumb.webp` and look at every one.
5. **Posters.** `ONLY=$(paste -sd, docs/ingest/african-art-20261002-b-orientation-requests.txt) node scripts/generate-posters.mjs` (posters embed the thumbnail).
6. **Publish records.** For each entry in `-held.json`:
   - delete `hidden` from the catalog record
   - restore `records["physical-dimensions"]` and `records["spatial-eligibility"]` into `src/data/physical-dimensions.json` and `src/data/spatial-eligibility.json` (same JSON formatting)
   - set its `publication` to `published` in `docs/ingest/african-art-20261002-b.json`

   Then delete `-held.json`, `-orientation-requests.txt` and `-rerender.txt`.
7. **Remove the temporary workflows** `orientation-sheets.yml`, `rerender-thumbnails.yml` and `verify-live.yml`. Keep a copy of `verify-live.yml` outside the repo for step 9.
8. **Check.**
   - `npm run test:additions && npm run test:wings && npm run verify:assets && npm run test:display-support && npm run test:model-normalization && npm run test:r2-upload`
   - `SITE=https://atrium.earth npm run build`
   - `ATRIUM_TEST_EXECUTABLE=/opt/pw-browsers/chromium npm run test:museum-labels`

   `test:dimensions` and `test:spatial-eligibility` fail at baseline (LeWitt / "explicit decision") and are not caused by this batch.
9. **Deploy.** The owner authorized publishing these works. Squash-merge the PR to `main` and confirm the Pages run (`deploy.yml`) succeeds. Then verify the live site:
   - restart the branch from `main`
   - restore `verify-live.yml` and push any text in `docs/ingest/african-art-20261002-b-live-verify.txt`
   - read `live-verify/report.json` on branch `claude/atrium-live-verify-african-art-20261002-b`; expect `published` 100 and `ok` 100
   - do not merge those two files
10. **Report back.** Record the result here, and reply to the owner with `https://atrium.earth/works/<slug>/` for each newly published work.

## 2026-10-02 — Requested works: Moche vessels and a Khajuraho Harihara (13 works); Ain Sakhri Lovers held

- Task/owner: Claude Code session on this Mac, worktree `.tmp/requested-works-20261002`, branch `claude/requested-works-20261002`, base `c6fce007`. The owner asked for the Ain Sakhri Lovers, the Khajuraho mithuna groups (Kandariya Mahadeva, Vishvanatha), the Konark Sun Temple erotic friezes, Moche pots from Peru and the Warren Cup, and to deploy whatever was found. This batch does not touch the African review work on `claude/atrium-pieces-deploy-4nay07` or its 47 held records.
- Published (batch `requested-works-20261002`, 13 works, previews on R2): Harihara, possibly from Khajuraho (British Museum, scan by artfletch), and 12 Moche vessels: nine from Peru's Ministry of Culture, the Stockholm seated-warrior stirrup vessel, the Huacas de Moche Uhle Platform vessel and the skeletal potato bottle from the Uhle collections.
- Held for the owner's decision: the Ain Sakhri Lovers. The only scan is the British Museum's own, CC BY-NC-SA 4.0, and INGEST.md says NC never enters the public catalog. The record, optimized preview and reviewed orientation are prepared and parked in `docs/ingest/requested-works-20261002-held.json`; it is not in the catalog. Publishing it needs the owner's explicit approval of a licence exception.
- Not available: no downloadable scan under any licence exists for the Warren Cup, the Khajuraho mithuna friezes or the Konark erotic friezes (view-only, Standard-licensed or AI-generated models only). Findings and view-only leads are in `docs/ingest/requested-works-20261002.json`.
- Pending: 14 Sketchfab-only works (Rahu from Konark at the British Museum, 13 Moche vessels from Peru's Ministry of Culture) are saved in `docs/ingest/requested-works-20261002-leads.json`. Run 37035542350 (a branch-only copy of `acquire-leads.yml` with its own concurrency group, since run 37029820305 held the shared group) got HTTP 429 from Sketchfab on every download: the token's quota was spent by the day's earlier runs. Retry with `acquire-leads.yml` (`leads=docs/ingest/requested-works-20261002-leads.json`, `batch=requested-works-20261002`) after the quota resets, then curate its review branch. The temporary workflow is not on `main`.
- Preview adaptation: eight Ministry of Culture models re-emit their colour texture (emissive factor 0.8), which washes them out under gallery lighting. The emissive term was removed from the preview GLBs before upload; seven low-polygon "Objeto NN – Moche" models also use exposure 0.6. Their Atrium titles are descriptive because the publisher gives none.
- Validation: source SHA-256 records; orientation checked against publisher reference images (potato bottle stood upright, portrait head turned to face the viewer); all 13 R2 URLs return 200 `model/gltf-binary`; `verify:assets`; production build; `test:additions`, `test:wings`, `test:display-support`, `test:model-normalization`, `test:r2-upload` pass. `test:dimensions` and `test:spatial-eligibility` stop at the same baseline assertions as on `main`.
- Delivery: pushed to `main` for the Pages workflow; live verification recorded below.

### Production confirmation — requested works

Commit `0935540c` is deployment-verified. [GitHub Pages run 37038583980](https://github.com/never-nude/atrium.earth/actions/runs/37038583980) completed successfully. Live checks on 2026-10-02: all 13 work pages return 200, `/newest/` lists the batch, and every live model and thumbnail matches the reviewed local file by SHA-256, with each R2 filename carrying its content hash. The Ain Sakhri page correctly returns 404 while the record is held. An interactive WebGL check was inconclusive in this session: the embedded browser pane was not painting WebGL at all (a previously verified page showed the same blank stage), the model request succeeded and no console errors were logged. This confirmation changes documentation only. Next steps are the owner's decision on the Ain Sakhri licence exception and a retry of the 14 Sketchfab leads after the token's quota resets.

### Production confirmation — 20 held African works

- [PR #76](https://github.com/never-nude/atrium.earth/pull/76) squash-merged to `main` as `03cd657ee9da5b86ba6f3452e174be15385a41d1` (merged with the Moche/Harihara batch; catalog renumbered to 1,694 records / 1,658 public). [GitHub Pages run 37049799840](https://github.com/never-nude/atrium.earth/actions/runs/37049799840) succeeded.
- Live verification, [run 37050158483](https://github.com/never-nude/atrium.earth/actions/runs/37050158483) at 2026-10-02T18:51:35Z: `published` 100, `ok` 100, 0 failures, 0 held pages public. `newest.order_matches` is false only because the later Moche/Harihara batch now leads Newest Additions.
- Orientations chosen from review sheets (round 2 for five works; the first sheet run hung on one shard). Chokwe mask (aarlcc) and Masque-heaume Gelede (Binche) were published at the owner's request with imperfect orientation: the Chokwe face reads upside-down and the Gelede rests on its side. Both are worth a follow-up orientation pass.
- Not done: the temporary workflows `orientation-sheets.yml`, `rerender-thumbnails.yml` and `verify-live.yml` were merged to `main` (removal was blocked in the session); they only trigger on `docs/ingest/*` request files. Remove them in a follow-up. The trigger branch `claude/live-verify-african-20261002` holds the unmerged live-verify request.
- Follow-up (owner request): the 20 works now lead Newest Additions. They were restamped as their own batch `african-art-20261002-c` with `ingested_at` 2026-10-02T18:47:18Z (the #76 merge time), so Newest shows these 20 plus the 4 most recent Moche works. Their provenance record stays in `docs/ingest/african-art-20261002-b.json`.

## 2026-10-02 — Erotic antiquities: Townley Satyr and Nymph and two Priapus works from Tarraco (3 works)

- Task/owner: Claude Code session on this Mac, worktree `.tmp/erotic-antiquities-20261002`, branch `claude/erotic-antiquities-20261002`, rebased onto `42131d88`. The owner asked for a Ptolemaic couple in coitus, the Townley Satyr and Nymph and its Capitoline twin, phallic tintinnabula and Priapus statuettes.
- Published (batch `erotic-antiquities-20261002`, 3 works, Sketchfab CC BY 4.0): the Townley Satyr and Nymph (British Museum 1805,0703.2; scan by artfletch), the Tarraco tintinnabulum figure, probably Priapus (MNAT 542), and the marble phallus carved as a Priapus statuette (MNAT 518). The two MNAT models are the museum's own CC BY releases of Global Digital Heritage captures; GDH's own upload of MNAT 542 is CC BY-NC and is not used. The licence basis is recorded in `docs/ingest/erotic-antiquities-20261002.json`.
- Not available: no openly licensed scan of a Ptolemaic coitus group (the Brooklyn Museum's 58.34 is view-only), none of the Capitoline twin, and the remaining tintinnabula and Priapus scans are view-only or NC.
- Records: reviewed orientations (the satyr group turned -60° to its front), documented dimensions (British Museum record; MNAT labels), culture and geography, the British Museum record as the satyr's museum link, appearance, spatial and display-default entries, and the satyr group added to the What Survives exhibition. Its stated batch time (18:11Z) is earlier than the restamped African batch, so the 20 African works still lead Newest Additions.
- Review: a five-lens pre-publish review with adversarial verification (17 of 23 findings confirmed, all applied). Remaining systemic gap: CC BY attributions catalog-wide do not say that Atrium serves optimized derivatives.

### Production confirmation — erotic antiquities

Commit `271667d8` is deployment-verified. [GitHub Pages run 37051507318](https://github.com/never-nude/atrium.earth/actions/runs/37051507318) completed successfully. Live checks on 2026-10-02: all 3 work pages return 200; every live model, thumbnail and poster matches the reviewed local file by SHA-256, and each R2 filename carries its content hash. `/newest/` still leads with the 20 African works, followed by the 3 new works. `/exhibitions/what-survives/` lists the satyr group with its caption. The satyr page links the British Museum record, and the cards read "Tivoli, Italy" and "Roman", not the "Mediterranean" fallback. `test:museum-labels` could not run locally because Playwright's browser is not installed; it was not run in CI for this batch.

## 2026-10-02 — Hide the Discus Bearer

- The owner reported `roman/discus-bearer-glyptotek` (Discus Bearer, Ny Carlsberg Glyptotek) as broken and asked for it to be hidden. Following the Turrell withdrawal pattern, it is marked `hidden` in the catalog and its public physical-dimension and spatial-eligibility entries are removed. Source metadata, preview, thumbnail and orientation records are retained for a later repair.
- Additions, wings, asset and display-support checks and the production build passed; the generated site has no Discus Bearer page or reference.

## 2026-10-05 — Jewish and Islamic art expansion

- Task/owner: this Codex session on `codex/judeo-islamic-20261005`, starting from production commit `30b622e66418ac2193612f4b0a1529134b9b4e0b`.
- Prepared: 41 reviewed 3D additions: 21 works of Jewish ritual, communal and architectural heritage and 20 works from Islamic societies. The selection spans Poland, Belarus, England, Spain, Iran, Iraq, Armenia, Egypt, Algeria, Tanzania, Bangladesh and several objects whose production place remains explicitly unfiled. Nine candidates were rejected after four-angle review for missing textures, incomplete/noisy geometry or an illegible subject.
- Preservation and routing: all 1,697 existing catalog records and settings are retained. The resulting catalog has 1,738 records. New works route by production origin; four objects with unverified production places include reviewed Unfiled explanations. Newest Additions remains neutral and contains exactly the rolling 24 latest public works.
- Validation: source and optimized GLBs were checked as self-contained files; all 41 optimized works passed four-angle review and received 900×1125 thumbnails. Addition grouping, exact rolling-24 behavior, wing routing, catalog assets, whitespace, 5,166 museum-label layouts and the 4,596-page production build pass.
- Production confirmation: commit `3665320` was pushed to `main`, and [GitHub Pages run 37332945365](https://github.com/never-nude/atrium.earth/actions/runs/37332945365) completed successfully. Live checks on 2026-10-05 verified all 41 work pages and SHA-256-matched every published model and thumbnail. `/newest/` contains exactly 24 works and does not expose the batch theme or name.

## 2026-10-05 — Newest Additions: 40-work floor and complete latest batch

- Task/owner: this Codex session on `codex/religious-expansion-20261005`, starting from production commit `970854dfcb7a6e104d87d539a0c04613b4d9d460`. The owner requested that Newest Additions expand from 24 to 40 and never truncate the latest batch, before continuing the broader religious-art acquisition.
- Behavior: `/newest/` now shows at least the 40 most recent eligible public works. If the latest batch has more than 40 public members, or a continuation makes older members part of that latest batch, all eligible members of that batch are included. Hidden and `exclude_from_additions` works remain excluded. The homepage continues to use the first four works in the same ordered set.
- Validation: focused tests cover the 40-work floor, a 45-work latest batch, a small latest batch padded from earlier work, exclusions, and a continued batch whose earlier members fall beyond the first 40. Addition grouping, wing routing, asset verification and whitespace checks pass. The production build generated 4,596 pages; its neutral `/newest/` contains all 41 works from `judeo-islamic-art-20261005` and does not expose that internal batch theme.
- Next: publish and live-verify this behavior, then resume the paused Sikh, Hindu, Buddhist, Celtic and other religious-art acquisition.

### Production confirmation — complete latest batch

Commit `1afb322` is deployment-verified. [GitHub Pages run 37334355346](https://github.com/never-nude/atrium.earth/actions/runs/37334355346) completed successfully. Live `/newest/` returns 200 and contains all 41 works in the current batch in the exact expected order, with neutral copy and no internal batch-theme text. The acquisition research may now resume.

## 2026-10-05 — Broader religious-art acquisition (60 leads)

- Task/owner: this Codex session on `codex/religious-expansion-20261005`, continuing after the Newest Additions change. The owner requested a broad expansion beyond the newly published Jewish and Islamic group, naming Sikh, Hindu, Celtic/pagan and Buddhist art among the priorities.
- Prepared for acquisition: 60 catalog-new, permissively licensed and downloadable Sketchfab leads: 24 Buddhist, 12 Hindu, 6 Sikh, and 18 Jain, Shinto, Celtic, Norse, Slavic, Daoist, Indigenous American, ancient Greek and Graeco-Egyptian works. The pool spans ancient through contemporary material and includes sculpture, relief, ritual implements, jewelry, ceramics, textile, architectural fragments and two landscape/building models.
- Curation: same-object duplicates under alternate scans were removed, including MIA Hindu objects already in Atrium, an MIA Avalokiteshvara head, and Cleveland's two Niō already cataloged individually. Active worship-site scans, human remains and funerary contents, unclear or noncommercial licenses, repetitive fragments, weak stock models, and AI-ambiguous sources were excluded. Contemporary Sikh reconstructions and museum casts remain explicitly identified as such.
- Evidence: `docs/ingest/religious-art-20261005-selection.json` records the exact UIDs; `docs/ingest/religious-art-20261005-leads.json` carries source, museum, origin, license and download evidence. The acquisition workflow must use fresh authenticated Sketchfab download URLs and place results on its review branch.
- Publication status: no work in this 60-lead set is counted as acquired or live yet. Every fetched model still requires multi-angle geometry, surface, orientation and thumbnail review; metadata reconciliation; asset checks; production build; deployment confirmation; and live page/model/thumbnail verification.

### Reviewed publication batch — 35 works

- Acquisition run [37343108716](https://github.com/never-nude/atrium.earth/actions/runs/37343108716) fetched all 60 candidates. Thirty-five passed geometry integrity checks and uploaded to R2; 25 failed the geometry gate. The accepted set comprises 17 Buddhist works, 6 Hindu works, one Sikh kara, and 11 Jain, Shinto, Celtic, Norse, Mesoamerican, Greek, Roman-provincial and Graeco-Egyptian works.
- The Komagata Maru display model failed the geometry gate and remains separately recorded as a hold because rights in the contemporary physical replica and its present museum status are not confirmed.
- Museum metadata was reconciled from the current lead file, including 41 documented physical-dimension records across the original 60 leads, canonical museum links, culture, geography, accession data and explicit unfiled reasoning for the kara. The resulting catalog contains 1,773 works; all 35 additions are public and uniquely indexed.
- Human image review covered every accepted thumbnail. All 17 workflow orientation flags were resolved. Twelve additional presentation defects caught in the thumbnails were corrected and re-rendered: five sideways figures, three reverse views, and four poorly presented plaques, fragments or architectural/object scans. The final reviewed thumbnails are upright, front-readable and textured.
- Newest Additions contains the complete 35-work batch plus five earlier works, preserving the 40-work floor without exposing the internal acquisition theme in its copy.
- Validation passes: additions grouping/newest behavior, wing routing, asset verification, display support, model normalization, R2 upload tests, whitespace checks, 5,271 museum-label layouts and the 4,713-page production build.
- Publication status: reviewed locally and ready to deploy; live verification remains pending.

### Production confirmation — broader religious-art batch

- Commit `741b6e3` was pushed to `main`. [GitHub Pages run 37351877863](https://github.com/never-nude/atrium.earth/actions/runs/37351877863) completed successfully.
- Live verification on 2026-10-05 confirmed all 35 work pages return 200 with their expected titles, all 35 thumbnails byte-match the reviewed local files, and all 35 R2 preview models byte-match the mirrored reviewed files.
- `/newest/` returns 200 with exactly 40 unique work links, contains the complete 35-work batch, and does not expose the internal batch theme. The held Komagata Maru display-model URL returns 404.

## 2026-10-05 — Nordic, Iranian and global religious-art expansion (50 leads; 16 held)

- Task/owner: this Codex session on `codex/religious-expansion-2-20261005`, continuing from deployment-verified production commit `c5ebb40`. The owner requested more religious art led by Nordic and Zoroastrian material, with striking works from other underrepresented traditions.
- Prepared for acquisition: 50 catalog-new, downloadable candidates under CC0, CC BY or CC BY-SA: 19 Nordic, Germanic, Baltic and Finnic works; 5 Iranian, Kushan and adjacent fire-cult or divine-image works; 3 Roman Mithraic works; and 23 works spanning Shinto, Daoist, Coptic, Mesoamerican, Oceanic, African, Mediterranean, Phoenician/Punic and Mesopotamian traditions.
- Curatorial boundaries: Roman Mithraism is labeled separately from Zoroastrianism. Achaemenid and Sasanian court objects were not treated as automatically devotional. Uncertain mythic, amuletic or deity readings are explicit in the candidate notes. Active worship-site scans, human remains, noncommercial or no-derivatives licenses, view-only models, stock/AI assets and known same-object duplicates were excluded. No securely identified downloadable Sámi ritual object with a permissive license was found; Finnic material was not relabeled as Sámi.
- Evidence: `docs/ingest/religious-art-20261005-b-leads.json` contains exact source, license, institutional and object metadata; `docs/ingest/religious-art-20261005-b-rejected.json` records 16 lower-confidence candidates held before publication; `docs/ingest/religious-art-20261005-b-selection.json` records the grouped UIDs and selection policy. `docs/ingest/religious-art-20261005-b-review-holds.json` records four fetched candidates that need object-level identity review before publication. Every fetched model still requires geometry, texture, orientation, thumbnail and catalog review before publication.
- Next: run `acquire-leads.yml` with batch `religious-art-20261005-b`, curate the review branch, publish all works that survive visual and metadata review, then verify every live page, thumbnail and model.

### Reviewed publication batch — 36 works

- Acquisition run [37396945234](https://github.com/never-nude/atrium.earth/actions/runs/37396945234) used an earlier 54-candidate revision and reported 45 accepted models plus nine geometry rejects. The finalized 50-lead set contains 42 geometry passes and eight geometry rejects; four more works were removed at the object-evidence gate. Human four-angle review then held the pewter salt-cellar lid because two detached calibration meshes float above it, and the Mules Mithras model because it is an incomplete room scan of a mounted replica that the source record distinguishes from the original in Bolzano. The final publication set is 36 works.
- Scope: 13 works route to Europe, nine to the Near East, four each to Africa and Greece/Rome, three to Asia and three to the Americas/Oceania. The selection includes Nordic and Germanic pendants, brooches, helmets, runestones and picture stones; one carefully qualified Sasanian amulet; Roman Mithraic sculpture; Shinto and Daoist objects; Coptic stelae; Maya and Zapotec ritual ceramics; Oceanic and African masks and shrine arts; Isis, Samothracian, Phoenician/Punic, Assyrian and Mesopotamian works. Roman Mithraism remains explicitly separate from Zoroastrianism, and the amulet is not presented as securely Zoroastrian.
- Rights and scale: 29 models are CC BY 4.0, four are CC BY-SA 4.0 and three are CC0 1.0. Fifteen works have object-level documented dimensions; 21 remain explicitly unresolved. All 36 have disabled `unverified` spatial-eligibility decisions, so no unsupported real-world AR scale is claimed.
- Visual review: every accepted model was inspected from four sides. Seventeen works received explicit human-reviewed display transforms, including front-facing Vendel helmets, readable runestones and stelae, an open iconostasis, upright masks and the reclining Samothracian figure. All 36 production thumbnails were regenerated from the final models and transforms, inspected in contact sheets, and passed the automated image audit. The Yoruba altar figure received a measured lighting adjustment to reveal its dark wood surface without flattening it.
- Preservation and presentation: all 1,773 production-base catalog records and their settings are preserved apart from regenerated `total` values. The catalog has 1,809 records, of which 1,793 are public. Newest Additions remains neutral and will show 40 works: the complete 36-work latest batch plus the four preceding public additions.
- Validation completed: additions/newest behavior, wing routing, catalog assets, display support, model normalization, R2 upload tests, spatial capability/viewer/appearance checks and whitespace validation pass. All 36 R2 preview URLs return `200 model/gltf-binary`; their byte counts and content-hashed filenames match the local reviewed models. The production build generated 4,837 pages, all 5,379 public museum-label layouts passed, and the built Newest page contains exactly 40 unique works, including all 36 additions, with neutral copy and no held routes. Deployment and live verification are recorded below.

### Production confirmation — Nordic and global religious-art batch

- Commit `4d9335c` was pushed to `main`. [GitHub Pages run 37404475253](https://github.com/never-nude/atrium.earth/actions/runs/37404475253) completed successfully.
- Independent live verification on 2026-10-06 confirmed all 36 work pages return 200 with their expected titles, all 36 thumbnails byte-match the reviewed local files, and all 36 R2 preview models byte-match the reviewed files and their content-hash URL prefixes.
- `/newest/` returns 200 with exactly 40 unique work links, contains the complete 36-work batch, and exposes neither the internal batch name nor a curatorial theme. All 22 rejected or review-held routes return 404.
- The requested completion email was sent after live verification (Gmail message `1a10f1c607f4601b`).

## 2026-10-05 — Fixed museum lighting and source-fidelity rule

- Task/owner: this Codex session on `codex/iconic-scan-upgrades-20261006`, based on production commit `774533892e92c0db7f20708b5a2866ca222db5c7`. The owner asked to remove the visitor-controlled light direction while keeping exposure and texture adjustable.
- Prepared: both the immersive viewer and legacy HUD no longer render or bind a light-angle control. Exposure, texture, rotation, wireframe and the fixed neutral key/fill/rim/hemisphere lighting remain. Related interface and exhibition copy no longer promises movable lighting.
- Ingest policy: the scanned object's exact identity now governs titles and metadata; authored textures and PBR materials must be preserved, casts and copies must be identified, and untextured meshes must not receive invented patina, veining, paint or wear.
- Validation: the production build completed successfully with 4,837 generated pages. A repository search found no remaining visitor-facing movable-light control or promise. The pre-existing unfiled-work report is unchanged.
- Delivery: commit `75f3cce0` was pushed to `main`. [GitHub Pages run 37408063954](https://github.com/never-nude/atrium.earth/actions/runs/37408063954) completed successfully. A fresh live reload of the Domburg Brooch page showed a **Display** panel containing exactly **Exposure** and **Texture**; the angle control, legacy light slider and movable-light API were absent. The separate iconic-model upgrade work remains in progress and is not included in this UI change.

## 2026-10-06 — Textured Copenhagen Thinker replacement

- Task/owner: this Codex session on `codex/iconic-scan-upgrades-20261006`, continuing the owner's request to make each digitized object true to its own material, color, texture and physical identity.
- Prepared: `rodin/the-thinker` now uses Rigsters' photogrammetric scan of Auguste Rodin's Copenhagen bronze M.IN 605 at the Ny Carlsberg Glyptotek. The optimized GLB retains all 50,974 faces plus authored base-color, normal and metallic-roughness maps. Its immutable R2 copy was uploaded and byte-verified by [acquisition run 37407971726](https://github.com/never-nude/atrium.earth/actions/runs/37407971726).
- Object truth: the catalog identifies the exact 73.3 cm bronze, modeled in 1880 and cast in 1900–1901, instead of describing the unrelated 1.89 m Musée Rodin monumental version. The verified-size record now binds the reviewed complete scan to the Ny Carlsberg Foundation measurement. The former monumental measurement is retained only as retired audit history.
- Appearance and geometry: ten orientation views confirmed the raw model is already Y-up; the automatic stable-pose proposal was rejected. Four cardinal yaws show a complete figure, rock seat and integral lower support with no detached debris outside the sculpture. The source's photographed green, black and brown patina maps replace the old synthetic patina treatment. Default exposure is reduced to 0.25 after four comparison renders; visitors still retain Exposure and Texture controls.
- Validation: the content-hashed R2 URL returns SHA-256 `ce4312ca…68b57`; the final 1000×1250 thumbnail is `b34a4fca…a980`. Addition grouping, wing routing, catalog assets, model normalization, display-support, spatial viewer/appearance, R2-upload tests, exact 73.3 cm cast binding and whitespace checks pass. Museum-label validation requires a built `dist` and was not run locally because the Mac has insufficient free disk for a second full build; the immediately preceding fixed-light source completed a 4,837-page production build. Deployment and live page/model/thumbnail checks remain pending.

### Production confirmation — Copenhagen Thinker

- Commit `fcefcb2a` is deployment-verified. [GitHub Pages run 37409955159](https://github.com/never-nude/atrium.earth/actions/runs/37409955159) completed its production build and deployment successfully.
- Live verification on 2026-10-06 confirmed the canonical page returns the exact Copenhagen title, date, material, museum, accession and 73.3 cm cast-size record. The WebGL canvas loaded with no viewer error from the new content-hashed R2 URL. Its model and thumbnail byte-match the reviewed SHA-256 values above.
- The live Display interface contains one Exposure slider and one Texture slider. It contains no light-angle control or movable-light API. A live visual check confirmed the model is upright, complete and rendered with its photographed patina maps.

## 2026-10-06 — Eight iconic scan replacements and larger-batch acquisition path

- Replaced the production previews for Michelangelo's *David*, the SMK casts of the *Pietà* and *Moses*, and the SMK casts of the *Venus de Milo*, *Discobolus*, *Laocoön*, *Dying Gaul* and *Belvedere Torso*. All eight source downloads are pinned to exact byte counts and SHA-256 values; their optimized R2 derivatives are content-addressed and independently byte-verified.
- Object identity and scale follow the exact scanned object. *David* is labeled as the Accademia marble at 5.17 m. The other seven are explicitly identified as SMK plaster casts with their own accessions and documented metric dimensions; measurements of the underlying originals remain separate research history. AR bindings use those reviewed object measurements.
- Ten-view sheets retained the human orientation evidence. A final thumbnail review corrected the *Laocoön* from a rear view and the *Dying Gaul* from an overhead view before publication. All final cards are upright, front-readable and use marble or plaster appearance profiles without invented patina.
- The acquisition workflow now supports one 180–240-work logical batch as chained 45–60-work catalog-writing chunks through an explicit cumulative `base_ref`. Orientation and thumbnail review can run in sharded jobs after the final chunk. Duplicate, missing, empty or partial review artifacts fail closed. Live verification accepts any batch and checks pages, thumbnails, model hashes and complete Newest ordering with bounded concurrency. Newest retains its 40-work floor and includes every public work in the latest logical batch, including a tested 240-work continuation.
- Validation passed: the focused eight-work integrity test, exact poster/thumbnail matching, 240-work Newest test, review-artifact tests, workflow YAML and embedded-JavaScript checks, whitespace checks and a 4,849-page production build.

### Production confirmation — iconic replacements

- Commit `152924a3` is deployment-verified. [GitHub Pages run 37535397259](https://github.com/never-nude/atrium.earth/actions/runs/37535397259) and Pages deployment `6895974949` completed successfully.
- Live verification on 2026-10-06 confirmed all eight canonical pages return their expected title, accession, material, content-hashed model URL and metric AR scale. Every public model byte-matches its reviewed full SHA-256 and byte count; every public thumbnail byte-matches the reviewed local file.
- Every page exposes Exposure and Texture controls plus AR placement. None exposes the retired light-angle control or legacy movable-light slider.

## 2026-10-06 — Claude Code handoff: 200-candidate global religious-art batch

- Task/owner/branch: transferred from this Codex session to Claude Code on `codex/religious-art-global-20261006`; all chunks share logical batch ID `religious-art-global-20261006`.
- Completed: Chunk 1 fetched 50 candidates in Actions run 37540181354, accepted 42, rejected 8, uploaded all 42 accepted assets to R2, and rendered all 42 thumbnails/posters. A 27-work sharded orientation review is running as Actions run 37545902463. Chunk 2 and Chunk 3 each contain 50 prepared leads. A 50-UID Chunk 4 shortlist is preserved for revalidation and final lead construction.
- Mandatory correction: remove new `ancient-near-east/assyrian-winged-genius-ec414d`; it is an exact duplicate of established `assyrian/winged-genius-mia`. Review the additional curation and metadata flags in `docs/handoffs/claude-code-religious-art-20261006.md`.
- Validation performed: Chunk 1 fetched/assembled/R2/render stages succeeded; 150 candidates across Chunks 1–3 have unique slugs and source UIDs; Chunk 2/3 are valid JSON with 50 records apiece. Chunk 1 has not yet passed final orientation/contact-sheet/metadata review. Chunks 2–4 have not been acquired. Nothing from this religious-art batch is on `main` or live.
- Next step: finish Chunk 1 orientation and curation, then acquire Chunks 2–4 sequentially using the cumulative review branch, review the entire logical batch, run the full test/build/live-verification sequence, and publish under the user's standing authorization.
- Full operational handoff: `docs/handoffs/claude-code-religious-art-20261006.md`.

### Progress — Chunk 1 orientation review (Claude Code, paused 2026-10-06)

- Chunk 1 now has 39 works after removing the duplicate Assyrian genius, the cylinder seal and the Oświęcim stamp (`6735f145`). The Tanit maker reads "probably Sicilian", which the museum source supports.
- 15 of 24 round-2 orientations are reviewed and committed (`fc1a7acd`). Six auto-posed works were found misoriented and sent for ten-view sheets in run 37547775157.
- Orientation run 37545902463 lost shards 3 and 6 to a 180-second render timeout, so its sheet branch was not published. Nine works still await sheets.
- No thumbnails have been rerendered with the new orientations yet. Nothing from this batch is on `main` or live.
- Resume instructions: `docs/handoffs/codex-religious-art-20261006-resume.md`.
