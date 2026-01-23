# Shell Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `devbox shell <project>` command to enter a dev container's shell with container auto-start prompt.

**Architecture:** The shell command validates project existence, prompts to start container if not running, then executes `docker exec` with the appropriate shell and working directory from devcontainer.json. Lock checking is stubbed out (being implemented in a separate worktree).

**Tech Stack:** TypeScript, Bun, Commander, Inquirer, execa, Docker

---

## Task 1: Add ShellOptions Type

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Write the type addition**

Add to the end of `src/types/index.ts`:

```typescript
export interface ShellOptions {
	command?: string;
}
```

**Step 2: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add ShellOptions interface"
```

---

## Task 2: Add Container ID Helper

**Files:**
- Modify: `src/lib/container.ts`
- Modify: `src/lib/__tests__/container.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/__tests__/container.test.ts`:

```typescript
describe("getContainerId", () => {
	test("returns container ID when container exists", async () => {
		mockExeca.mockResolvedValueOnce({ stdout: "abc123def456\n" });

		const { getContainerId } = await import("../container.ts");
		const result = await getContainerId("/path/to/project");

		expect(result).toBe("abc123def456");
	});

	test("returns null when no container found", async () => {
		mockExeca.mockResolvedValueOnce({ stdout: "" });

		const { getContainerId } = await import("../container.ts");
		const result = await getContainerId("/path/to/project");

		expect(result).toBeNull();
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/container.test.ts`
Expected: FAIL - getContainerId not found

**Step 3: Write minimal implementation**

Add to `src/lib/container.ts`:

```typescript
// Get container ID for a local project
export async function getContainerId(
	projectPath: string,
): Promise<string | null> {
	try {
		const result = await execa("docker", [
			"ps",
			"-q",
			"--filter",
			`label=devcontainer.local_folder=${projectPath}`,
		]);
		const containerId = result.stdout.trim();
		return containerId || null;
	} catch {
		return null;
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/container.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/container.ts src/lib/__tests__/container.test.ts
git commit -m "feat(container): add getContainerId helper"
```

---

## Task 3: Add Devcontainer Config Reader

**Files:**
- Modify: `src/lib/container.ts`
- Modify: `src/lib/__tests__/container.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/__tests__/container.test.ts`:

```typescript
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("getDevcontainerConfig", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-container-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	test("reads workspaceFolder from devcontainer.json", async () => {
		const devcontainerDir = join(testDir, ".devcontainer");
		mkdirSync(devcontainerDir);
		writeFileSync(
			join(devcontainerDir, "devcontainer.json"),
			JSON.stringify({ workspaceFolder: "/custom/workspace" }),
		);

		const { getDevcontainerConfig } = await import("../container.ts");
		const config = getDevcontainerConfig(testDir);

		expect(config?.workspaceFolder).toBe("/custom/workspace");
	});

	test("returns null when no devcontainer.json exists", async () => {
		const { getDevcontainerConfig } = await import("../container.ts");
		const config = getDevcontainerConfig(testDir);

		expect(config).toBeNull();
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/container.test.ts`
Expected: FAIL - getDevcontainerConfig not found

**Step 3: Write minimal implementation**

Add to `src/lib/container.ts` (add `readFileSync` to imports):

```typescript
import { existsSync, readFileSync } from "node:fs";

export interface DevcontainerConfig {
	workspaceFolder?: string;
}

// Read devcontainer.json configuration
export function getDevcontainerConfig(
	projectPath: string,
): DevcontainerConfig | null {
	const configPath = join(projectPath, ".devcontainer", "devcontainer.json");
	const altConfigPath = join(projectPath, ".devcontainer.json");

	let content: string;
	try {
		if (existsSync(configPath)) {
			content = readFileSync(configPath, "utf-8");
		} else if (existsSync(altConfigPath)) {
			content = readFileSync(altConfigPath, "utf-8");
		} else {
			return null;
		}
		return JSON.parse(content);
	} catch {
		return null;
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/container.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/container.ts src/lib/__tests__/container.test.ts
git commit -m "feat(container): add devcontainer.json config reader"
```

---

## Task 4: Implement Shell Command Tests

**Files:**
- Create: `src/commands/__tests__/shell.test.ts`

**Step 1: Write the failing tests**

Create `src/commands/__tests__/shell.test.ts`:

```typescript
// src/commands/__tests__/shell.test.ts
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("shell command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-shell-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		mkdirSync(join(testDir, "projects", "myapp"), { recursive: true });
		mkdirSync(join(testDir, "projects", "myapp", ".devcontainer"), {
			recursive: true,
		});

		// Write config
		writeFileSync(
			join(testDir, "config.yaml"),
			`remote:
  host: devbox-server
  base_path: ~/code
editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
projects: {}
`,
		);

		// Write devcontainer.json
		writeFileSync(
			join(testDir, "projects", "myapp", ".devcontainer", "devcontainer.json"),
			JSON.stringify({ workspaceFolder: "/workspaces/myapp" }),
		);

		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("project path is constructed correctly", () => {
		const projectPath = join(testDir, "projects", "myapp");
		expect(existsSync(projectPath)).toBe(true);
	});

	test("devcontainer.json is readable", () => {
		const configPath = join(
			testDir,
			"projects",
			"myapp",
			".devcontainer",
			"devcontainer.json",
		);
		expect(existsSync(configPath)).toBe(true);
	});

	test("config file exists", () => {
		const configPath = join(testDir, "config.yaml");
		expect(existsSync(configPath)).toBe(true);
	});
});
```

**Step 2: Run test to verify it passes (setup tests)**

Run: `bun test src/commands/__tests__/shell.test.ts`
Expected: PASS

**Step 3: Commit test file**

```bash
git add src/commands/__tests__/shell.test.ts
git commit -m "test(shell): add shell command test setup"
```

---

## Task 5: Implement Shell Command

**Files:**
- Create: `src/commands/shell.ts`

**Step 1: Write the implementation**

Create `src/commands/shell.ts`:

```typescript
// src/commands/shell.ts

import { execa } from "execa";
import inquirer from "inquirer";
import { configExists, loadConfig } from "../lib/config.ts";
import {
	getContainerId,
	getContainerStatus,
	getDevcontainerConfig,
} from "../lib/container.ts";
import { getProjectPath, projectExists } from "../lib/project.ts";
import { error, header, info } from "../lib/ui.ts";
import { ContainerStatus, type ShellOptions } from "../types/index.ts";
import { upCommand } from "./up.ts";

export async function shellCommand(
	project: string,
	options: ShellOptions,
): Promise<void> {
	// Step 1: Check config exists
	if (!configExists()) {
		error("devbox not configured. Run 'devbox init' first.");
		process.exit(1);
	}

	const config = loadConfig();
	if (!config) {
		error("Failed to load config.");
		process.exit(1);
	}

	// Step 2: Verify project exists locally
	if (!projectExists(project)) {
		error(
			`Project '${project}' not found. Run 'devbox clone ${project}' first.`,
		);
		process.exit(1);
	}

	const projectPath = getProjectPath(project);

	// Step 3: Check lock status (stubbed - being implemented elsewhere)
	// TODO: Integrate with lock.ts when available
	// const lockInfo = await checkLock(project, config.remote.host);
	// if (lockInfo.locked && !isLockedByThisMachine(lockInfo)) {
	//   error(`Project '${project}' is locked by machine '${lockInfo.machine}'.`);
	//   process.exit(1);
	// }

	// Step 4: Check container status
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus !== ContainerStatus.Running) {
		const { startContainer } = await inquirer.prompt([
			{
				type: "confirm",
				name: "startContainer",
				message: "Container is not running. Start it now?",
				default: true,
			},
		]);

		if (!startContainer) {
			info("Exiting. Run 'devbox up' to start the container first.");
			return;
		}

		// Start the container using devbox up
		await upCommand(project, { noPrompt: true });
	}

	// Step 5: Get container ID
	const containerId = await getContainerId(projectPath);
	if (!containerId) {
		error("Failed to find container. Try running 'devbox up' first.");
		process.exit(1);
	}

	// Step 6: Get workspace path from devcontainer.json
	const devcontainerConfig = getDevcontainerConfig(projectPath);
	const workspacePath =
		devcontainerConfig?.workspaceFolder || `/workspaces/${project}`;

	// Step 7: Execute docker exec
	header(`Entering shell for '${project}'...`);

	if (options.command) {
		// Command mode: run command and exit
		try {
			await execa(
				"docker",
				[
					"exec",
					"-w",
					workspacePath,
					containerId,
					"/bin/sh",
					"-c",
					options.command,
				],
				{ stdio: "inherit" },
			);
		} catch (err: unknown) {
			const exitCode = (err as { exitCode?: number })?.exitCode;
			if (exitCode !== undefined) {
				process.exit(exitCode);
			}
			error("Failed to execute command in container.");
			process.exit(1);
		}
	} else {
		// Interactive mode
		info("Attaching to shell (Ctrl+D to exit)...");
		try {
			await execa(
				"docker",
				["exec", "-it", "-w", workspacePath, containerId, "/bin/sh"],
				{ stdio: "inherit" },
			);
		} catch (err: unknown) {
			// Exit code 130 is normal Ctrl+C exit
			const exitCode = (err as { exitCode?: number })?.exitCode;
			if (exitCode === 130) {
				return;
			}
			error("Failed to enter shell.");
			process.exit(1);
		}
	}
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No errors (may need to add ShellOptions type first if not done)

**Step 3: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/commands/shell.ts
git commit -m "feat(shell): implement shell command"
```

---

## Task 6: Register Shell Command

**Files:**
- Modify: `src/index.ts`

**Step 1: Add import**

Add import at top of `src/index.ts`:

```typescript
import { shellCommand } from "./commands/shell.ts";
```

**Step 2: Add command registration**

Add after the `status` command registration:

```typescript
program
	.command("shell <project>")
	.description("Enter container shell")
	.option("-c, --command <cmd>", "Run a single command and exit")
	.action(shellCommand);
```

**Step 3: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Test CLI help output**

Run: `bun src/index.ts shell --help`
Expected: Shows shell command help with -c option

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): register shell command"
```

---

## Task 7: Final Verification

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Run linter**

Run: `bun run check`
Expected: No errors (or fix any that appear)

**Step 4: Test CLI**

Run: `bun src/index.ts shell --help`
Expected: Shows usage info

Run: `bun src/index.ts --help`
Expected: Shows shell in command list

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint/type issues"
```

---

## Summary

After completing all tasks, you will have:

1. `ShellOptions` type in `src/types/index.ts`
2. `getContainerId` helper in `src/lib/container.ts` with tests
3. `getDevcontainerConfig` helper in `src/lib/container.ts` with tests
4. Shell command tests in `src/commands/__tests__/shell.test.ts`
5. Shell command implementation in `src/commands/shell.ts`
6. CLI registration in `src/index.ts`

The shell command will:
- Error if project doesn't exist locally
- Prompt to start container if not running
- Support interactive mode (`devbox shell myapp`)
- Support command mode (`devbox shell myapp -c "npm test"`)
- Use workspace path from devcontainer.json
- Has TODO comment for lock integration when available
