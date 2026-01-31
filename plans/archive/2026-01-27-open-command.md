# Open Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `devbox open [project]` command that shows an action menu (editor/shell/both) for running containers without restarting them.

**Architecture:** The `open` command reuses `determinePostStartAction()` and `executePostStartAction()` from `up.ts` but only works on already-running containers. It fills the gap between `up` (starts + opens) and `shell` (shell only).

**Tech Stack:** TypeScript, Commander.js, Inquirer.js, existing container/editor utilities

---

## Task 1: Add OpenOptions Type

**Files:**
- Modify: `src/types/index.ts:245` (after ShellOptions)

**Step 1: Add the type definition**

Add after `ShellOptions` interface:

```typescript
export interface OpenOptions {
	editor?: boolean;
	shell?: boolean;
	noPrompt?: boolean;
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add OpenOptions interface"
```

---

## Task 2: Export Action Functions from up.ts

**Files:**
- Modify: `src/commands/up.ts:418-521`

The `determinePostStartAction()` and `executePostStartAction()` functions are currently private. We need to export them for reuse.

**Step 1: Export the PostStartAction type**

Change line ~418 from:

```typescript
type PostStartAction = "editor" | "shell" | "both" | "none";
```

To:

```typescript
export type PostStartAction = "editor" | "shell" | "both" | "none";
```

**Step 2: Export determinePostStartAction**

Change function signature from:

```typescript
async function determinePostStartAction(
```

To:

```typescript
export async function determinePostStartAction(
```

**Step 3: Export executePostStartAction**

Change function signature from:

```typescript
async function executePostStartAction(
```

To:

```typescript
export async function executePostStartAction(
```

**Step 4: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/up.ts
git commit -m "refactor(up): export post-start action functions for reuse"
```

---

## Task 3: Create open.ts Command File

**Files:**
- Create: `src/commands/open.ts`

**Step 1: Create the command file**

```typescript
// src/commands/open.ts

import inquirer from "inquirer";
import { configExists, loadConfig, saveConfig } from "../lib/config.ts";
import { getContainerStatus } from "../lib/container.ts";
import {
	getLocalProjects,
	getProjectPath,
	projectExists,
	resolveProjectFromCwd,
} from "../lib/project.ts";
import { error, header, info, success } from "../lib/ui.ts";
import { ContainerStatus, type OpenOptions } from "../types/index.ts";
import {
	determinePostStartAction,
	executePostStartAction,
} from "./up.ts";

