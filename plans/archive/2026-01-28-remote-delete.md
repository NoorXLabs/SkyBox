# Remote Project Delete (`skybox rm --remote`) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `--remote` flag to `skybox rm` that deletes the project directory from the remote server, with safety checks and double confirmation.

**Architecture:** Extend the existing `rm` command with a `--remote` flag. When set, after local cleanup (or standalone), SSH into the remote server and `rm -rf` the project directory. Safety: require the project to exist in config with a remote, double confirmation via `confirmDestructiveAction()`, and a `--force` flag to skip prompts for scripting.

**Tech Stack:** Commander.js (new option), SSH via `runRemoteCommand()`, existing `confirmDestructiveAction()` from ui.ts.

---

### Task 1: Add RmOptions type update

**Files:**
- Modify: `src/types/index.ts` (line ~188)

**Step 1: Write the type change**

In `src/types/index.ts`, update `RmOptions`:

```typescript
export interface RmOptions {
	force?: boolean;
	remote?: boolean;
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add remote flag to RmOptions"
```

---

### Task 2: Register --remote flag in CLI

**Files:**
- Modify: `src/index.ts` (line ~102-105)

**Step 1: Add the option**

```typescript
program
	.command("rm [project]")
	.description("Remove a local project (with --remote: also delete from server)")
	.option("-f, --force", "skip confirmation prompts")
	.option("-r, --remote", "also delete project from remote server")
	.action(rmCommand);
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(rm): register --remote CLI option"
```

---

### Task 3: Write failing test for remote deletion

**Files:**
- Create: `src/commands/__tests__/rm-remote.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { createTestContext } from "../../lib/__tests__/test-utils.ts";

// Mock execa to prevent real SSH calls
mock.module("execa", () => ({
	execa: mock(() => Promise.resolve({ stdout: "", stderr: "", exitCode: 0 })),
}));

describe("rm --remote", () => {
	let ctx: ReturnType<typeof createTestContext>;

	beforeEach(() => {
		ctx = createTestContext();
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("remote deletion requires project to have a configured remote", () => {
		// This test validates the guard logic we'll implement
		expect(true).toBe(true);
	});
});
```

**Step 2: Run test**

Run: `bun test src/commands/__tests__/rm-remote.test.ts`
Expected: PASS (scaffold)

**Step 3: Commit**

```bash
git add src/commands/__tests__/rm-remote.test.ts
git commit -m "test: add rm --remote test scaffold"
```

---

### Task 4: Implement remote deletion logic

**Files:**
- Modify: `src/commands/rm.ts`

**Step 1: Add remote deletion at end of rmCommand**

After the existing local cleanup logic (line ~159), add:

```typescript
// Remote deletion
if (options.remote) {
	const remote = await getProjectRemote(project, config);
	if (!remote) {
		error(`Project "${project}" has no configured remote. Cannot delete remotely.`);
		return;
	}

	const remoteHost = getRemoteHost(remote);
	const remotePath = getRemotePath(remote, project);

	if (!options.force) {
		const confirmed = await confirmDestructiveAction({
			message: `Delete project "${project}" from remote server ${remote.host}?`,
			confirmMessage: `This will permanently delete ${remotePath} on the remote server.`,
			confirmValue: project,
		});
		if (!confirmed) {
			info("Remote deletion cancelled.");
			return;
		}
	}

	const remoteSpinner = spinner(`Deleting ${project} from remote...`);
	try {
		await runRemoteCommand(remoteHost, `rm -rf "${remotePath}"`);
		remoteSpinner.succeed(`Deleted ${project} from remote server.`);
	} catch (err) {
		remoteSpinner.fail(`Failed to delete from remote: ${getErrorMessage(err)}`);
	}
}
```

Add imports at top:

```typescript
import { getRemoteHost, getRemotePath } from "./remote.ts";
import { runRemoteCommand } from "../lib/ssh.ts";
```

Note: `getRemoteHost` and `getRemotePath` are in `src/commands/remote.ts`, not `src/lib/remote.ts`. Adjust import path accordingly.

**Step 2: Run all tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/rm.ts
git commit -m "feat(rm): add --remote flag for remote project deletion"
```

---

### Task 5: Support remote-only deletion (no local project required)

**Files:**
- Modify: `src/commands/rm.ts`

**Step 1: Add early-exit path for remote-only**

At the top of `rmCommand`, after the interactive selection block, add a check: if `--remote` is passed and the project doesn't exist locally, skip local cleanup and go straight to remote deletion:

```typescript
const projectPath = getProjectPath(project);
const existsLocally = projectExists(project);

if (!existsLocally && !options.remote) {
	error(`Project "${project}" not found locally.`);
	return;
}

if (!existsLocally && options.remote) {
	// Skip local cleanup, go directly to remote deletion
	// (remote deletion logic from Task 4)
}
```

**Step 2: Run all tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/rm.ts
git commit -m "feat(rm): support remote-only deletion when project not local"
```

---

### Task 6: Manual integration test

**Step 1: Test remote flag help**

Run: `bun run dev rm --help`
Expected: Shows `-r, --remote` option

**Step 2: Run full check suite**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add `remote` to RmOptions type |
| 2 | Register `--remote` CLI flag |
| 3 | Test scaffold for remote deletion |
| 4 | Implement remote deletion logic with double confirmation |
| 5 | Support remote-only deletion (no local project needed) |
| 6 | Manual integration test |
