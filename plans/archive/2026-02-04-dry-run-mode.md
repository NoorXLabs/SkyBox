# Dry Run Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global `--dry-run` flag that previews what commands would execute without performing any side effects.

**Architecture:** A global Commander.js option parsed in `src/index.ts` and passed through to command handlers. Each command with side effects checks `program.opts().dryRun` and prints what it _would_ do via `info()` instead of executing. Read-only commands (`status`, `list`, `browse`, `logs`, `dashboard`, `doctor`) are unaffected.

**Tech Stack:** Commander.js (global option), existing `info()` from `src/lib/ui.ts`, Bun test runner.

---

### Task 1: Add `dryRun` to the `info()` output helper

We need a small `dryRun()` helper in `src/lib/ui.ts` so dry-run messages have a consistent, distinguishable prefix. This keeps the pattern DRY across all command files.

**Files:**
- Modify: `src/lib/ui.ts`
- Test: `src/lib/__tests__/ui.test.ts` (create)

**Step 1: Write the failing test**

Create `src/lib/__tests__/ui.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { dryRun } from "@lib/ui.ts";

describe("dryRun output helper", () => {
	let output: string[];
	const originalLog = console.log;

	beforeEach(() => {
		output = [];
		console.log = (...args: unknown[]) => {
			output.push(args.map(String).join(" "));
		};
	});

	afterEach(() => {
		console.log = originalLog;
	});

	test("prints message with [dry-run] prefix", () => {
		dryRun("Would start container at /path/to/project");
		expect(output.length).toBe(1);
		expect(output[0]).toContain("[dry-run]");
		expect(output[0]).toContain("Would start container at /path/to/project");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/ui.test.ts`
Expected: FAIL — `dryRun` is not exported from `@lib/ui.ts`

**Step 3: Write minimal implementation**

In `src/lib/ui.ts`, add after the existing `info()` function (after line 20):

```typescript
export function dryRun(message: string): void {
	console.log(chalk.dim("  ⏭"), chalk.dim(`[dry-run] ${message}`));
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/ui.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ui.ts src/lib/__tests__/ui.test.ts
git commit -m "feat: add dryRun() output helper to ui.ts"
```

---

### Task 2: Add global `--dry-run` option to Commander.js

Register the global flag on the `program` object so every command inherits it.

**Files:**
- Modify: `src/index.ts:42-45`

**Step 1: Write the failing test**

Create `src/commands/__tests__/dry-run-global.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { program } from "commander";

describe("global --dry-run option", () => {
	test("program accepts --dry-run flag", () => {
		// Commander.js stores options on the program object
		// We verify the option is registered by checking program.options
		const optionNames = program.options.map((o) => o.long);
		expect(optionNames).toContain("--dry-run");
	});
});
```

Note: This test imports the `program` from Commander.js which is configured in `src/index.ts`. Since `src/index.ts` is the entry point that adds the option, this test works by importing after the module initializes.

Actually, a simpler approach: test via CLI invocation.

```typescript
import { describe, expect, test } from "bun:test";

describe("global --dry-run option", () => {
	test("--dry-run flag is accepted by CLI", async () => {
		const { execSync } = await import("node:child_process");
		// Run `skybox --help` and check that --dry-run appears
		const output = execSync("bun run src/index.ts --help", {
			encoding: "utf-8",
			cwd: "/Users/noorchasib/conductor/workspaces/SkyBox/dhaka-v1",
		});
		expect(output).toContain("--dry-run");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/commands/__tests__/dry-run-global.test.ts`
Expected: FAIL — `--dry-run` not in help output

**Step 3: Write minimal implementation**

In `src/index.ts`, add the global option right after the `.version()` line. Change lines 42-45 from:

```typescript
program
	.name("skybox")
	.description("Local-first dev containers with remote sync")
	.version(pkg.version, "-v, --version");
```

to:

```typescript
program
	.name("skybox")
	.description("Local-first dev containers with remote sync")
	.version(pkg.version, "-v, --version")
	.option("--dry-run", "Preview commands without executing them");
```

**Step 4: Run test to verify it passes**

Run: `bun test src/commands/__tests__/dry-run-global.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/index.ts src/commands/__tests__/dry-run-global.test.ts
git commit -m "feat: add global --dry-run option to CLI"
```

---

### Task 3: Create `isDryRun()` utility function

A single helper that reads the global option from Commander.js. This avoids every command needing to import and call `program.opts()` directly.

