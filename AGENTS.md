# atrium.earth — Codex project instructions

Repository: `never-nude/atrium.earth`. Default branch observed during setup: `main`.

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
