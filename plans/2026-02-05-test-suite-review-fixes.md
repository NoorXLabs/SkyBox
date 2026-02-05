# Test Suite Review Fixes

**Branch:** `NoorChasib/test-suite-review`
**Reviewed:** 2026-02-05
**Status:** Pending

## Critical

### 1. Add fork PR guard to CI workflow
**File:** `.github/workflows/ci.yml`
**Line:** 11

The CI workflow runs on `self-hosted` and triggers on `pull_request` but has no `if` condition to restrict fork PRs. The integration and E2E workflows both have this guard.

**Fix:** Add to the `ci` job:
```yaml
jobs:
  ci:
    runs-on: self-hosted
    if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository
```

## Important

### 2. Fix tilde expansion in E2E test utils
**Files:**
- `tests/e2e/helpers/e2e-test-utils.ts` (lines 109, 187)
- `tests/e2e/remote/lock-system.test.ts` (line 39)

`escapeShellArg()` wraps `~`-prefixed paths in single quotes, preventing bash tilde expansion. `mkdir -p '~/devbox-e2e-tests/...'` creates a literal `~` directory instead of expanding to home.

In `lock-system.test.ts` line 39, `mkdir -p ~/.devbox-locks` expands correctly (unquoted tilde), but the redirect target `> ${escapeShellArg(lockPath)}` wraps `~/.devbox-locks/...` in single quotes, preventing expansion. Inconsistent behavior on the same line.

Note: The same pattern exists in production code (`src/commands/rm.ts:147`, `src/commands/new.ts:209`). Investigate whether production users typically use absolute paths or if this is a latent bug.

**Fix:** Resolve `~` to `$HOME` before escaping, or use unquoted tilde with validated path components. For example:
```typescript
const resolvedPath = remotePath.replace(/^~/, "$HOME");
```

### 3. Make E2E cleanup fault-tolerant
**File:** `tests/e2e/helpers/e2e-test-utils.ts` (line 118)

If `cleanupRemoteTestDir()` throws (SSH failure during teardown), subsequent cleanup (stale locks, local dirs, DEVBOX_HOME restore) is skipped.

**Fix:** Wrap each cleanup step in independent try/catch:
```typescript
async cleanup(): Promise<void> {
    try { await cleanupRemoteTestDir(runId, testRemote); } catch { /* log */ }
    try { await cleanupStaleLocks(testRemote); } catch { /* log */ }
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* log */ }
    if (originalDevboxHome) {
        process.env.DEVBOX_HOME = originalDevboxHome;
    } else {
        delete process.env.DEVBOX_HOME;
    }
}
```

### 4. Remove redundant `biomejs/setup-biome@v2` from CI
**File:** `.github/workflows/ci.yml` (line 17)

Lint step changed to `bun run check:ci` which uses project-local biome from `node_modules`. The global biome action is no longer needed.

**Fix:** Remove the `- uses: biomejs/setup-biome@v2` step.

### 5. Add `--preload` to `test:all` script
**File:** `package.json` (line 30)

The `test` script includes `--preload ./tests/helpers/test-utils.ts` but `test:all` does not.

**Fix:**
```json
"test:all": "bun test --preload ./tests/helpers/test-utils.ts tests"
```

### 6. Rename or implement `mutagen-sync.test.ts`
**File:** `tests/e2e/sync/mutagen-sync.test.ts`

File uses only `rsync`, not Mutagen. The design plan calls for actual Mutagen session testing with bidirectional sync.

**Fix:** Either rename to `rsync-roundtrip.test.ts` or add a TODO comment explaining the deferral and implement actual Mutagen testing later.

### 7. Add `success` checks to E2E remote command results
**Files:**
- `tests/e2e/remote/browse-list.test.ts` (lines 20, 31)
- `tests/e2e/remote/lock-system.test.ts` (lines 37, 43, 50, 56)
- `tests/e2e/sync/mutagen-sync.test.ts` (lines 45, 52)
- `tests/e2e/workflow/full-lifecycle.test.ts` (lines 53, 62)

Most tests destructure only `{ stdout }` without checking `success`. SSH failures produce confusing assertion errors.

**Fix:** Add `expect(result.success).toBe(true)` before checking stdout, at minimum for setup commands in `beforeAll`.

### 8. Update CLAUDE.md NPM Scripts table
**File:** `CLAUDE.md` (line 66)

Table says `bun run test` is "Run all tests" but it only runs unit tests. Missing entries for `test:integration`, `test:e2e`, `test:all`.

**Fix:** Update the table:
| Script | Purpose |
|--------|---------|
| `bun run test` | Run unit tests |
| `bun run test:integration` | Docker integration tests |
| `bun run test:e2e` | Remote server E2E tests |
| `bun run test:all` | Run all test tiers |

## Suggestions

### 9. Remove unreachable E2E PR guard
**File:** `.github/workflows/e2e.yml` (line 16)

The `if` condition guards against `pull_request` events but the workflow never triggers on PRs. Remove or add a comment that it's preemptive.

### 10. Use static import for `getContainerIdByProjectPath`
**File:** `tests/integration/docker/container-lifecycle.test.ts` (line 59)

Dynamically imported via `await import(...)` when it could be a static import at line 14 alongside the other functions from the same module.

### 11. Add `afterAll` cleanup to `shell-entry.test.ts`
**File:** `tests/integration/docker/shell-entry.test.ts`

Missing `afterAll(async () => { await cleanupTestContainers(); })` unlike `devcontainer-templates.test.ts`. Orphaned containers possible if `afterEach` fails.

### 12. Stage and commit working tree fixes
**Files (unstaged):**
- `tests/unit/commands/dry-run-global.test.ts` -- removes hardcoded machine-specific path
- `tests/unit/commands/open.test.ts` -- fixes `"projects"` -> `"Projects"` to match constant
- `tests/unit/commands/hook.test.ts` -- moves biome-ignore to correct position
- `tests/unit/commands/shell-docker-isolated.test.ts` -- replaces session mocks with real session files

### 13. Move completed plan to archive
**File:** `plans/2026-02-04-test-restructure-design.md`

Per project convention, completed plans should be moved to `plans/archive/` after merge.

### 14. Update stale version in CLAUDE.md
**File:** `CLAUDE.md` (line 7)

Says `0.6.0-beta`, package.json says `0.7.7`.