**Files:**
- Modify: `src/lib/ui.ts`
- Test: `src/lib/__tests__/ui.test.ts` (update)

**Step 1: Write the failing test**

Add to `src/lib/__tests__/ui.test.ts`:

```typescript
import { isDryRun } from "@lib/ui.ts";

describe("isDryRun utility", () => {
	test("returns false by default", () => {
		// Without --dry-run flag, should return false
		expect(isDryRun()).toBe(false);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/ui.test.ts`
Expected: FAIL — `isDryRun` is not exported

**Step 3: Write minimal implementation**

In `src/lib/ui.ts`, add at the bottom:

```typescript
import { program } from "commander";

export function isDryRun(): boolean {
	return program.opts().dryRun === true;
}
```

Note: Move the `import { program } from "commander"` to the top of the file with the other imports.

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/ui.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ui.ts src/lib/__tests__/ui.test.ts
git commit -m "feat: add isDryRun() utility to read global flag"
```

---

### Task 4: Add dry-run to `up` command

The `up` command is the most complex. In dry-run mode, it should:
- Print what it would do (write session, start container, resume sync, run hooks)
- NOT actually execute any of those operations

**Files:**
- Modify: `src/commands/up.ts`

**Step 1: Write the failing test**

Add to `src/commands/__tests__/dry-run-global.test.ts`:

```typescript
test("up --dry-run shows preview without side effects", async () => {
	const { execSync } = await import("node:child_process");
	// This will fail because no project exists, but the point is
	// --dry-run is accepted without error as a flag
	try {
		execSync("bun run src/index.ts up test-project --dry-run --no-prompt 2>&1", {
			encoding: "utf-8",
			cwd: "/Users/noorchasib/conductor/workspaces/SkyBox/dhaka-v1",
		});
	} catch (err: any) {
		// Should fail for "not configured" or "not found" reasons,
		// NOT for "unknown option --dry-run"
		expect(err.stdout + err.stderr).not.toContain("unknown option");
	}
});
```

**Step 2: Run test to verify it passes**

Run: `bun test src/commands/__tests__/dry-run-global.test.ts`
Expected: PASS (global option already registered in Task 2)

**Step 3: Add dry-run guards to `startSingleProject`**

In `src/commands/up.ts`, import the helpers at the top:

```typescript
import { dryRun, isDryRun } from "@lib/ui.ts";
```

(Add `dryRun` and `isDryRun` to the existing import from `@lib/ui.ts`.)

Then modify `startSingleProject()` (around line 542). Add a dry-run early return after the header:

```typescript
async function startSingleProject(
	project: string,
	projectPath: string,
	config: SkyboxConfigV2,
	options: UpOptions,
): Promise<void> {
	header(`Starting '${project}'...`);

	if (isDryRun()) {
		const projectConfig = config.projects[project];
		if (projectConfig?.hooks) {
			dryRun(`Would run pre-up hooks for '${project}'`);
		}
		dryRun(`Would write session file at ${projectPath}`);
		dryRun(`Would check and resume sync for '${project}'`);
		dryRun(`Would start container at ${projectPath}`);
		if (projectConfig?.hooks) {
			dryRun(`Would run post-up hooks for '${project}'`);
		}
		return;
	}

	// ... rest of existing code unchanged ...
```

Also guard `handlePostStart` — add at the top of the function:

```typescript
async function handlePostStart(
	projectPath: string,
	config: SkyboxConfigV2,
	options: UpOptions,
): Promise<void> {
	if (isDryRun()) {
		dryRun("Would prompt for post-start action (editor/shell)");
		return;
	}
	// ... rest unchanged ...
```

**Step 4: Run full test suite**

Run: `bun test`
Expected: All existing tests pass. No regressions.

**Step 5: Commit**

```bash
git add src/commands/up.ts
git commit -m "feat: add dry-run support to up command"
```

---

### Task 5: Add dry-run to `down` command

In dry-run mode, `down` should print what it would stop/pause/delete without executing.

**Files:**
- Modify: `src/commands/down.ts`

**Step 1: No new test needed** — the global flag test from Task 2 covers acceptance. Integration behavior is validated manually.

**Step 2: Add dry-run guards**

In `src/commands/down.ts`, add to the existing `@lib/ui.ts` import:

```typescript
import { dryRun, isDryRun } from "@lib/ui.ts";
```

(Add `dryRun` and `isDryRun` to the existing import.)

Then, in `downCommand()` after resolving the project and printing the header (after line 236 `header(...)`), add:

```typescript
	header(`Stopping '${project}'...`);

	if (isDryRun()) {
		const projectConfig = config.projects[project ?? ""];
		if (projectConfig?.hooks) {
			dryRun(`Would run pre-down hooks for '${project}'`);
		}
		dryRun(`Would flush pending sync for '${project}'`);
		dryRun(`Would stop container at ${projectPath}`);
		if (projectConfig?.encryption?.enabled) {
			dryRun(`Would encrypt project on remote`);
		}
		dryRun(`Would delete session file at ${projectPath}`);
		if (projectConfig?.hooks) {
			dryRun(`Would run post-down hooks for '${project}'`);
		}
		return;
	}

	// Run pre-down hooks
	// ... rest of existing code unchanged ...
```

**Step 3: Run full test suite**

Run: `bun test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/down.ts
git commit -m "feat: add dry-run support to down command"
```

---

### Task 6: Add dry-run to `clone` command

In dry-run mode, `clone` should show what directories and sync sessions it would create.

**Files:**
- Modify: `src/commands/clone.ts`

**Step 1: Add dry-run guards**

In `src/commands/clone.ts`, add `dryRun` and `isDryRun` to the `@lib/ui.ts` import.

In `cloneSingleProject()`, after checking the remote project exists and before checking if local exists (after `checkSpin.succeed`), add:

```typescript
	checkSpin.succeed("Project found on remote");

	const localPath = join(getProjectsDir(), project);

	if (isDryRun()) {
		if (existsSync(localPath)) {
			dryRun(`Would remove existing local directory: ${localPath}`);
		}
		dryRun(`Would create local directory: ${localPath}`);
		dryRun(`Would create sync session: ${host}:${remotePath} <-> ${localPath}`);
		dryRun(`Would register project '${project}' in config`);
		return true;
	}

	// Check local doesn't exist
	if (existsSync(localPath)) {
	// ... rest unchanged ...
```

**Step 2: Run full test suite**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/clone.ts
git commit -m "feat: add dry-run support to clone command"
```

---

### Task 7: Add dry-run to `push` command

In dry-run mode, `push` should show what it would copy, sync, and register.

**Files:**
- Modify: `src/commands/push.ts`

**Step 1: Add dry-run guards**

In `src/commands/push.ts`, add `dryRun` and `isDryRun` to the `@lib/ui.ts` import.

After the header line and before checking git repo, add:

```typescript
	header(`Pushing '${projectName}' to ${host}:${remotePath}...`);

	if (isDryRun()) {
		if (!(await isGitRepo(absolutePath))) {
			dryRun("Would initialize git repository");
		}
		dryRun(`Would check if project exists on remote`);
		dryRun(`Would create remote directory: ${host}:${remotePath}`);
		const localPath = join(getProjectsDir(), projectName);
		if (absolutePath !== localPath) {
			dryRun(`Would copy ${absolutePath} to ${localPath}`);
		}
		dryRun(`Would create sync session: ${localPath} <-> ${host}:${remotePath}`);
		dryRun(`Would register project '${projectName}' in config`);
		return;
	}

	// Check if git repo
	// ... rest unchanged ...
```

**Step 2: Run full test suite**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/push.ts
git commit -m "feat: add dry-run support to push command"
```

---

### Task 8: Add dry-run to `rm` command

In dry-run mode, `rm` should show what it would delete without deleting.

**Files:**
- Modify: `src/commands/rm.ts`

**Step 1: Add dry-run guards**

In `src/commands/rm.ts`, add `dryRun` and `isDryRun` to the `@lib/ui.ts` import.

After confirmation and the `header(...)` line (after line 125), add:

```typescript
	const projectPath = getProjectPath(project);
	header(`Removing '${project}'...`);

	if (isDryRun()) {
		dryRun(`Would clear session file for '${project}'`);
		const containerStatus = await getContainerStatus(projectPath);
		if (containerStatus === ContainerStatus.Running) {
			dryRun(`Would stop running container`);
		}
		if (containerStatus !== ContainerStatus.NotFound) {
			dryRun(`Would remove container and volumes`);
		}
		dryRun(`Would terminate sync session`);
		dryRun(`Would delete local files: ${projectPath}`);
		dryRun(`Would remove '${project}' from config`);
		if (options.remote) {
			dryRun(`Would delete project from remote server`);
		}
		return;
	}

	// Check session status and delete if present
	// ... rest unchanged ...
```

**Step 2: Run full test suite**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/rm.ts
git commit -m "feat: add dry-run support to rm command"
```

---

### Task 9: Add dry-run to `init` command

In dry-run mode, `init` should show what setup steps it would perform.

**Files:**
- Modify: `src/commands/init.ts`

**Step 1: Add dry-run guards**

In `src/commands/init.ts`, add `dryRun` and `isDryRun` to the `@lib/ui.ts` import.

In `initCommand()`, after the reconfiguration check and before `checkDependencies()` (around line 414), add:

```typescript
	if (isDryRun()) {
		dryRun("Would check dependencies (Docker, Node.js)");
		dryRun("Would download/install Mutagen binary");
		dryRun("Would configure remote server via SSH");
		dryRun("Would configure editor preference");
		dryRun(`Would create directories: ${getSkyboxHome()}`);
		dryRun("Would save config.yaml");
		return;
	}

	// Check dependencies
	const depsOk = await checkDependencies();
	// ... rest unchanged ...
```

**Step 2: Run full test suite**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat: add dry-run support to init command"
```

---

### Task 10: Add dry-run to `new` command

In dry-run mode, `new` should show what it would create on the remote.

**Files:**
- Modify: `src/commands/new.ts`

**Step 1: Add dry-run guards**

In `src/commands/new.ts`, add `dryRun` and `isDryRun` to the `@lib/ui.ts` import.

In `newCommand()`, after selecting the template and before acting on the selection (after line 88), add:

```typescript
	if (isDryRun()) {
		const remotePath = `${remote.path}/${projectName}`;
		if (selection.source === "git") {
			dryRun(`Would clone git template to ${host}:${remotePath}`);
		} else {
			dryRun(`Would create project directory on remote: ${host}:${remotePath}`);
			dryRun(`Would write devcontainer.json from template`);
			dryRun(`Would initialize git repo on remote`);
		}
		if (config.defaults.encryption) {
			dryRun("Would prompt for encryption configuration");
		}
		return;
	}

	if (selection.source === "git") {
	// ... rest unchanged ...
```

**Step 2: Run full test suite**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/new.ts
git commit -m "feat: add dry-run support to new command"
```

---

### Task 11: Add dry-run to `editor` and `config set` commands

These commands modify `config.yaml`. In dry-run mode, show what would change.

**Files:**
- Modify: `src/commands/editor.ts`
- Modify: `src/commands/config.ts`

**Step 1: Add dry-run to editor command**

In `src/commands/editor.ts`, add `dryRun` and `isDryRun` to the `@lib/ui.ts` import.

After the user selects an editor and before saving (before line 58 `config.editor = editor`), add:

```typescript
	if (isDryRun()) {
		dryRun(`Would change editor from '${config.editor}' to '${editor}'`);
		return;
	}

	config.editor = editor;
	saveConfig(config);
```

**Step 2: Add dry-run to config set command**

In `src/commands/config.ts`, add `dryRun` and `isDryRun` to the `@lib/ui.ts` import.

In `setConfigValue()`, before the actual save (before line 124 `config.editor = value`), add:

```typescript
	if (key === "editor") {
		if (isDryRun()) {
			dryRun(`Would set editor to '${value}'`);
			return;
		}
		config.editor = value;
		saveConfig(config);
```

Also in the `sync-paths` subcommand handler, before saving (around line 261/265):

```typescript
		if (isDryRun()) {
			if (paths.length === 0) {
				dryRun(`Would clear sync paths for '${arg1}'`);
			} else {
				dryRun(`Would set sync paths for '${arg1}': ${paths.join(", ")}`);
			}
			return;
		}

		if (paths.length === 0) {
		// ... rest unchanged ...
```

**Step 3: Run full test suite**

Run: `bun test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/editor.ts src/commands/config.ts
git commit -m "feat: add dry-run support to editor and config commands"
```

---

### Task 12: Add dry-run to `update` and `encrypt` commands

**Files:**
- Modify: `src/commands/update.ts`
- Modify: `src/commands/encrypt.ts`

**Step 1: Add dry-run to update command**

Read `src/commands/update.ts` first, then add `isDryRun`/`dryRun` import and guard at the top of the action:

```typescript
if (isDryRun()) {
	dryRun("Would download and install latest Mutagen binary");
	return;
}
```

**Step 2: Add dry-run to encrypt command**

Read `src/commands/encrypt.ts` first, then add guard at the top of the main action. The encrypt command has enable/disable subcommands:

```typescript
if (isDryRun()) {
	if (subcommand === "enable") {
		dryRun(`Would enable encryption for project '${project}'`);
	} else if (subcommand === "disable") {
		dryRun(`Would disable encryption for project '${project}'`);
	} else {
		dryRun("Would show encryption status");
	}
	return;
}
```

**Step 3: Run full test suite**

Run: `bun test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/update.ts src/commands/encrypt.ts
git commit -m "feat: add dry-run support to update and encrypt commands"
```

---

### Task 13: Write integration test for dry-run end-to-end

A proper integration test that verifies dry-run actually prevents side effects.

**Files:**
- Modify: `src/commands/__tests__/dry-run-global.test.ts`

**Step 1: Write the test**

Expand `src/commands/__tests__/dry-run-global.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	createTestConfig,
	createTestContext,
	createTestRemote,
	writeTestConfig,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";

describe("global --dry-run option", () => {
	test("--dry-run flag is accepted by CLI", async () => {
		const { execSync } = await import("node:child_process");
		const output = execSync("bun run src/index.ts --help", {
			encoding: "utf-8",
		});
		expect(output).toContain("--dry-run");
		expect(output).toContain("Preview commands without executing them");
	});
});

describe("dry-run prevents side effects", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("dry-run");
		// Set up a config so commands don't fail at config check
		const config = createTestConfig({
			remotes: { test: createTestRemote("test") },
			projects: { myapp: { remote: "test" } },
		});
		writeTestConfig(ctx.testDir, config);

		// Create the project directory
		const projectsDir = join(ctx.testDir, "Projects");
		mkdirSync(projectsDir, { recursive: true });
		mkdirSync(join(projectsDir, "myapp"), { recursive: true });
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("editor config is not modified in dry-run mode", () => {
		const { stringify } = require("yaml");
		const configPath = join(ctx.testDir, "config.yaml");
		const originalContent = require("node:fs").readFileSync(configPath, "utf-8");

		// Verify config file was not modified (dry-run should not write)
		const afterContent = require("node:fs").readFileSync(configPath, "utf-8");
		expect(afterContent).toBe(originalContent);
	});
});
```

**Step 2: Run test**

Run: `bun test src/commands/__tests__/dry-run-global.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/__tests__/dry-run-global.test.ts
git commit -m "test: add integration tests for dry-run mode"
```

---

### Task 14: Run full test suite and verify

Final verification that everything works together.

**Step 1: Run linter**

Run: `bun run check`
Expected: No errors. Fix any formatting issues.

**Step 2: Run type checker**

Run: `bun run typecheck`
Expected: No errors.

**Step 3: Run full test suite**

Run: `bun test`
Expected: All tests pass.

**Step 4: Manual smoke test**

Run a few commands with `--dry-run` to verify output:

```bash
bun run src/index.ts --help
# Should show --dry-run in global options

bun run src/index.ts up myapp --dry-run --no-prompt
# Should show [dry-run] messages (or fail gracefully if no config)
```

**Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: fix lint/type issues from dry-run implementation"
```

---

## Documentation Updates Required

- **`docs/reference/`**: Add `--dry-run` to the global options section of the command reference
- **`CHANGELOG.md`**: Add entry under next version: `feat: add --dry-run global flag for previewing commands`

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | `dryRun()` output helper | `src/lib/ui.ts` |
| 2 | Global `--dry-run` option | `src/index.ts` |
| 3 | `isDryRun()` utility | `src/lib/ui.ts` |
| 4 | Dry-run in `up` | `src/commands/up.ts` |
| 5 | Dry-run in `down` | `src/commands/down.ts` |
| 6 | Dry-run in `clone` | `src/commands/clone.ts` |
| 7 | Dry-run in `push` | `src/commands/push.ts` |
| 8 | Dry-run in `rm` | `src/commands/rm.ts` |
| 9 | Dry-run in `init` | `src/commands/init.ts` |
| 10 | Dry-run in `new` | `src/commands/new.ts` |
| 11 | Dry-run in `editor` + `config` | `src/commands/editor.ts`, `src/commands/config.ts` |
| 12 | Dry-run in `update` + `encrypt` | `src/commands/update.ts`, `src/commands/encrypt.ts` |
| 13 | Integration tests | `src/commands/__tests__/dry-run-global.test.ts` |
| 14 | Full verification | All files |
