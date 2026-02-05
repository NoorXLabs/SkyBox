# Lock TTL, Browse Locks & Locks Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add lock expiry (TTL), lock status to `skybox browse`, and a `skybox locks` command for cross-project lock overview.

**Architecture:** Extend `LockInfo` with an `expires` field set on acquire. `getLockStatus()` treats expired locks as unlocked. Browse and locks commands reuse `getLockStatus()` via a new `getAllLockStatuses()` helper that reads all `.skybox-locks/*.lock` files in a single SSH call.

**Tech Stack:** TypeScript, Commander.js, Bun test runner, SSH remote commands

---

## Task 1: Add `expires` field to `LockInfo` and constant for default TTL

**Files:**
- Modify: `src/types/index.ts:277-282` (LockInfo interface)
- Modify: `src/lib/constants.ts` (add TTL constant)

**Step 1: Add `expires` field to LockInfo type**

In `src/types/index.ts`, add `expires` as an optional field to `LockInfo`:

```typescript
export interface LockInfo {
	machine: string;
	user: string;
	timestamp: string;
	pid: number;
	expires?: string; // ISO 8601 datetime — lock is stale after this time
}
```

It's optional for backward compatibility with existing lock files that lack the field.

**Step 2: Add TTL constant**

In `src/lib/constants.ts`, add after the `LOCKS_DIR_NAME` constant:

```typescript
/** Default lock TTL in milliseconds (24 hours). */
export const LOCK_TTL_MS = 24 * 60 * 60 * 1000;
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (optional field is backward-compatible)

**Step 4: Commit**

```bash
git add src/types/index.ts src/lib/constants.ts
git commit -m "feat: add expires field to LockInfo and LOCK_TTL_MS constant"
```

---

## Task 2: Set `expires` on lock creation, check it in `getLockStatus()`

**Files:**
- Modify: `src/lib/lock.ts:77-84` (createLockInfo)
- Modify: `src/lib/lock.ts:49-72` (getLockStatus)
- Test: `src/lib/__tests__/lock.test.ts`

**Step 1: Write failing tests for expired lock behavior**

Add to `src/lib/__tests__/lock.test.ts` inside the `getLockStatus` describe block:

```typescript
test("returns locked: false when lock has expired", async () => {
	const lockInfo: LockInfo = {
		machine: "other-machine",
		user: "otheruser",
		timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
		pid: 12345,
		expires: new Date(Date.now() - 1000).toISOString(), // expired 1 second ago
	};

	mockRunRemoteCommand.mockResolvedValueOnce({
		success: true,
		stdout: JSON.stringify(lockInfo),
	});

	const status = await getLockStatus("myproject", testRemoteInfo);

	expect(status.locked).toBe(false);
});

test("returns locked: true when lock has not expired", async () => {
	const lockInfo: LockInfo = {
		machine: "other-machine",
		user: "otheruser",
		timestamp: new Date().toISOString(),
		pid: 12345,
		expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
	};

	mockRunRemoteCommand.mockResolvedValueOnce({
		success: true,
		stdout: JSON.stringify(lockInfo),
	});

	const status = await getLockStatus("myproject", testRemoteInfo);

	expect(status.locked).toBe(true);
	if (status.locked) {
		expect(status.ownedByMe).toBe(false);
	}
});

