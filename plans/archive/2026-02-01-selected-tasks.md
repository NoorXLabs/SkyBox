# Selected Tasks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement three high-priority features: fix template repository URLs, add a hooks system for pre/post lifecycle events, and build a TUI status dashboard.

**Architecture:** Templates task replaces broken placeholder GitHub URLs with working devcontainer-community repos. Hooks system adds a config-driven lifecycle hook runner that executes shell commands at key points in `up`/`down` flows. Dashboard uses `blessed` for a full-screen TUI showing live project status with keyboard navigation.

**Tech Stack:** Bun, TypeScript, Commander.js, blessed (TUI), chalk

---

## Task 1: Fix Template Repository URLs

Replace the four broken `skybox-templates/*-starter` URLs in `BUILT_IN_TEMPLATES` with working GitHub repositories that contain devcontainer configs.

**Files:**
- Modify: `src/lib/constants.ts:289-310`
- Test: `src/lib/__tests__/projectTemplates.test.ts`

**Step 1: Write a failing test for template URL validity**

```typescript
// src/lib/__tests__/projectTemplates.test.ts
import { describe, test, expect } from "bun:test";
import { BUILT_IN_TEMPLATES } from "@lib/constants.ts";

describe("built-in templates", () => {
	test("all template URLs should point to valid GitHub repos", () => {
		for (const template of BUILT_IN_TEMPLATES) {
			expect(template.url).toMatch(/^https:\/\/github\.com\/.+\/.+/);
			// Should NOT reference the non-existent skybox-templates org
			expect(template.url).not.toContain("skybox-templates");
		}
	});

	test("should have templates for node, bun, python, and go", () => {
		const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
		expect(ids).toContain("node");
		expect(ids).toContain("bun");
		expect(ids).toContain("python");
		expect(ids).toContain("go");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/projectTemplates.test.ts`
Expected: FAIL — URLs still contain `skybox-templates`

**Step 3: Update template URLs to working repos**

In `src/lib/constants.ts`, replace the `BUILT_IN_TEMPLATES` array:

```typescript
/** Built-in project templates (git repos). */
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
	{
		id: "node",
		name: "Node.js",
		url: "https://github.com/devcontainers/template-starter",
	},
	{
		id: "bun",
		name: "Bun",
		url: "https://github.com/oven-sh/bun-starter",
	},
	{
		id: "python",
		name: "Python",
		url: "https://github.com/devcontainers/template-starter",
	},
	{
		id: "go",
		name: "Go",
		url: "https://github.com/devcontainers/template-starter",
	},
];
```

> **Note to implementer:** Before committing, verify these URLs actually exist. If `oven-sh/bun-starter` doesn't exist, use `https://github.com/oven-sh/bun` or another appropriate Bun starter. The key requirement is: URLs must point to real, publicly accessible repos. Run `gh api repos/<owner>/<repo> --jq .full_name` to verify each one.

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/projectTemplates.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/constants.ts src/lib/__tests__/projectTemplates.test.ts
git commit -m "fix: replace broken template URLs with working GitHub repos"
```

---

## Task 2: Hooks System

Add a lifecycle hooks system that runs user-defined shell commands before/after key operations (`up`, `down`, sync resume, sync pause).

**Files:**
- Create: `src/lib/hooks.ts`
- Modify: `src/types/index.ts` (add `HooksConfig` types)
- Modify: `src/lib/constants.ts` (add hook event names)
- Modify: `src/commands/up.ts` (call hooks at lifecycle points)
- Modify: `src/commands/down.ts` (call hooks at lifecycle points)
- Test: `src/lib/__tests__/hooks.test.ts`

### Task 2a: Add hook types

**Step 1: Write failing test for hook types**

```typescript
// src/lib/__tests__/hooks.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("hooks", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `skybox-hooks-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("HOOK_EVENTS should list all valid hook event names", async () => {
		const { HOOK_EVENTS } = await import("@lib/constants.ts");
		expect(HOOK_EVENTS).toContain("pre-up");
		expect(HOOK_EVENTS).toContain("post-up");
		expect(HOOK_EVENTS).toContain("pre-down");
		expect(HOOK_EVENTS).toContain("post-down");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/hooks.test.ts`
Expected: FAIL — `HOOK_EVENTS` not exported

**Step 3: Add types and constants**

In `src/types/index.ts`, add at the end:

```typescript
// Hook types

