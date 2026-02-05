# Update Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `skybox update` to check for and install updates to the Mutagen binary and (optionally) the SkyBox CLI itself.

**Architecture:** New command that checks the current installed Mutagen version against the latest GitHub release. If newer, downloads and replaces the binary using the existing `downloadMutagen()` flow. For CLI self-update, check npm registry (future — defer to v1.0).

**Tech Stack:** Commander.js, existing download.ts, GitHub API via fetch, semver comparison.

---

### Task 1: Write failing test

**Files:**
- Create: `src/commands/__tests__/update.test.ts`

**Step 1: Write the test**

```typescript
import { describe, test, expect } from "bun:test";

describe("update command", () => {
	test("module exports updateCommand function", async () => {
		const mod = await import("../update.ts");
		expect(typeof mod.updateCommand).toBe("function");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/commands/__tests__/update.test.ts`
Expected: FAIL

**Step 3: Commit**

```bash
git add src/commands/__tests__/update.test.ts
git commit -m "test: add update command test scaffold"
```

---

### Task 2: Add version check helper

**Files:**
- Modify: `src/lib/download.ts`

**Step 1: Add function to get installed Mutagen version**

```typescript
export async function getInstalledMutagenVersion(): Promise<string | null> {
	const mutagenPath = getMutagenPath();
	if (!existsSync(mutagenPath)) return null;
	try {
		const { stdout } = await execa(mutagenPath, ["version"]);
		return stdout.trim();
	} catch {
		return null;
	}
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/download.ts
git commit -m "feat: add getInstalledMutagenVersion helper"
```

---

### Task 3: Create update command

**Files:**
- Create: `src/commands/update.ts`

**Step 1: Implement the command**

```typescript
import { MUTAGEN_VERSION } from "../lib/constants.ts";
import { downloadMutagen, getInstalledMutagenVersion } from "../lib/download.ts";
import { success, error, info, spinner } from "../lib/ui.ts";
import { getErrorMessage } from "../lib/errors.ts";

export async function updateCommand(): Promise<void> {
	info("Checking for updates...\n");

	// Check Mutagen
	const installedVersion = await getInstalledMutagenVersion();
	const targetVersion = MUTAGEN_VERSION;

	if (!installedVersion) {
		info("Mutagen not installed. Installing...");
	} else if (installedVersion === targetVersion) {
		success(`Mutagen is up to date (v${targetVersion}).`);
		return;
	} else {
		info(`Mutagen: v${installedVersion} → v${targetVersion}`);
	}

	const s = spinner("Downloading Mutagen...");
	try {
		await downloadMutagen((progress) => {
			s.text = `Downloading Mutagen... ${progress}`;
		});
		s.succeed(`Mutagen updated to v${targetVersion}.`);
	} catch (err) {
		s.fail(`Update failed: ${getErrorMessage(err)}`);
	}
}
```

**Step 2: Run test**

Run: `bun test src/commands/__tests__/update.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/update.ts
git commit -m "feat: add update command for Mutagen binary"
```

---

### Task 4: Register command in CLI

**Files:**
- Modify: `src/index.ts`

**Step 1: Add registration**

```typescript
import { updateCommand } from "./commands/update.ts";

program
	.command("update")
	.description("Update Mutagen binary to latest bundled version")
	.action(updateCommand);
```

**Step 2: Run full check suite**

Run: `bun run check && bun run typecheck && bun test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: register update command in CLI"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Test scaffold |
| 2 | Add version check helper to download.ts |
| 3 | Implement update command |
| 4 | Register in CLI and full check |
