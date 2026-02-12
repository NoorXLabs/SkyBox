# Auto-add `.skybox/*` to `.gitignore`

## Problem

SkyBox creates a `.skybox/` directory inside user projects (containing `state.lock` with ownership and session data), but never ensures this directory is git-ignored. This means state files could accidentally get committed to user repositories.

## Solution

Add a utility function `ensureGitignoreSkybox` in `src/lib/remote.ts` that ensures `.skybox/*` is listed in the project's `.gitignore` on the remote server. Call it from `skybox new`, `skybox push`, and `skybox up` — any time SkyBox writes to `.skybox/` in a project.

## Design Decisions

- **Remote-only**: The remote is the canonical project location. The `.gitignore` change syncs down via Mutagen to all machines.
- **Append with comment**: If `.gitignore` exists, append `# SkyBox local state` + `.skybox/*` if not already present. If no `.gitignore` exists, create one.
- **Self-healing**: Runs on every `new`/`push`/`up`, so if a user accidentally removes the entry, it gets re-added on next use.
- **Non-fatal**: If the gitignore write fails, log a warning but don't block the operation.
- **No untracking**: If `.skybox/` is already committed, the user handles that themselves. We just prevent future tracking.

## Implementation Steps

### Step 1: Add `ensureGitignoreSkybox` to `src/lib/remote.ts`

Function signature:

```typescript
export const ensureGitignoreSkybox = async (
  host: string,
  projectPath: string,
): Promise<{ success: boolean; action?: "created" | "appended" | "exists" }>
```

Single SSH command that:
1. Checks if `.gitignore` exists at `projectPath`
2. If it exists, checks if `.skybox/*` is already present (grep)
3. If already present → return `{ success: true, action: "exists" }`
4. If `.gitignore` exists but missing entry → append `\n# SkyBox local state\n.skybox/*\n`
5. If no `.gitignore` → create with `# SkyBox local state\n.skybox/*\n`

Use `escapeRemotePath` for path safety, consistent with existing SSH patterns.

### Step 2: Integrate into `skybox new` (`src/commands/new.ts`)

Call `ensureGitignoreSkybox(host, remotePath)` **after** writing devcontainer.json but **before** `git init`. This ensures the initial commit includes the `.gitignore` rule.

### Step 3: Integrate into `skybox push` (`src/commands/push.ts`)

Call `ensureGitignoreSkybox(host, remotePath)` **after** `setOwnership()` (line ~256), before `offerStartContainer()`. At this point the remote directory exists and `.skybox/state.lock` has been written.

### Step 4: Integrate into `skybox up` (`src/commands/up.ts`)

Call `ensureGitignoreSkybox(host, remotePath)` as a self-healing check after sync is resumed. This catches projects that were set up before this feature existed.

### Step 5: Add tests

Add tests for `ensureGitignoreSkybox` covering:
- Creates `.gitignore` when none exists
- Appends to existing `.gitignore` when entry is missing
- No-ops when `.skybox/*` is already present
- Handles failure gracefully (returns `{ success: false }`)

### Step 6: Update docs

**`docs/guide/concepts.md`** — Update the "Project Structure" tree to include `.gitignore` and add a note that SkyBox automatically ensures `.skybox/*` is git-ignored.

**`docs/reference/new.md`** — Mention that `skybox new` creates a `.gitignore` (or appends to existing) with `.skybox/*` before initializing git.

**`docs/reference/push.md`** — Mention that `skybox push` ensures `.skybox/*` is in `.gitignore` on the remote.

**`docs/reference/up.md`** — Mention the self-healing gitignore check.

### Step 7: Update changelog

Add to `CHANGELOG.md` under `[Unreleased]` → `### Added`:

```
- Automatically add `.skybox/*` to `.gitignore` on the remote during `new`, `push`, and `up` to prevent state files from being tracked by git.
```
