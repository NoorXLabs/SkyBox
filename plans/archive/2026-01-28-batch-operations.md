# Batch Operations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `--all` flag to `skybox up` and `skybox down` to start/stop all local projects in one command.

**Architecture:** Add `--all` flag to both `up` and `down` commands. When set, iterate over all local projects from `getLocalProjects()` and invoke the existing command logic for each. Show a summary of successes/failures at the end.

**Tech Stack:** Commander.js (new option), existing project.ts, up.ts, down.ts.

---

### Task 1: Add --all flag to up command

**Files:**
- Modify: `src/index.ts` (up command registration)
- Modify: `src/commands/up.ts`
- Modify: `src/types/index.ts` (UpOptions)

**Step 1: Update UpOptions type**

In `src/types/index.ts`:

```typescript
export interface UpOptions {
	editor?: string;
	attach?: boolean;
	rebuild?: boolean;
	noPrompt?: boolean;
	verbose?: boolean;
	all?: boolean;
}
```

**Step 2: Register flag in CLI**

In `src/index.ts`, add to the up command:

```typescript
.option("-A, --all", "start all local projects")
```

**Step 3: Add batch logic at top of upCommand**

In `src/commands/up.ts`, add at the beginning of `upCommand`:

```typescript
import { getLocalProjects } from "../lib/project.ts";

// Inside upCommand, before existing logic:
if (options.all) {
	const projects = getLocalProjects();
	if (projects.length === 0) {
		info("No local projects found.");
		return;
	}
	info(`Starting ${projects.length} projects...`);
	let succeeded = 0;
	let failed = 0;
	for (const project of projects) {
		try {
			header(`\n${project.name}`);
			await upCommand(project.name, { ...options, all: false });
			succeeded++;
		} catch {
			failed++;
		}
	}
	info(`\nDone: ${succeeded} started, ${failed} failed.`);
	return;
}
```

**Step 4: Run all tests**

Run: `bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/index.ts src/index.ts src/commands/up.ts
git commit -m "feat(up): add --all flag for batch project start"
```

---

### Task 2: Add --all flag to down command

**Files:**
- Modify: `src/index.ts` (down command registration)
- Modify: `src/commands/down.ts`
- Modify: `src/types/index.ts` (DownOptions)

**Step 1: Update DownOptions type**

```typescript
export interface DownOptions {
	cleanup?: boolean;
	force?: boolean;
	noPrompt?: boolean;
	all?: boolean;
}
```

**Step 2: Register flag in CLI**

```typescript
.option("-A, --all", "stop all local projects")
```

**Step 3: Add batch logic at top of downCommand**

Same pattern as up — iterate `getLocalProjects()`, call `downCommand()` for each.

**Step 4: Run all tests**

Run: `bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/index.ts src/index.ts src/commands/down.ts
git commit -m "feat(down): add --all flag for batch project stop"
```

---

### Task 3: Run full check suite

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add `--all` to up command with iteration logic |
| 2 | Add `--all` to down command with iteration logic |
| 3 | Full check suite |