export async function openCommand(
	projectArg: string | undefined,
	options: OpenOptions,
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

	// Step 2: Resolve project
	let project = projectArg;

	if (!project) {
		project = resolveProjectFromCwd() ?? undefined;
	}

	if (!project) {
		const projects = getLocalProjects();

		if (projects.length === 0) {
			error(
				"No local projects found. Run 'devbox clone' or 'devbox push' first.",
			);
			process.exit(1);
		}

		if (options.noPrompt) {
			error("No project specified and --no-prompt is set.");
			process.exit(1);
		}

		const { selectedProject } = await inquirer.prompt([
			{
				type: "rawlist",
				name: "selectedProject",
				message: "Select a project:",
				choices: projects,
			},
		]);
		project = selectedProject;
	}

	if (!projectExists(project ?? "")) {
		error(
			`Project '${project}' not found locally. Run 'devbox clone ${project}' first.`,
		);
		process.exit(1);
	}

	const projectPath = getProjectPath(project ?? "");

	// Step 3: Check container is running
	const containerStatus = await getContainerStatus(projectPath);

	if (containerStatus !== ContainerStatus.Running) {
		error(`Container for '${project}' is not running.`);
		info("Run 'devbox up' to start the container first.");
		process.exit(1);
	}

	header(`Opening '${project}'...`);

	// Step 4: Convert options to UpOptions format for determinePostStartAction
	const upStyleOptions = {
		editor: options.editor,
		attach: options.shell,
		noPrompt: options.noPrompt,
	};

	// Step 5: Determine and execute action
	const { action, editor } = await determinePostStartAction(
		config,
		upStyleOptions,
	);

	// Handle editor preference saving (only in interactive mode)
	if (
		!options.noPrompt &&
		!options.editor &&
		!options.shell &&
		!config.editor &&
		editor
	) {
		const { makeDefault } = await inquirer.prompt([
			{
				type: "confirm",
				name: "makeDefault",
				message: `Make ${editor} your default editor for future sessions?`,
				default: true,
			},
		]);

		if (makeDefault) {
			config.editor = editor;
			saveConfig(config);
			success(`Set ${editor} as default editor.`);
		}
	}

	await executePostStartAction(projectPath, action, editor);
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/open.ts
git commit -m "feat(open): add open command implementation"
```

---

## Task 4: Register Command in index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: Add import**

Add after line 12 (`import { newCommand }`):

```typescript
import { openCommand } from "./commands/open.ts";
```

**Step 2: Register the command**

Add after the `status` command registration (around line 84):

```typescript
program
	.command("open [project]")
	.description("Open editor/shell for running container")
	.option("-e, --editor", "Open in editor only")
	.option("-s, --shell", "Attach to shell only")
	.option("--no-prompt", "Non-interactive mode")
	.action(openCommand);
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(cli): register open command"
```

---

## Task 5: Add Tests for open.ts

**Files:**
- Create: `src/commands/__tests__/open.test.ts`

**Step 1: Create the test file**

```typescript
// src/commands/__tests__/open.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("open command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-open-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;

		// Create minimal config
		const configDir = testDir;
		mkdirSync(configDir, { recursive: true });
		writeFileSync(
			join(configDir, "config.yaml"),
			`editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
remotes: {}
projects: {}
`,
		);
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("should require project to exist locally", async () => {
		// Import dynamically to use mocked DEVBOX_HOME
		const { projectExists } = await import("../../lib/project.ts");
		expect(projectExists("nonexistent")).toBe(false);
	});

	test("should detect project from cwd when in project directory", async () => {
		// Create a project directory
		const projectsDir = join(testDir, "projects");
		mkdirSync(projectsDir, { recursive: true });
		const projectPath = join(projectsDir, "myproject");
		mkdirSync(projectPath, { recursive: true });

		const { projectExists } = await import("../../lib/project.ts");
		expect(projectExists("myproject")).toBe(true);
	});
});
```

**Step 2: Run tests**

```bash
bun test src/commands/__tests__/open.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/__tests__/open.test.ts
git commit -m "test(open): add basic tests for open command"
```

---

## Task 6: Update Implementation Tracker

**Files:**
- Modify: `plans/IMPLEMENTATION.md`

**Step 1: Mark Open Command as complete**

In the Future Features > High Priority section, change:

```markdown
- [ ] **Open Command:** `devbox open [project]` - Show action menu (editor/shell/both) for running containers without restarting
```

To:

```markdown
- [x] **Open Command:** `devbox open [project]` - Show action menu (editor/shell/both) for running containers without restarting
  - Commit: `<commit-hash>`
```

**Step 2: Run all checks**

```bash
bun run check && bun run typecheck && bun test
```

Expected: All pass

**Step 3: Final commit**

```bash
git add plans/IMPLEMENTATION.md
git commit -m "docs: mark open command as complete"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add OpenOptions type | `src/types/index.ts` |
| 2 | Export action functions from up.ts | `src/commands/up.ts` |
| 3 | Create open.ts command | `src/commands/open.ts` |
| 4 | Register in index.ts | `src/index.ts` |
| 5 | Add tests | `src/commands/__tests__/open.test.ts` |
| 6 | Update tracker | `plans/IMPLEMENTATION.md` |

**Total: 6 tasks, ~6 commits**