/** Valid lifecycle hook event names */
export type HookEvent = "pre-up" | "post-up" | "pre-down" | "post-down";

/** Single hook definition: a shell command with optional context */
export interface HookEntry {
	command: string;
	context?: "host" | "container"; // default: "host"
}

/** Per-project hooks configuration */
export type HooksConfig = Partial<Record<HookEvent, string | HookEntry[]>>;
```

In `src/lib/constants.ts`, add in the `// ── App & GitHub ──` section:

```typescript
/** Valid lifecycle hook event names. */
export const HOOK_EVENTS = [
	"pre-up",
	"post-up",
	"pre-down",
	"post-down",
] as const;
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/hooks.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/index.ts src/lib/constants.ts src/lib/__tests__/hooks.test.ts
git commit -m "feat(hooks): add hook types and event constants"
```

### Task 2b: Implement hook runner

**Step 1: Write failing test for hook runner**

Add to `src/lib/__tests__/hooks.test.ts`:

```typescript
	test("runHooks should execute a simple shell command", async () => {
		const { runHooks } = await import("@lib/hooks.ts");
		const markerFile = join(testDir, "hook-ran.txt");
		const hooks: Record<string, string> = {
			"post-up": `touch ${markerFile}`,
		};
		await runHooks("post-up", hooks, testDir);
		const { existsSync } = await import("node:fs");
		expect(existsSync(markerFile)).toBe(true);
	});

	test("runHooks should skip if no hook defined for event", async () => {
		const { runHooks } = await import("@lib/hooks.ts");
		// Should not throw
		await runHooks("pre-up", {}, testDir);
	});

	test("runHooks should handle array of hook entries", async () => {
		const { runHooks } = await import("@lib/hooks.ts");
		const markerFile1 = join(testDir, "hook1.txt");
		const markerFile2 = join(testDir, "hook2.txt");
		const hooks = {
			"pre-down": [
				{ command: `touch ${markerFile1}` },
				{ command: `touch ${markerFile2}` },
			],
		};
		await runHooks("pre-down", hooks, testDir);
		const { existsSync } = await import("node:fs");
		expect(existsSync(markerFile1)).toBe(true);
		expect(existsSync(markerFile2)).toBe(true);
	});

	test("runHooks should report failure without throwing", async () => {
		const { runHooks } = await import("@lib/hooks.ts");
		const hooks = { "pre-up": "exit 1" };
		// Should not throw — hooks are non-fatal
		const result = await runHooks("pre-up", hooks, testDir);
		expect(result.success).toBe(false);
	});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/hooks.test.ts`
Expected: FAIL — `@lib/hooks.ts` doesn't exist

**Step 3: Implement the hook runner**

Create `src/lib/hooks.ts`:

```typescript
// src/lib/hooks.ts

import type { HookEntry, HookEvent, HooksConfig } from "@typedefs/index.ts";
import { execa } from "execa";
import { getErrorMessage } from "@lib/errors.ts";
import { info, warn } from "@lib/ui.ts";

interface HookResult {
	success: boolean;
	errors: string[];
}

/**
 * Normalize a hook config value (string or HookEntry[]) into HookEntry[].
 */
function normalizeHookEntries(
	value: string | HookEntry[] | undefined,
): HookEntry[] {
	if (!value) return [];
	if (typeof value === "string") {
		return [{ command: value, context: "host" }];
	}
	return value.map((entry) => ({
		command: entry.command,
		context: entry.context ?? "host",
	}));
}

/**
 * Run all hooks for a given lifecycle event.
 * Hooks are non-fatal: failures are reported but do not stop the parent operation.
 */
export async function runHooks(
	event: HookEvent,
	hooks: HooksConfig | undefined,
	cwd: string,
): Promise<HookResult> {
	if (!hooks) return { success: true, errors: [] };

	const entries = normalizeHookEntries(hooks[event]);
	if (entries.length === 0) return { success: true, errors: [] };

	info(`Running ${event} hooks...`);
	const errors: string[] = [];

	for (const entry of entries) {
		try {
			if (entry.context === "container") {
				warn(`Container-context hooks not yet supported, skipping: ${entry.command}`);
				continue;
			}
			await execa("sh", ["-c", entry.command], { cwd, stdio: "inherit" });
		} catch (err) {
			const msg = `Hook failed (${event}): ${getErrorMessage(err)}`;
			warn(msg);
			errors.push(msg);
		}
	}

	return { success: errors.length === 0, errors };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/hooks.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/hooks.ts src/lib/__tests__/hooks.test.ts
git commit -m "feat(hooks): implement hook runner with host-context execution"
```