test("returns locked: true when lock has no expires field (backward compat)", async () => {
	const lockInfo: LockInfo = {
		machine: "other-machine",
		user: "otheruser",
		timestamp: new Date().toISOString(),
		pid: 12345,
		// no expires field
	};

	mockRunRemoteCommand.mockResolvedValueOnce({
		success: true,
		stdout: JSON.stringify(lockInfo),
	});

	const status = await getLockStatus("myproject", testRemoteInfo);

	expect(status.locked).toBe(true);
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/lib/__tests__/lock.test.ts`
Expected: The "expired" test should FAIL (currently returns locked: true for expired locks)

**Step 3: Update `createLockInfo()` to set `expires`**

In `src/lib/lock.ts`, update `createLockInfo()`:

```typescript
import { LOCK_TTL_MS } from "@lib/constants.ts";

function createLockInfo(): LockInfo {
	return {
		machine: getMachineName(),
		user: userInfo().username,
		timestamp: new Date().toISOString(),
		pid: process.pid,
		expires: new Date(Date.now() + LOCK_TTL_MS).toISOString(),
	};
}
```

**Step 4: Update `getLockStatus()` to check expiry**

In `src/lib/lock.ts`, update `getLockStatus()`. After parsing the JSON, before returning locked status, add an expiry check:

```typescript
export async function getLockStatus(
	project: string,
	remoteInfo: LockRemoteInfo,
): Promise<LockStatus> {
	const lockPath = getLockPath(project, remoteInfo.basePath);
	const command = `cat ${escapeShellArg(lockPath)} 2>/dev/null`;

	const result = await runRemoteCommand(remoteInfo.host, command);

	if (!result.success || !result.stdout || result.stdout.trim() === "") {
		return { locked: false };
	}

	try {
		const info: LockInfo = JSON.parse(result.stdout);

		// Check if lock has expired
		if (info.expires && new Date(info.expires).getTime() < Date.now()) {
			return { locked: false };
		}

		const currentMachine = getMachineName();
		const ownedByMe = info.machine === currentMachine;

		return { locked: true, ownedByMe, info };
	} catch {
		// Invalid JSON in lock file, treat as unlocked
		return { locked: false };
	}
}
```

**Step 5: Run tests**

Run: `bun test src/lib/__tests__/lock.test.ts`
Expected: ALL PASS

**Step 6: Run full suite**

Run: `bun run typecheck && bun test`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add src/lib/lock.ts src/lib/__tests__/lock.test.ts
git commit -m "feat: add lock TTL — expired locks treated as unlocked"
```

---

## Task 3: Add lock status column to `skybox browse`

**Files:**
- Modify: `src/lib/lock.ts` (add `getAllLockStatuses()` helper)
- Modify: `src/commands/browse.ts`
- Test: `src/lib/__tests__/lock.test.ts`

**Step 1: Write failing test for `getAllLockStatuses()`**

Add a new describe block to `src/lib/__tests__/lock.test.ts`. First, add the import:

```typescript
import {
	acquireLock,
	forceLock,
	getAllLockStatuses,
	getLockStatus,
	getMachineName,
	type LockRemoteInfo,
	releaseLock,
} from "@lib/lock.ts";
```

Then add the test:

```typescript
describe("getAllLockStatuses", () => {
	test("parses multiple lock files from single SSH call", async () => {
		const lockInfo1: LockInfo = {
			machine: hostname(),
			user: userInfo().username,
			timestamp: new Date().toISOString(),
			pid: 12345,
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};
		const lockInfo2: LockInfo = {
			machine: "other-machine",
			user: "otheruser",
			timestamp: new Date().toISOString(),
			pid: 99999,
			expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		};

		// SSH returns newline-delimited "filename\tJSON" lines
		const output = [
			`backend-api.lock\t${JSON.stringify(lockInfo1)}`,
			`frontend-app.lock\t${JSON.stringify(lockInfo2)}`,
		].join("\n");

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: output,
		});

		const statuses = await getAllLockStatuses(testRemoteInfo);

		expect(statuses.size).toBe(2);
		const backend = statuses.get("backend-api");
		expect(backend?.locked).toBe(true);
		if (backend?.locked) {
			expect(backend.ownedByMe).toBe(true);
		}
		const frontend = statuses.get("frontend-app");
		expect(frontend?.locked).toBe(true);
		if (frontend?.locked) {
			expect(frontend.ownedByMe).toBe(false);
		}
	});

	test("returns empty map when no lock files exist", async () => {
		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: "",
		});

		const statuses = await getAllLockStatuses(testRemoteInfo);

		expect(statuses.size).toBe(0);
	});

	test("skips expired locks", async () => {
		const expiredLock: LockInfo = {
			machine: "other-machine",
			user: "otheruser",
			timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
			pid: 12345,
			expires: new Date(Date.now() - 1000).toISOString(),
		};

		mockRunRemoteCommand.mockResolvedValueOnce({
			success: true,
			stdout: `myproject.lock\t${JSON.stringify(expiredLock)}`,
		});

		const statuses = await getAllLockStatuses(testRemoteInfo);

		const status = statuses.get("myproject");
		expect(status?.locked).toBe(false);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/lock.test.ts`
Expected: FAIL (getAllLockStatuses doesn't exist yet)

**Step 3: Implement `getAllLockStatuses()`**

Add to `src/lib/lock.ts` (export the function):

```typescript
/**
 * Fetch lock statuses for all projects on a remote in a single SSH call.
 * Returns a Map of project name -> LockStatus.
 */
export async function getAllLockStatuses(
	remoteInfo: LockRemoteInfo,
): Promise<Map<string, LockStatus>> {
	const locksDir = getLocksDir(remoteInfo.basePath);
	// For each .lock file, print "filename\tcontents" on one line
	const command = `for f in ${escapeShellArg(locksDir)}/*.lock; do [ -f "$f" ] && echo "$(basename "$f")\t$(cat "$f")"; done 2>/dev/null`;

	const result = await runRemoteCommand(remoteInfo.host, command);
	const statuses = new Map<string, LockStatus>();

	if (!result.success || !result.stdout?.trim()) {
		return statuses;
	}

	const currentMachine = getMachineName();

	for (const line of result.stdout.trim().split("\n")) {
		const tabIndex = line.indexOf("\t");
		if (tabIndex === -1) continue;

		const filename = line.substring(0, tabIndex);
		const jsonStr = line.substring(tabIndex + 1);

		// Strip .lock extension to get project name
		const project = filename.replace(/\.lock$/, "");

		try {
			const info: LockInfo = JSON.parse(jsonStr);

			// Check expiry
			if (info.expires && new Date(info.expires).getTime() < Date.now()) {
				statuses.set(project, { locked: false });
				continue;
			}

			const ownedByMe = info.machine === currentMachine;
			statuses.set(project, { locked: true, ownedByMe, info });
		} catch {
			statuses.set(project, { locked: false });
		}
	}

	return statuses;
}
```

**Step 4: Run tests**

Run: `bun test src/lib/__tests__/lock.test.ts`
Expected: ALL PASS

**Step 5: Update `browse.ts` to show lock column**

Replace the browse command implementation. Key changes:
1. Import `createLockRemoteInfo` and `getAllLockStatuses` from `@lib/lock.ts`
2. After fetching projects, fetch all lock statuses in one call
3. Update `printProjects()` to show a LOCK column

Updated `src/commands/browse.ts`:

```typescript
// src/commands/browse.ts

import { getRemoteHost, selectRemote } from "@commands/remote.ts";
import { configExists, loadConfig } from "@lib/config.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { createLockRemoteInfo, getAllLockStatuses } from "@lib/lock.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import { error, header, info, spinner } from "@lib/ui.ts";
import type { LockStatus, RemoteProject } from "@typedefs/index.ts";
import chalk from "chalk";

async function getRemoteProjects(
	host: string,
	basePath: string,
): Promise<RemoteProject[]> {
	const script = `for d in "${basePath}"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    branch=$(git -C "$d" branch --show-current 2>/dev/null || echo "-")
    echo "$name|$branch"
  done`;

	const result = await runRemoteCommand(host, script);

	if (!result.success || !result.stdout?.trim()) {
		return [];
	}

	return result.stdout
		.trim()
		.split("\n")
		.filter((line) => line.includes("|"))
		.map((line) => {
			const [name, branch] = line.split("|");
			return { name, branch };
		});
}

function formatLockColumn(lockStatus: LockStatus | undefined): string {
	if (!lockStatus || !lockStatus.locked) {
		return chalk.dim("unlocked");
	}
	if (lockStatus.ownedByMe) {
		return chalk.yellow("locked (you)");
	}
	return chalk.red(`locked (${lockStatus.info.machine})`);
}

function printProjects(
	projects: RemoteProject[],
	lockStatuses: Map<string, LockStatus>,
	host: string,
	basePath: string,
): void {
	header(`Remote projects (${host}:${basePath}):`);
	console.log();

	// Calculate column widths
	const nameWidth = Math.max(
		4,
		...projects.map((p) => p.name.length),
	);
	const branchWidth = Math.max(
		6,
		...projects.map((p) => p.branch.length),
	);

	// Header
	const headerRow = `  ${"NAME".padEnd(nameWidth)}  ${"BRANCH".padEnd(branchWidth)}  LOCK`;
	console.log(chalk.dim(headerRow));

	// Rows
	for (const project of projects) {
		const lock = formatLockColumn(lockStatuses.get(project.name));
		const row = `  ${project.name.padEnd(nameWidth)}  ${project.branch.padEnd(branchWidth)}  ${lock}`;
		console.log(row);
	}

	console.log();
	info("Run 'skybox clone <project>' to clone a project locally.");
}

function printEmpty(): void {
	console.log();
	console.log("No projects found on remote.");
	info("Run 'skybox push ./my-project' to push your first project.");
}

export async function browseCommand(): Promise<void> {
	if (!configExists()) {
		error("skybox not configured. Run 'skybox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	// Select which remote to browse
	const remoteName = await selectRemote(config);
	const remote = config.remotes[remoteName];
	const host = getRemoteHost(remote);

	const spin = spinner(`Fetching projects from ${remoteName}...`);

	try {
		const remoteInfo = createLockRemoteInfo(remote);
		const [projects, lockStatuses] = await Promise.all([
			getRemoteProjects(host, remote.path),
			getAllLockStatuses(remoteInfo),
		]);
		spin.stop();

		if (projects.length === 0) {
			printEmpty();
		} else {
			printProjects(projects, lockStatuses, host, remote.path);
		}
	} catch (err: unknown) {
		spin.fail("Failed to connect to remote");
		error(getErrorMessage(err) || "Check your SSH config.");
		process.exit(1);
	}
}
```

**Step 6: Run typecheck and tests**

Run: `bun run typecheck && bun test`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add src/lib/lock.ts src/lib/__tests__/lock.test.ts src/commands/browse.ts
git commit -m "feat: add lock status column to skybox browse"
```

---

## Task 4: Add `skybox locks` command

**Files:**
- Create: `src/commands/locks.ts`
- Modify: `src/index.ts` (register command)
- Test: No unit test needed — this is a thin wrapper over `getAllLockStatuses()` which is already tested

**Step 1: Create `src/commands/locks.ts`**

```typescript
// src/commands/locks.ts

import { getRemoteHost, selectRemote } from "@commands/remote.ts";
import { configExists, loadConfig } from "@lib/config.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { createLockRemoteInfo, getAllLockStatuses } from "@lib/lock.ts";
import { error, header, info, spinner } from "@lib/ui.ts";
import type { LockStatus } from "@typedefs/index.ts";
import chalk from "chalk";

function formatLockRow(project: string, status: LockStatus): string {
	if (!status.locked) {
		return `  ${project.padEnd(30)}  ${chalk.dim("unlocked")}`;
	}
	if (status.ownedByMe) {
		return `  ${project.padEnd(30)}  ${chalk.yellow("locked (you)")}  ${chalk.dim(status.info.timestamp)}`;
	}
	return `  ${project.padEnd(30)}  ${chalk.red(`locked (${status.info.machine})`)}  ${chalk.dim(status.info.timestamp)}`;
}

export async function locksCommand(): Promise<void> {
	if (!configExists()) {
		error("skybox not configured. Run 'skybox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	const remoteName = await selectRemote(config);
	const remote = config.remotes[remoteName];
	const host = getRemoteHost(remote);
	const remoteInfo = createLockRemoteInfo(remote);

	const spin = spinner(`Checking locks on ${remoteName}...`);

	try {
		const statuses = await getAllLockStatuses(remoteInfo);
		spin.stop();

		if (statuses.size === 0) {
			console.log();
			console.log("No lock files found on remote.");
			info("Locks are created when someone runs 'skybox up'.");
			return;
		}

		header(`Locks on ${host}:`);
		console.log();
		console.log(chalk.dim(`  ${"PROJECT".padEnd(30)}  ${"STATUS".padEnd(25)}  SINCE`));

		// Show locked projects first, then unlocked
		const locked: [string, LockStatus][] = [];
		const unlocked: [string, LockStatus][] = [];
		for (const [project, status] of statuses) {
			if (status.locked) {
				locked.push([project, status]);
			} else {
				unlocked.push([project, status]);
			}
		}

		for (const [project, status] of [...locked, ...unlocked]) {
			console.log(formatLockRow(project, status));
		}
		console.log();
	} catch (err: unknown) {
		spin.fail("Failed to connect to remote");
		error(getErrorMessage(err) || "Check your SSH config.");
		process.exit(1);
	}
}
```

**Step 2: Register in `src/index.ts`**

Add import at the top with the other command imports:

```typescript
import { locksCommand } from "@commands/locks.ts";
```

Add command registration after the `browse` command:

```typescript
program
	.command("locks")
	.description("Show lock status for all remote projects")
	.action(locksCommand);
```

**Step 3: Run typecheck and tests**

Run: `bun run typecheck && bun test`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/commands/locks.ts src/index.ts
git commit -m "feat: add skybox locks command for cross-project lock overview"
```

---

## Task 5: Update documentation

**Files:**
- Modify: `docs/guide/workflows/team-sharing.md`

**Step 1: Add lock TTL section to team-sharing.md**

After the "Stale Lock After Crash" troubleshooting section, add:

```markdown
### Lock Expiry (TTL)

Locks automatically expire after 24 hours. If a machine crashes without running `skybox down`, the lock becomes stale and other developers can acquire it without a takeover prompt.

To check if a lock is stale, run:

```bash
skybox status backend-api
```

Expired locks are treated as unlocked — no manual intervention needed.
```

**Step 2: Add `skybox locks` to the communication patterns section**

After the "Quick Status Check" subsection, add:

```markdown
### Cross-Project Lock Overview

See all locks across projects on a remote:

```bash
skybox locks
```

```
Locks on team-server:

  PROJECT                         STATUS                     SINCE
  backend-api                     locked (alices-macbook)    2024-01-15T09:00:00Z
  frontend-app                    unlocked
```

The `skybox browse` command also shows a LOCK column for each remote project.
```

**Step 3: Commit**

```bash
git add docs/guide/workflows/team-sharing.md
git commit -m "docs: add lock TTL and skybox locks command documentation"
```

---

## Task 6: Final verification

**Step 1: Run full check suite**

Run: `bun run check && bun run typecheck && bun test`
Expected: ALL PASS

---

## Documentation Updates Required

| File | Change |
|------|--------|
| `docs/guide/workflows/team-sharing.md` | Add lock TTL info, `skybox locks` command, note about browse showing locks |
| `CHANGELOG.md` | Document lock TTL, browse lock column, locks command (at release time) |
