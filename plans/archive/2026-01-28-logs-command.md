# Logs Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `skybox logs [project]` to display container logs and Mutagen sync logs for a project.

**Architecture:** New command that fetches Docker container logs via `docker logs` and Mutagen sync session logs via `mutagen sync monitor`. Supports `--follow` for live tailing and `--lines` to control output length. Defaults to container logs; `--sync` shows sync logs instead.

**Tech Stack:** Commander.js, `execa` for Docker/Mutagen CLI, existing container.ts and mutagen.ts helpers.

---

### Task 1: Write failing test for logs command

**Files:**
- Create: `src/commands/__tests__/logs.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, test, expect } from "bun:test";

describe("logs command", () => {
	test("module exports logsCommand function", async () => {
		const mod = await import("../logs.ts");
		expect(typeof mod.logsCommand).toBe("function");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/commands/__tests__/logs.test.ts`
Expected: FAIL — module not found

**Step 3: Commit**

```bash
git add src/commands/__tests__/logs.test.ts
git commit -m "test: add logs command test scaffold"
```

---

### Task 2: Create logs command

**Files:**
- Create: `src/commands/logs.ts`

**Step 1: Implement the command**

```typescript
import { execa } from "execa";
import { getContainerId, normalizePath } from "../lib/container.ts";
import { sessionName } from "../lib/mutagen.ts";
import { getMutagenPath } from "../lib/paths.ts";
import { getProjectPath, projectExists } from "../lib/project.ts";
import { error, info } from "../lib/ui.ts";
import { getErrorMessage } from "../lib/errors.ts";

interface LogsOptions {
	follow?: boolean;
	lines?: string;
	sync?: boolean;
}

export async function logsCommand(
	project: string,
	options: LogsOptions,
): Promise<void> {
	if (!projectExists(project)) {
		error(`Project "${project}" not found locally.`);
		return;
	}

	if (options.sync) {
		await showSyncLogs(project, options);
	} else {
		await showContainerLogs(project, options);
	}
}

async function showContainerLogs(
	project: string,
	options: LogsOptions,
): Promise<void> {
	const projectPath = normalizePath(getProjectPath(project));
	const containerId = await getContainerId(projectPath);

	if (!containerId) {
		error(`No container found for "${project}". Is it running?`);
		return;
	}

	const args = ["logs"];
	if (options.follow) args.push("--follow");
	if (options.lines) args.push("--tail", options.lines);
	args.push(containerId);

	try {
		await execa("docker", args, { stdio: "inherit" });
	} catch (err) {
		error(`Failed to get container logs: ${getErrorMessage(err)}`);
	}
}

async function showSyncLogs(
	project: string,
	options: LogsOptions,
): Promise<void> {
	const mutagenPath = getMutagenPath();
	const name = sessionName(project);

	const args = ["sync", "monitor", `--label-selector=name=${name}`];

	try {
		info(`Showing sync logs for "${project}"...`);
		await execa(mutagenPath, args, { stdio: "inherit" });
	} catch (err) {
		error(`Failed to get sync logs: ${getErrorMessage(err)}`);
	}
}
```

**Step 2: Run test to verify it passes**

Run: `bun test src/commands/__tests__/logs.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/logs.ts
git commit -m "feat: add logs command for container and sync logs"
```

---

### Task 3: Register command in CLI entry point

**Files:**
- Modify: `src/index.ts`

**Step 1: Add registration**

```typescript
import { logsCommand } from "./commands/logs.ts";

program
	.command("logs <project>")
	.description("Show container or sync logs")
	.option("-f, --follow", "follow log output")
	.option("-n, --lines <number>", "number of lines to show", "50")
	.option("-s, --sync", "show sync logs instead of container logs")
	.action(logsCommand);
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: register logs command in CLI"
```

---

### Task 4: Run full check suite

**Step 1: Run all checks**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Test scaffold |
| 2 | Implement logs command with container and sync modes |
| 3 | Register in CLI entry point |
| 4 | Full check suite |