### Task 2c: Add hooks config to project config

**Step 1: Add `hooks` field to `ProjectConfigV2`**

In `src/types/index.ts`, modify `ProjectConfigV2`:

```typescript
export interface ProjectConfigV2 {
	remote: string;
	ignore?: string[];
	editor?: string;
	sync_paths?: string[];
	encryption?: ProjectEncryption;
	hooks?: HooksConfig;
}
```

No test needed — this is a type-only change.

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(hooks): add hooks field to ProjectConfigV2"
```

### Task 2d: Wire hooks into `up` command

**Step 1: Add hook calls to `upCommand` in `src/commands/up.ts`**

Add import at top:

```typescript
import { runHooks } from "@lib/hooks.ts";
```

In `upCommand()`, after loading config and resolving project (around line 489 `header(...)`), add pre-up hook:

```typescript
// Run pre-up hooks
const projectConfig = config.projects[project];
if (projectConfig?.hooks) {
	await runHooks("pre-up", projectConfig.hooks, projectPath);
}
```

At the end of `upCommand()` (after `handlePostStart`, around line 537), add post-up hook:

```typescript
// Run post-up hooks
if (projectConfig?.hooks) {
	await runHooks("post-up", projectConfig.hooks, projectPath);
}
```

**Step 2: Run full test suite**

Run: `bun test`
Expected: All existing tests pass (hooks are opt-in, no behavior change without config)

**Step 3: Commit**

```bash
git add src/commands/up.ts
git commit -m "feat(hooks): wire pre-up and post-up hooks into up command"
```

### Task 2e: Wire hooks into `down` command

**Step 1: Add hook calls to `downCommand` in `src/commands/down.ts`**

Add import at top:

```typescript
import { runHooks } from "@lib/hooks.ts";
```

After resolving project and loading config (around line 236 `header(...)`), add pre-down hook:

```typescript
// Run pre-down hooks
const projectConfig = config.projects[project ?? ""];
if (projectConfig?.hooks) {
	const projectPath = getProjectPath(project ?? "");
	await runHooks("pre-down", projectConfig.hooks, projectPath);
}
```

At the end of `downCommand()` before the final `success(...)` line, add post-down hook:

```typescript
// Run post-down hooks
if (projectConfig?.hooks) {
	await runHooks("post-down", projectConfig.hooks, getProjectPath(project ?? ""));
}
```

**Step 2: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/commands/down.ts
git commit -m "feat(hooks): wire pre-down and post-down hooks into down command"
```

---

## Task 3: Status Dashboard (TUI)

Build a full-screen terminal dashboard showing all projects with live-updating status, using `blessed`.

**Files:**
- Create: `src/commands/dashboard.ts`
- Modify: `src/index.ts` (register dashboard command)
- Test: `src/commands/__tests__/dashboard.test.ts`

### Task 3a: Install blessed dependency

**Step 1: Install blessed**

Run: `bun add blessed && bun add -d @types/blessed`

**Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add blessed TUI library"
```

### Task 3b: Create dashboard command skeleton

**Step 1: Write failing test**

```typescript
// src/commands/__tests__/dashboard.test.ts
import { describe, test, expect } from "bun:test";

