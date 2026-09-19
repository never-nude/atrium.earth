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
