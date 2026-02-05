# Design: `skybox rm --remote` Multi-Select

## Summary

Add interactive multi-select deletion of remote projects via `skybox rm --remote` (no project argument). Mirrors the existing local multi-select behavior but targets remote projects.

## User Flow

1. User runs `skybox rm --remote` (no project argument).
2. If multiple remotes configured, prompt to select one. Single remote auto-selects.
3. Fetch project list from selected remote (reuses `getRemoteProjects()` from `browse.ts`).
4. Display interactive checkbox list of remote projects.
5. If no projects selected, exit with "No projects selected."
6. Double confirmation: first lists what will be deleted, second asks "Are you absolutely sure?"
7. For each selected project, delete from remote.
8. For each selected project that also exists locally, ask: "project-x also exists locally. Remove local copy too?" If yes, run full local cleanup (stop container, terminate sync, remove files, clear session).
9. Remove deleted projects from config.

`--force` skips all confirmations. Defaults to keeping local copies when forced (user didn't explicitly opt in to local deletion).

## Code Changes

### `src/commands/rm.ts`

- Add new branch at top of `rmCommand()`: when `!project && options.remote`, call new `rmRemoteInteractive()` function.
- New `rmRemoteInteractive(options: RmOptions)`:
  - `selectRemote(config)` to pick remote
  - `getRemoteProjects(host, remote.path)` to fetch list
  - `checkbox()` for multi-select
  - `confirmDestructiveAction()` for double confirm
  - Loop: delete from remote, then per-project local cleanup prompt if `projectExists()` returns true
  - Reuse existing `deleteFromRemote()` and local cleanup logic

### No other files changed

- `getRemoteProjects()` already exported from `browse.ts`
- No type changes (`RmOptions` unchanged, `--remote` stays boolean)
- No CLI registration changes

## Edge Cases

- **No remote projects found**: "No projects found on remote." and exit.
- **Remote connection failure**: Spinner fail + error message + exit.
- **Remote deletion fails for one project**: Log error, continue with remaining.
- **Local cleanup fails for one project**: Log error, continue with remaining.
- **`--force` + `--remote` + no project**: Skip all confirmations, keep local copies.
- **Project in config but not on remote**: `rm -rf` no-ops silently, config still cleaned up.

## Documentation Updates Required

- `docs/reference/rm.md` — update to document `--remote` multi-select behavior