describe("dashboard", () => {
	test("dashboardCommand should be a function", async () => {
		const { dashboardCommand } = await import("@commands/dashboard.ts");
		expect(typeof dashboardCommand).toBe("function");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/commands/__tests__/dashboard.test.ts`
Expected: FAIL — module not found

**Step 3: Implement dashboard command**

Create `src/commands/dashboard.ts`:

```typescript
// src/commands/dashboard.ts

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getContainerStatus } from "@lib/container.ts";
import { getSyncStatus } from "@lib/mutagen.ts";
import { getProjectsDir } from "@lib/paths.ts";
import { getGitInfo } from "@commands/status.ts";
import { ContainerStatus } from "@typedefs/index.ts";
import blessed from "blessed";

interface DashboardProject {
	name: string;
	container: string;
	sync: string;
	branch: string;
}

async function gatherProjectData(): Promise<DashboardProject[]> {
	const projectsDir = getProjectsDir();
	if (!existsSync(projectsDir)) return [];

	const entries = readdirSync(projectsDir).filter((entry) => {
		const fullPath = join(projectsDir, entry);
		return statSync(fullPath).isDirectory();
	});

	const results: DashboardProject[] = [];

	for (const name of entries) {
		const projectPath = join(projectsDir, name);
		const [containerStatus, syncStatus, gitInfo] = await Promise.all([
			getContainerStatus(projectPath),
			getSyncStatus(name),
			getGitInfo(projectPath),
		]);

		let container = "stopped";
		if (containerStatus === ContainerStatus.Running) container = "running";

		let sync = "none";
		if (syncStatus.exists) sync = syncStatus.paused ? "paused" : "syncing";

		results.push({
			name,
			container,
			sync,
			branch: gitInfo?.branch || "-",
		});
	}

	return results;
}

function formatTable(projects: DashboardProject[]): string {
	if (projects.length === 0) return "  No projects found. Use 'skybox clone' to get started.";

	const header = "  NAME                    CONTAINER   SYNC       BRANCH";
	const separator = "  " + "─".repeat(60);
	const rows = projects.map((p) => {
		const name = p.name.padEnd(22);
		const container = p.container.padEnd(12);
		const sync = p.sync.padEnd(11);
		return `  ${name}  ${container}${sync}${p.branch}`;
	});

	return [header, separator, ...rows].join("\n");
}

export async function dashboardCommand(): Promise<void> {
	const screen = blessed.screen({
		smartCSR: true,
		title: "SkyBox Dashboard",
	});

	const titleBox = blessed.box({
		top: 0,
		left: 0,
		width: "100%",
		height: 3,
		content: "{center}{bold}SkyBox Dashboard{/bold}{/center}",
		tags: true,
		style: { fg: "white", bg: "blue" },
	});

	const tableBox = blessed.box({
		top: 3,
		left: 0,
		width: "100%",
		height: "100%-6",
		content: "  Loading...",
		tags: true,
		scrollable: true,
		keys: true,
		vi: true,
		style: { fg: "white" },
	});

	const helpBox = blessed.box({
		bottom: 0,
		left: 0,
		width: "100%",
		height: 3,
		content: "{center}q: quit  r: refresh  ↑↓: scroll{/center}",
		tags: true,
		style: { fg: "gray" },
	});

	screen.append(titleBox);
	screen.append(tableBox);
	screen.append(helpBox);

	async function refresh(): Promise<void> {
		tableBox.setContent("  Refreshing...");
		screen.render();
		const projects = await gatherProjectData();
		tableBox.setContent(formatTable(projects));
		screen.render();
	}

	// Key bindings
	screen.key(["q", "C-c", "escape"], () => {
		screen.destroy();
		process.exit(0);
	});

	screen.key(["r"], () => {
		refresh();
	});

	// Initial load
	await refresh();

	// Auto-refresh every 10 seconds
	const interval = setInterval(() => {
		refresh();
	}, 10_000);

	screen.on("destroy", () => {
		clearInterval(interval);
	});

	screen.render();
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/commands/__tests__/dashboard.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/dashboard.ts src/commands/__tests__/dashboard.test.ts
git commit -m "feat(dashboard): add TUI dashboard with blessed"
```

### Task 3c: Register dashboard command

**Step 1: Add to `src/index.ts`**

Add import:

```typescript
import { dashboardCommand } from "@commands/dashboard.ts";
```

Add command registration (after the `status` command block):

```typescript
program
	.command("dashboard")
	.alias("dash")
	.description("Full-screen status dashboard")
	.action(dashboardCommand);
```

**Step 2: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(dashboard): register dashboard command with dash alias"
```

---

## Task 4: Update docs and tracker

**Step 1: Update `plans/IMPLEMENTATION.md`**

Mark the three tasks as completed with `[x]` and note the commit hashes.

**Step 2: Check if VitePress docs need updates**

Run the `skybox-update-docs` skill to check if any docs pages in `docs/` need creating or updating for:
- Template URLs change (may affect getting-started guide)
- Hooks system (needs new docs page: `docs/reference/hooks.md`)
- Dashboard command (needs entry in `docs/reference/commands.md`)

**Step 3: Commit docs updates**

```bash
git add plans/ docs/
git commit -m "docs: update implementation tracker and add hooks/dashboard docs"
```
