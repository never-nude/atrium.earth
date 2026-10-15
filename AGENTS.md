# atrium.earth — Codex project instructions

Repository: `never-nude/atrium.earth`. Default branch observed during setup: `main`.

## Standing owner preference: archive before local offload

For future acquisitions and storage cleanup, follow [the verified Drive archive workflow](docs/storage-archive-workflow.md) and `INGEST.md`.

- Back up each piece to permanent private Google Drive storage. Reuse existing copies after complete SHA-256, exact-byte and private-sharing verification; upload only missing files. Preserve unchanged originals, embedded/external textures and materials, attribution, licenses, source URLs and portable recovery mappings. Keep originals distinct from serving previews; explicitly label derivative-only or missing-source cases.
- Verify the complete source package and its cloud recovery manifest before local removal. Confirm current live model delivery, full hashes/bytes and applicable CORS, and preserve every local asset still required for builds, the viewer or AR. Tracked and Pages-local files stay protected until a separately verified hosting migration or reliable build hydration makes removal safe.
- Offload eligible local files in bounded, resumable batches using the storage tools: dry-run planning, fresh signed backup/live receipts, exact whitelists, unchanged-file checks and checked quarantine. Retain unverified, incomplete, stale or uncertain files; never delete source folders wholesale or treat temporary Actions artifacts as permanent backups.
- Keep Drive identities, signed URLs, account data, signing keys and absolute local inventories out of public Git. Save recovery maps, verification checkpoints and removal records in the private archive. Re-inventory each computer and consult completed removal journals before resuming; another machine's inventory is not proof of local state.
- Report verified/offloaded files separately from pending coverage. A completed batch does not establish that the whole collection is backed up. This is a standing workflow preference, not a claim that a background automation is running.

<!-- shared-codex-handoff:start -->
## Shared Codex handoff across devices

These rules add a repository-based handoff; preserve all existing project-specific instructions and release requirements.

### Start a session
- Read `STATUS.md`, the README, and any existing `CLAUDE.md`, workflow, task, or handoff documents. Follow applicable nested AGENTS.md files before changing their files.
- Verify the checkout's remote, branch, local changes, and unpushed commits. Fetch the remote when available; compare history and the status on the current branch with the latest default branch.
- Preserve all local and remote work. Fast-forward only a clean branch with its confirmed upstream. Inspect divergence before reconciling; do not reset, clean, force-push, auto-stash, or overwrite one machine's folder with another.
- If offline or unable to access another machine, say what could not be checked. Repository history does not reveal uncommitted work or separate conversations.
- Confirm the intended repository/version before feature work when related repositories exist. A handoff file does not designate this repository as the production version or retire any other version.

### Coordinate work
- One session owns a given task and its commits; use separate branches for distinct concurrent tasks and follow this project's existing contribution workflow.
- Record the task, branch, owner/device when known, completed work, blockers, and next step in STATUS.md. Never invent ownership, test results, or another session's state.
- STATUS.md is a handoff, not a lock. Fetch before publishing, reconcile concurrent updates, and never overwrite another session's work.
- Keep private material and secrets out of tracked status documents. Preserve repository visibility; do not copy private project details into public repositories.

### Finish a session
- Update STATUS.md alongside the task changes with actual validation, unresolved issues, and a concrete next step. Preserve existing status history.
- Stage only intended files. Commit/push when authorized and honor existing PR, test, and deployment requirements; this handoff does not grant new release authority or bypass checks.
- Distinguish local, pushed, merged, and deployment-verified work. If not pushed, explicitly state other devices cannot fetch it yet. Use known commit references only.
- Shared documents travel through Git; chat transcripts, credentials, dependencies, and unpublished local work do not automatically synchronize.
- On first use on each computer, inspect and preserve its local work, fetch, safely integrate these documents, and record any unfinished work discovered. Both computer checkouts remain unverified until checked directly.
<!-- shared-codex-handoff:end -->
