# Interactive Remove (`devbox rm`) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When `devbox rm` is called with no arguments, show a multi-select list of local projects so the user can choose one or more to remove interactively.

**Architecture:** Add argument-less invocation path to the existing `rm` command. When no project argument is given, fetch local projects via `getLocalProjects()`, present them with `checkbox` from `@inquirer/prompts`, then loop through selections calling the existing `rmCommand()` logic for each.

**Tech Stack:** Commander.js (optional argument), `@inquirer/prompts` (checkbox), existing rm/project/container/mutagen/lock libs.

---

### Task 1: Write failing test for interactive project selection

**Files:**
- Create: `src/commands/__tests__/rm-interactive.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestContext } from "../../lib/__tests__/test-utils.ts";

describe("rm interactive mode", () => {
	let ctx: ReturnType<typeof createTestContext> extends Promise<infer T>
		? T
		: never;

	beforeEach(() => {
		ctx = createTestContext();
		// Create fake local projects
		mkdirSync(join(ctx.projectsDir, "project-alpha"), { recursive: true });
		mkdirSync(join(ctx.projectsDir, "project-beta"), { recursive: true });
		mkdirSync(join(ctx.projectsDir, "project-gamma"), { recursive: true });
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("getLocalProjects returns all projects in projects dir", () => {
		const { getLocalProjects } = require("../../lib/project.ts");
		const projects = getLocalProjects();
		const names = projects.map((p: { name: string }) => p.name).sort();
		expect(names).toEqual(["project-alpha", "project-beta", "project-gamma"]);
	});
});
```

**Step 2: Run test to verify it passes (this validates the existing helper works)**

Run: `bun test src/commands/__tests__/rm-interactive.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/__tests__/rm-interactive.test.ts
git commit -m "test: add interactive rm test scaffold"
```

---

### Task 2: Make `project` argument optional in rm command registration

**Files:**
- Modify: `src/index.ts` (line ~102)

**Step 1: Change the rm command registration from required to optional argument**

In `src/index.ts`, change:

```typescript
.command("rm <project>")
```

to:

```typescript
.command("rm [project]")
```

**Step 2: Run typecheck to verify**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(rm): make project argument optional for interactive mode"
```

---

### Task 3: Add interactive selection when no project argument given

**Files:**
- Modify: `src/commands/rm.ts` (top of `rmCommand` function)
- Modify: `src/types/index.ts` (if needed for imports)

**Step 1: Write the failing test**

Add to `src/commands/__tests__/rm-interactive.test.ts`:

```typescript
test("rmCommand with no project and no local projects shows info message", async () => {
	// Empty projects dir - remove the ones we created
	rmSync(join(ctx.projectsDir, "project-alpha"), { recursive: true });
	rmSync(join(ctx.projectsDir, "project-beta"), { recursive: true });
	rmSync(join(ctx.projectsDir, "project-gamma"), { recursive: true });

	const { getLocalProjects } = require("../../lib/project.ts");
	const projects = getLocalProjects();
	expect(projects).toHaveLength(0);
});
```

**Step 2: Run test to verify it passes**

Run: `bun test src/commands/__tests__/rm-interactive.test.ts`
Expected: PASS

**Step 3: Implement interactive selection in rmCommand**

In `src/commands/rm.ts`, modify the function signature and add interactive flow at the top:

```typescript
import { checkbox } from "@inquirer/prompts";
import { getLocalProjects } from "../lib/project.ts";
import { info } from "../lib/ui.ts";

export async function rmCommand(
	project: string | undefined,
	options: RmOptions,
): Promise<void> {
	// Interactive mode: no project argument
	if (!project) {
		const localProjects = getLocalProjects();
		if (localProjects.length === 0) {
			info("No local projects found.");
			return;
		}

		const selected = await checkbox({
			message: "Select projects to remove:",
			choices: localProjects.map((p) => ({
				name: p.name,
				value: p.name,
			})),
		});

		if (selected.length === 0) {
			info("No projects selected.");
			return;
		}

		for (const projectName of selected) {
			await rmCommand(projectName, options);
		}
		return;
	}

	// ... existing rmCommand logic unchanged below ...
```

**Step 4: Run all tests**

Run: `bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/commands/rm.ts src/commands/__tests__/rm-interactive.test.ts
git commit -m "feat(rm): add interactive multi-select when no project specified"
```

---

### Task 4: Install @inquirer/prompts if not already available

**Files:**
- Modify: `package.json` (if needed)

**Step 1: Check if @inquirer/prompts is already installed**

Run: `bun pm ls | grep inquirer`

**Step 2: Install if missing**

Run: `bun add @inquirer/prompts` (only if not already installed)

**Step 3: Run all tests**

Run: `bun test`
Expected: PASS

**Step 4: Commit (if package.json changed)**

```bash
git add package.json bun.lock
git commit -m "chore: add @inquirer/prompts dependency"
```

---

### Task 5: Manual integration test

**Step 1: Test interactive mode**

Run: `bun run dev rm`
Expected: Shows checkbox list of local projects (or "No local projects found" if empty)

**Step 2: Test existing mode still works**

Run: `bun run dev rm some-project`
Expected: Existing behavior unchanged (removes the named project)

**Step 3: Run full check suite**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Test scaffold for interactive rm |
| 2 | Make project argument optional in CLI registration |
| 3 | Add interactive checkbox selection logic |
| 4 | Ensure @inquirer/prompts dependency |
| 5 | Manual integration test |
