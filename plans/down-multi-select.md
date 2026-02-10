# Design: Multi-Select for `skybox down`

**Date:** 2026-02-09
**Status:** Approved

## Problem

`skybox down` only allows stopping one project at a time (single-select rawlist prompt). `skybox up` already supports multi-select via checkbox. Users should be able to select multiple projects to stop in one invocation.

## Design

### Project Resolution

| Invocation | Behavior |
|---|---|
| `skybox down myapp` | Single project (no change) |
| `skybox down` (inside project dir) | Single project from CWD (no change) |
| `skybox down` (no arg, no CWD) | **Checkbox multi-select** (new) |
| `skybox down --all` | All projects (no change) |

### Execution Flow

**Phase 1 — Stop each project sequentially:**
For each selected project:
1. Run pre-down hooks
2. Flush sync
3. Stop container
4. Handle encryption (prompt passphrase individually per project)
5. Delete session file
6. Run post-down hooks

**Phase 2 — Batch cleanup (ask once, apply to all):**
After all projects stopped:
1. "Remove containers for all stopped projects?" → yes/no
2. If yes: "Also remove local project files?" + confirmation → yes/no
3. If no cleanup: "Pause background sync for all stopped projects?" → yes/no

### Flag Behavior

- `--cleanup`: Skip cleanup prompt, apply removal to all
- `--no-prompt`: Skip all prompts (just stop, no cleanup)
- `--force`: Continue past individual failures
- `--all`: Stop all local projects (existing behavior)

### Single Project Path

When only one project is resolved (explicit arg, CWD, or single checkbox selection), the existing single-project flow runs unchanged — including per-project interactive prompts.

## Implementation

### Files Changed

Only `src/commands/down.ts`:

1. **`resolveProjectsForDown()`** — New function. Uses `checkbox` from `@inquirer/prompts` for multi-select when no arg/CWD match. Returns `string[]`.
2. **`stopSingleProject()`** — Extracted from `downCommand()`. Core stop logic: hooks, sync flush, container stop, encryption, session delete.
3. **`handleBatchCleanup()`** — New function. Asks cleanup/remove/pause questions once, applies to all stopped projects.
4. **`downCommand()`** — Refactored as orchestrator: resolve projects → single path or multi path.

### No Changes To

- `src/types/index.ts` — `DownOptions` already has all needed fields
- `src/lib/project.ts` — `resolveSingleProject()` untouched; new resolution logic lives in `down.ts`

## Documentation Updates Required

- `docs/reference/` — Update `down` command docs to mention multi-select
