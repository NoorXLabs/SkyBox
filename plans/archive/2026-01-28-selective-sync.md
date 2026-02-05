# Selective Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow syncing specific subdirectories for large monorepos instead of the entire project.

**Architecture:** Add a `sync_paths` option to project config that specifies which subdirectories to sync. When set, create separate Mutagen sync sessions per path (or use Mutagen's `--path` flag if supported). Falls back to full-project sync when not configured.

**Tech Stack:** Commander.js (config subcommand), Mutagen sync with path filtering, existing config.ts and mutagen.ts.

---

### Task 1: Add sync_paths to project config type

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Update ProjectConfigV2**

```typescript
export interface ProjectConfigV2 {
	remote: string;
	ignore?: string[];
	editor?: string;
	sync_paths?: string[];  // e.g., ["packages/frontend", "packages/shared"]
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add sync_paths to ProjectConfigV2"
```

---

### Task 2: Write failing test for sync path session naming

**Files:**
- Create: `src/lib/__tests__/mutagen-selective.test.ts`

**Step 1: Write test**

```typescript
import { describe, test, expect } from "bun:test";
import { sessionName } from "../mutagen.ts";

describe("selective sync session naming", () => {
	test("sessionName produces valid name for project", () => {
		const name = sessionName("my-project");
		expect(name).toBe("skybox-my-project");
	});

	test("selective session name includes subpath", () => {
		// We'll add a helper: selectiveSessionName(project, subpath)
		const { selectiveSessionName } = require("../mutagen.ts");
		const name = selectiveSessionName("my-project", "packages/frontend");
		expect(name).toBe("skybox-my-project-packages-frontend");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/mutagen-selective.test.ts`
Expected: FAIL on second test — function not found

**Step 3: Implement selectiveSessionName**

In `src/lib/mutagen.ts`, add:

```typescript
export function selectiveSessionName(project: string, subpath: string): string {
	const sanitizedProject = project.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
	const sanitizedPath = subpath.replace(/[^a-z0-9-_]/gi, "-").toLowerCase();
	return `skybox-${sanitizedProject}-${sanitizedPath}`;
}
```

**Step 4: Run test**

Run: `bun test src/lib/__tests__/mutagen-selective.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/mutagen.ts src/lib/__tests__/mutagen-selective.test.ts
git commit -m "feat(mutagen): add selectiveSessionName for path-scoped sync"
```

---

### Task 3: Add createSelectiveSyncSessions helper

**Files:**
- Modify: `src/lib/mutagen.ts`

**Step 1: Write failing test**

Add to `src/lib/__tests__/mutagen-selective.test.ts`:

```typescript
test("createSelectiveSyncSessions is exported", async () => {
	const mod = await import("../mutagen.ts");
	expect(typeof mod.createSelectiveSyncSessions).toBe("function");
});
```

**Step 2: Implement**

In `src/lib/mutagen.ts`:

```typescript
export async function createSelectiveSyncSessions(
	project: string,
	localPath: string,
	remoteHost: string,
	remotePath: string,
	syncPaths: string[],
	ignores: string[],
): Promise<void> {
	for (const subpath of syncPaths) {
		const name = selectiveSessionName(project, subpath);
		const localSubpath = join(localPath, subpath);
		const remoteSubpath = `${remotePath}/${subpath}`;

		await executeMutagenCommand([
			"sync",
			"create",
			localSubpath,
			`${remoteHost}:${remoteSubpath}`,
			"--name",
			name,
			"--sync-mode",
			"two-way-resolved",
			...ignores.flatMap((i) => ["--ignore", i]),
		]);
	}
}
```

Add `import { join } from "node:path";` at the top if not present.

**Step 3: Run test**

Run: `bun test src/lib/__tests__/mutagen-selective.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/mutagen.ts src/lib/__tests__/mutagen-selective.test.ts
git commit -m "feat(mutagen): add createSelectiveSyncSessions for subdirectory sync"
```

---

### Task 4: Integrate selective sync into up command

**Files:**
- Modify: `src/commands/up.ts`

**Step 1: Update sync creation logic**

In the `upCommand` function, where `createSyncSession` is called, add a branch:

```typescript
import { createSelectiveSyncSessions } from "../lib/mutagen.ts";

// Where sync session is created:
const projectConfig = config.projects[project];
if (projectConfig?.sync_paths && projectConfig.sync_paths.length > 0) {
	await createSelectiveSyncSessions(
		project,
		projectPath,
		remoteHost,
		remotePath,
		projectConfig.sync_paths,
		ignores,
	);
} else {
	await createSyncSession(project, projectPath, remoteHost, remotePath, ignores);
}
```

**Step 2: Run all tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/up.ts
git commit -m "feat(up): use selective sync when sync_paths configured"
```

---

### Task 5: Add config command for managing sync paths

**Files:**
- Modify: `src/commands/config.ts`

**Step 1: Add sync-paths subcommand**

```typescript
case "sync-paths": {
	const project = arg1;
	if (!project) {
		error("Usage: skybox config sync-paths <project> [path1,path2,...]");
		return;
	}
	const config = loadConfig();
	if (!config.projects[project]) {
		error(`Project "${project}" not found in config.`);
		return;
	}
	if (arg2) {
		config.projects[project].sync_paths = arg2.split(",").map((p) => p.trim());
		saveConfig(config);
		success(`Set sync paths for "${project}": ${config.projects[project].sync_paths.join(", ")}`);
	} else {
		const paths = config.projects[project].sync_paths;
		if (paths && paths.length > 0) {
			info(`Sync paths for "${project}": ${paths.join(", ")}`);
		} else {
			info(`No selective sync paths set for "${project}" (syncing entire project).`);
		}
	}
	break;
}
```

**Step 2: Run all tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/config.ts
git commit -m "feat(config): add sync-paths subcommand for selective sync"
```

---

### Task 6: Run full check suite

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add sync_paths to project config type |
| 2 | Add selectiveSessionName helper with tests |
| 3 | Add createSelectiveSyncSessions helper |
| 4 | Integrate into up command |
| 5 | Add config command for managing sync paths |
| 6 | Full check suite |
