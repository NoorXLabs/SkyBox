# Phase 5: Documentation & Configuration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete remaining documentation, configuration hardening, and minor fix tasks (Tasks 43-55 from IMPLEMENTATION.md).

**Architecture:** Incremental improvements across config files, TypeScript settings, and source code. Each task is independent and can be committed separately.

**Tech Stack:** Bun, TypeScript 5.9, Biome 2.3, Lefthook

---

## Task 43: Add missing package.json fields

**Files:**
- Modify: `package.json`

**Step 1: Add missing fields**

Add the following fields to `package.json`. Note: `description`, `repository`, `bugs`, `homepage`, and `license` already exist. Add the missing ones:

```json
{
  "author": "Noor Chasib",
  "engines": {
    "bun": ">=1.0.0"
  },
  "keywords": [
    "skybox",
    "devcontainer",
    "docker",
    "remote-development",
    "sync",
    "mutagen",
    "cli"
  ]
}
```

Add `author` after `license`, `engines` after `type`, and `keywords` after `homepage`.

**Step 2: Verify JSON is valid**

Run: `bun run dev --help`
Expected: CLI help output displays without errors

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add missing package.json fields (author, engines, keywords)"
```

---

## Task 44: Add stricter TypeScript flags

**Files:**
- Modify: `tsconfig.json`

**Step 1: Add stricter flags**

Add these to `compilerOptions`:

```json
{
  "compilerOptions": {
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Step 2: Run typecheck and fix any errors**

Run: `bun run typecheck`

`exactOptionalPropertyTypes` is the most likely to cause errors. It enforces that optional properties (`foo?: string`) cannot be assigned `undefined` explicitly - you must omit the property instead. If this causes too many errors, remove it and note in IMPLEMENTATION.md.

`noUnusedLocals` and `noUnusedParameters` will flag unused variables. Prefix unused parameters with `_` (e.g., `_options`).

**Step 3: Fix all type errors iteratively**

For each error:
- Unused parameter: prefix with `_`
- Unused local: remove or prefix with `_`
- `exactOptionalPropertyTypes` violation: change `prop = undefined` to `delete obj.prop` or omit the property

**Step 4: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add tsconfig.json src/
git commit -m "chore: add stricter TypeScript compiler flags"
```

---

## Task 45: Add glob filter to Lefthook test hook

**Files:**
- Modify: `lefthook.yml`

**Step 1: Add glob filter**

Change the `test` command to only run when source files change:

```yaml
pre-commit:
  piped: true
  commands:
    check:
      priority: 1
      glob: "*.{js,ts,json}"
      run: bun run check
      stage_fixed: true
    typecheck:
      priority: 2
      run: bun run typecheck
    test:
      priority: 3
      glob: "src/**/*.{ts,test.ts}"
      run: bun run test
```

**Step 2: Verify Lefthook config is valid**

Run: `bunx lefthook run pre-commit --dry-run`
Expected: Shows the commands that would run without errors

**Step 3: Commit**

```bash
git add lefthook.yml
git commit -m "chore: add glob filter to Lefthook test hook"
```

---

## Task 46: Add JSDoc to complex types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add JSDoc comments to undocumented types**

Add JSDoc to types that lack documentation. Do NOT add trivial comments that just repeat the type name. Focus on types where the purpose or usage isn't obvious:

```typescript
/** SSH host entry parsed from ~/.ssh/config */
export interface SSHHost { ... }

/** Fully resolved SSH config entry with all fields required for connection */
export interface SSHConfigEntry { ... }

/** Legacy single-remote config (V1). Superseded by SkyboxConfigV2. */
export interface RemoteConfig { ... }

/** Default sync behavior and ignore patterns applied to all projects */
export interface SyncDefaults { ... }

/** Per-project overrides for sync and editor settings (V1) */
export interface ProjectConfig { ... }

/** Legacy config format (V1). Auto-migrated to SkyboxConfigV2 on load. */
export interface SkyboxConfig { ... }

/** A single remote server connection. Used as values in SkyboxConfigV2.remotes. */
export interface RemoteEntry { ... }

/** Current config format supporting multiple remotes */
export interface SkyboxConfigV2 { ... }

/** Per-project config (V2) referencing a named remote */
export interface ProjectConfigV2 { ... }

/** Summary view of a project shown by `skybox list` and `skybox status` */
export interface ProjectSummary { ... }

/** Detailed container info shown by `skybox status <project>` */
export interface ContainerDetails { ... }

/** Detailed sync session info shown by `skybox status <project>` */
export interface SyncDetails { ... }

/** Git working tree status for a project */
export interface GitDetails { ... }

/** Lock file contents stored on the remote server */
export interface LockInfo { ... }

/**
 * Lock status discriminated union.
 * When locked=true, includes owner info and whether current machine holds it.
 */
export type LockStatus = ...;

/** Result of a `skybox doctor` health check */
export interface DoctorCheckResult { ... }
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (JSDoc doesn't affect types)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "docs: add JSDoc to complex types in index.ts"
```

---

## Task 47: Add file-level documentation

**Files:**
- Modify: All `src/lib/*.ts` files that lack a file-level comment

**Step 1: Check which files already have file headers**

Files that already have headers: `shell.ts`, `test-utils.ts`. Add headers to the rest.

**Step 2: Add concise file headers**

Format (keep it to 1-2 lines, no fluff):

```typescript
// src/lib/config.ts
/** YAML config file operations: load, save, query remotes and projects. */

// src/lib/container.ts
/** Docker container operations: query, start, stop, inspect. */

// src/lib/mutagen.ts
/** Mutagen sync session management: create, pause, resume, terminate. */

// src/lib/ssh.ts
/** SSH operations: parse config, test connections, run remote commands. */

// src/lib/lock.ts
/** Multi-machine lock system using atomic remote file operations. */

// src/lib/remote.ts
/** Remote server project operations: check existence, list projects. */

// src/lib/project.ts
/** Local project path resolution and validation. */

// src/lib/download.ts
/** Mutagen binary download and installation. */

// src/lib/templates.ts
/** Devcontainer template definitions and generation. */

// src/lib/migration.ts
/** Config format migration from V1 (single remote) to V2 (multi-remote). */

// src/lib/paths.ts
/** Centralized path computation for SkyBox directories and binaries. */

// src/lib/errors.ts
/** Error handling utilities: safe message extraction and type guards. */

// src/lib/ui.ts
/** Terminal UI helpers: colored output, spinners, headers. */

// src/lib/startup.ts
/** Dependency checks run at CLI startup. */

// src/lib/constants.ts
/** Shared constants: Docker labels, default values. */
```

Add as the first line after any existing imports comment, before imports. If a `/** @file ... */` block already exists, skip that file.

**Step 3: Run format check**

Run: `bun run check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/
git commit -m "docs: add file-level documentation headers to lib modules"
```

---

## Task 48: Document constants and magic values

**Files:**
- Modify: `src/lib/constants.ts`, `src/lib/ssh.ts`, `src/lib/download.ts`, `src/lib/mutagen.ts`

**Step 1: Add comments to unexplained constants**

In `download.ts`:
```typescript
/** Pinned Mutagen version. Update requires testing sync compatibility. */
const MUTAGEN_VERSION = "0.17.5";
```

In `ssh.ts` - already has `SSH_TIMEOUT_MS` documented. Check for any remaining magic values.

In `constants.ts` - read file and add JSDoc to any undocumented exports.

In `mutagen.ts` - check for any hardcoded timeout values or retry counts.

**Step 2: Run format check**

Run: `bun run check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/
git commit -m "docs: document constants and magic values"
```

---

## Task 49: Expand shell escaping utility

**Files:**
- Modify: `src/lib/shell.ts`
- Modify: `src/lib/__tests__/shell.test.ts`

**Step 1: Write failing test for `buildShellCommand`**

```typescript
import { buildShellCommand, escapeShellArg } from "../shell.ts";

test("buildShellCommand joins args with escaping", () => {
	const result = buildShellCommand("ssh", ["host", "echo", "hello world"]);
	expect(result).toBe("ssh 'host' 'echo' 'hello world'");
});

test("buildShellCommand handles empty args", () => {
	const result = buildShellCommand("ls", []);
	expect(result).toBe("ls");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/shell.test.ts`
Expected: FAIL - `buildShellCommand` not found

**Step 3: Implement `buildShellCommand`**

Add to `src/lib/shell.ts`:

```typescript
/**
 * Builds a shell command string with properly escaped arguments.
 */
export function buildShellCommand(command: string, args: string[]): string {
	if (args.length === 0) return command;
	return `${command} ${args.map(escapeShellArg).join(" ")}`;
}
```

**Step 4: Run tests**

Run: `bun test src/lib/__tests__/shell.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/shell.ts src/lib/__tests__/shell.test.ts
git commit -m "feat: add buildShellCommand utility"
```

---

## Task 50: Add path traversal prevention

**Files:**
- Create: `src/lib/validation.ts`
- Create: `src/lib/__tests__/validation.test.ts`

**Step 1: Write failing tests**

```typescript
import { describe, expect, test } from "bun:test";
import { isPathTraversal, validatePath } from "../validation.ts";

describe("path traversal prevention", () => {
	test("isPathTraversal detects ../", () => {
		expect(isPathTraversal("../etc/passwd")).toBe(true);
	});

	test("isPathTraversal detects embedded ../", () => {
		expect(isPathTraversal("foo/../../../etc/passwd")).toBe(true);
	});

	test("isPathTraversal detects ..\\", () => {
		expect(isPathTraversal("..\\windows\\system32")).toBe(true);
	});

	test("isPathTraversal allows normal paths", () => {
		expect(isPathTraversal("my-project")).toBe(false);
	});

	test("isPathTraversal allows nested normal paths", () => {
		expect(isPathTraversal("src/lib/config.ts")).toBe(false);
	});

	test("isPathTraversal detects bare ..", () => {
		expect(isPathTraversal("..")).toBe(true);
	});

	test("validatePath returns valid for safe path", () => {
		const result = validatePath("my-project");
		expect(result.valid).toBe(true);
	});

	test("validatePath returns invalid for traversal", () => {
		const result = validatePath("../secret");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("path traversal");
	});

	test("validatePath returns invalid for absolute path", () => {
		const result = validatePath("/etc/passwd");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("absolute");
	});

	test("validatePath returns invalid for empty string", () => {
		const result = validatePath("");
		expect(result.valid).toBe(false);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/validation.test.ts`
Expected: FAIL - module not found

**Step 3: Implement validation.ts**

```typescript
// src/lib/validation.ts
/** Input validation utilities: path safety, traversal prevention. */

/**
 * Check if a path contains directory traversal sequences.
 */
export function isPathTraversal(path: string): boolean {
	const normalized = path.replace(/\\/g, "/");
	const segments = normalized.split("/");
	return segments.some((s) => s === "..");
}

/**
 * Validate a path is safe for use as a project path.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validatePath(
	path: string,
): { valid: true } | { valid: false; error: string } {
	if (!path || path.trim() === "") {
		return { valid: false, error: "Path cannot be empty" };
	}

	if (path.startsWith("/")) {
		return { valid: false, error: "Path cannot be absolute" };
	}

	if (isPathTraversal(path)) {
		return { valid: false, error: "Path contains path traversal sequences" };
	}

	return { valid: true };
}
```

**Step 4: Run tests**

Run: `bun test src/lib/__tests__/validation.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/__tests__/validation.test.ts
git commit -m "feat: add path traversal prevention utilities"
```

---

## Task 51: Implement download checksum verification

**Files:**
- Modify: `src/lib/download.ts`
- Modify: `src/lib/__tests__/download.test.ts`

**Step 1: Write failing test for checksum parsing**

```typescript
import { parseSHA256Sums } from "../download.ts";

test("parseSHA256Sums extracts hash for matching filename", () => {
	const content = [
		"abc123  mutagen_darwin_arm64_v0.17.5.tar.gz",
		"def456  mutagen_linux_amd64_v0.17.5.tar.gz",
	].join("\n");
	const hash = parseSHA256Sums(content, "mutagen_darwin_arm64_v0.17.5.tar.gz");
	expect(hash).toBe("abc123");
});

test("parseSHA256Sums returns null for no match", () => {
	const content = "abc123  other_file.tar.gz\n";
	const hash = parseSHA256Sums(content, "mutagen_darwin_arm64_v0.17.5.tar.gz");
	expect(hash).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/download.test.ts`
Expected: FAIL - `parseSHA256Sums` not found

**Step 3: Implement checksum parsing**

Add to `src/lib/download.ts`:

```typescript
/**
 * Parse a SHA256SUMS file and extract the hash for a given filename.
 * Format: "<hash>  <filename>" (two spaces between hash and filename).
 */
export function parseSHA256Sums(
	content: string,
	filename: string,
): string | null {
	for (const line of content.split("\n")) {
		const parts = line.trim().split(/\s+/);
		if (parts.length === 2 && parts[1] === filename) {
			return parts[0];
		}
	}
	return null;
}
```

**Step 4: Run tests**

Run: `bun test src/lib/__tests__/download.test.ts`
Expected: All PASS

**Step 5: Add checksum verification to downloadMutagen**

In the `downloadMutagen` function, after downloading and before extracting, add:

```typescript
// Verify checksum
onProgress?.("Verifying checksum...");
const checksumUrl = getMutagenChecksumUrl(MUTAGEN_VERSION);
const checksumResponse = await fetch(checksumUrl);
if (checksumResponse.ok) {
	const checksumContent = await checksumResponse.text();
	const os = platform === "darwin" ? "darwin" : "linux";
	const cpu = arch === "arm64" ? "arm64" : "amd64";
	const expectedFilename = `mutagen_${os}_${cpu}_v${MUTAGEN_VERSION}.tar.gz`;
	const expectedHash = parseSHA256Sums(checksumContent, expectedFilename);

	if (expectedHash) {
		const file = Bun.file(tarPath);
		const hasher = new Bun.CryptoHasher("sha256");
		hasher.update(await file.arrayBuffer());
		const actualHash = hasher.digest("hex");

		if (actualHash !== expectedHash) {
			unlinkSync(tarPath);
			return {
				success: false,
				error: `Checksum mismatch: expected ${expectedHash}, got ${actualHash}`,
			};
		}
	}
}
```

Insert this between the file write promise and the `onProgress?.("Extracting...")` line.

**Step 6: Run all tests**

Run: `bun test`
Expected: All PASS

**Step 7: Commit**

```bash
git add src/lib/download.ts src/lib/__tests__/download.test.ts
git commit -m "feat: add download checksum verification for Mutagen"
```

---

## Task 52: Fix inconsistent inquirer separators

**Files:**
- Modify: `src/commands/new.ts`

**Step 1: Identify the inconsistency**

In `src/commands/new.ts`, there are three separators:
- Line 148: `new Separator("──── Built-in ────")`
- Line 156: `new Separator("──── Custom ────")`
- Line 163: `new Separator("────────────────")`

The third separator uses a different style (no label, just dashes).

**Step 2: Standardize separators**

Change line 163 to use the same labeled style:

```typescript
choices.push(new Separator("──── Other ────"));
```

**Step 3: Run format check**

Run: `bun run check`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/new.ts
git commit -m "fix: standardize inquirer separator styles in new command"
```

---

## Task 53: Add debug logging for silent errors

**Files:**
- Modify: `src/commands/list.ts`

**Step 1: Add debug logging to getGitBranch**

Replace the empty catch block:

```typescript
async function getGitBranch(projectPath: string): Promise<string> {
	try {
		const result = await execa("git", [
			"-C",
			projectPath,
			"branch",
			"--show-current",
		]);
		return result.stdout.trim() || "-";
	} catch (err) {
		if (process.env.DEBUG) {
			console.error(`[debug] getGitBranch failed for ${projectPath}:`, err);
		}
		return "-";
	}
}
```

Also add debug logging to the inner try/catch in `getLocalProjects`:

```typescript
} catch (err) {
	if (process.env.DEBUG) {
		console.error(`[debug] stat failed for ${fullPath}:`, err);
	}
}
```

**Step 2: Verify it works**

Run: `DEBUG=1 bun run dev list`
Expected: Debug output appears if there are any errors (or no extra output if all succeeds)

**Step 3: Commit**

```bash
git add src/commands/list.ts
git commit -m "feat: add debug logging for silent errors in list command"
```

---

## Task 54: Document error message function usage

**Files:**
- Modify: `src/lib/errors.ts`

**Step 1: Enhance existing JSDoc**

The file already has JSDoc. Expand the descriptions to clarify when to use each:

```typescript
/**
 * Safely extract an error message from an unknown error type.
 * Use in catch blocks for general errors (filesystem, validation, etc.).
 *
 * @example
 * try { readFileSync(path); } catch (err) { console.error(getErrorMessage(err)); }
 */
export function getErrorMessage(error: unknown): string { ... }

/**
 * Safely extract an error message from execa errors.
 * Prefers stderr over message since command errors often have more detail there.
 * Use in catch blocks where the error comes from execa (SSH, Docker, git, etc.).
 *
 * @example
 * try { await execa("ssh", args); } catch (err) { return getExecaErrorMessage(err); }
 */
export function getExecaErrorMessage(error: unknown): string { ... }
```

**Step 2: Run format check**

Run: `bun run check`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/errors.ts
git commit -m "docs: clarify when to use each error message function"
```

---

## Task 55: Notify user of config auto-migration

**Files:**
- Modify: `src/lib/config.ts`

**Step 1: Add migration notification**

In `loadConfig()`, after the migration block, log a message. Since `ui.ts` may not be safe to import everywhere (circular deps), use `console.error` with a prefix:

```typescript
if (needsMigration(rawConfig)) {
	const migrated = migrateConfig(rawConfig as SkyboxConfig);
	saveConfig(migrated);
	console.error(
		"\x1b[33m[skybox]\x1b[0m Config auto-migrated from V1 to V2 format.",
	);
	return migrated;
}
```

This uses ANSI yellow for the prefix. `console.error` is used so it goes to stderr and doesn't interfere with stdout piping.

**Step 2: Verify migration notification**

Create a V1 config manually and run any command to trigger migration. Verify the yellow message appears.

**Step 3: Run tests**

Run: `bun test src/lib/__tests__/config.test.ts`
Expected: All PASS (the `console.error` call won't affect test assertions)

**Step 4: Commit**

```bash
git add src/lib/config.ts
git commit -m "feat: notify user when config is auto-migrated"
```

---

## Pre-Implementation Notes

- **Task independence:** All tasks are independent. Work in any order. Tasks 44 (TypeScript flags) may cause cascading fixes, so do it when you have time to address type errors.
- **Test after every change:** Run `bun test` after each commit to catch regressions.
- **Read before edit:** Always read the current file contents before modifying. The code shown in this plan is based on the codebase as of 2026-01-28 and may have changed.
- **Biome formatting:** Run `bun run check` before committing to ensure Biome formatting/linting passes.
