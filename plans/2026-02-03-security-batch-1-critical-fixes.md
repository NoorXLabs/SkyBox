# Security Remediation Batch 1: Critical Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 4 CRITICAL security findings from the security audit to make DevBox safe for production use.

**Architecture:** Direct fixes to existing files. All changes follow existing patterns (escapeShellArg for shell commands, explicit file modes for fs operations). Tests validate both the fix and prevent regression.

**Tech Stack:** TypeScript, Bun test runner, Node.js fs module, existing shell.ts utilities

---

## Overview

This batch addresses the 4 CRITICAL findings that must be fixed before any production use:

| # | Finding | File | Risk |
|---|---------|------|------|
| 1 | Config file created with world-readable permissions | `src/lib/config.ts` | Credential exposure |
| 2 | Shell injection via unescaped remote paths | Multiple files | Remote code execution |
| 3 | Missing integrity verification for Mutagen downloads | `src/lib/download.ts` | Malicious binary execution |
| 4 | DevBox home directory world-accessible | `src/commands/init.ts` | Data tampering |

---

## Task 1: Fix Config File Permissions

**Files:**
- Modify: `src/lib/config.ts:46-56`
- Test: `src/lib/__tests__/config.test.ts`

### Step 1: Write the failing test

Add to `src/lib/__tests__/config.test.ts`:

```typescript
import { statSync } from "node:fs";

describe("config file permissions", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("config-permissions");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("saveConfig creates directory with mode 0o700", () => {
		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {},
			projects: {},
		};

		saveConfig(config);

		const stats = statSync(ctx.testDir);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o700);
	});

	test("saveConfig creates config file with mode 0o600", () => {
		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {},
			projects: {},
		};

		saveConfig(config);

		const configPath = join(ctx.testDir, "config.yaml");
		const stats = statSync(configPath);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o600);
	});
});
```

### Step 2: Run test to verify it fails

Run: `bun test src/lib/__tests__/config.test.ts --grep "permissions"`
Expected: FAIL (mode will be 0o755 or 0o644 instead of 0o700/0o600)

### Step 3: Write minimal implementation

Edit `src/lib/config.ts` - replace the `saveConfig` function:

```typescript
export function saveConfig(config: DevboxConfigV2): void {
	const configPath = getConfigPath();
	const dir = dirname(configPath);

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	const content = stringify(config);
	writeFileSync(configPath, content, { encoding: "utf-8", mode: 0o600 });
}
```

### Step 4: Run test to verify it passes

Run: `bun test src/lib/__tests__/config.test.ts --grep "permissions"`
Expected: PASS

### Step 5: Commit

```bash
git add src/lib/config.ts src/lib/__tests__/config.test.ts
git commit -m "$(cat <<'EOF'
fix(security): set restrictive permissions on config file

Config directory now created with 0o700 (owner-only access).
Config file now created with 0o600 (owner read/write only).

Fixes CRITICAL finding #1 from security audit.
EOF
)"
```

---

## Task 2: Fix Shell Injection in Remote Commands

**Files:**
- Modify: `src/commands/push.ts:134, 141`
- Modify: `src/commands/remote.ts:291, 309`
- Modify: `src/commands/init.ts:310`
- Modify: `src/lib/remote.ts:16-21`
- Test: `src/lib/__tests__/remote.test.ts`

### Step 1: Write the failing test

Add to `src/lib/__tests__/remote.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { escapeShellArg } from "@lib/shell.ts";

describe("shell injection prevention", () => {
	test("escapeShellArg prevents command substitution in paths", () => {
		const maliciousPath = "/home/user/$(rm -rf /)/projects";
		const escaped = escapeShellArg(maliciousPath);

		// Should be wrapped in single quotes, neutralizing $()
		expect(escaped).toBe("'/home/user/$(rm -rf /)/projects'");
		expect(escaped).not.toContain("$(rm");
	});

	test("escapeShellArg prevents backtick injection", () => {
		const maliciousPath = "/home/user/`whoami`/projects";
		const escaped = escapeShellArg(maliciousPath);

		expect(escaped).toBe("'/home/user/`whoami`/projects'");
	});
});
```

### Step 2: Run test to verify shell escaping works

Run: `bun test src/lib/__tests__/remote.test.ts --grep "injection"`
Expected: PASS (escapeShellArg already works correctly)

### Step 3: Fix push.ts - Add import and update commands

Edit `src/commands/push.ts`:

**Add import at top:**
```typescript
import { escapeShellArg } from "@lib/shell.ts";
```

**Fix line 134** - change:
```typescript
await runRemoteCommand(host, `rm -rf "${remotePath}"`);
```
to:
```typescript
await runRemoteCommand(host, `rm -rf ${escapeShellArg(remotePath)}`);
```

**Fix line 141** - change:
```typescript
const mkdirResult = await runRemoteCommand(host, `mkdir -p "${remotePath}"`);
```
to:
```typescript
const mkdirResult = await runRemoteCommand(host, `mkdir -p ${escapeShellArg(remotePath)}`);
```

### Step 4: Fix remote.ts (commands) - Update shell commands

Edit `src/commands/remote.ts`:

**Add import at top:**
```typescript
import { escapeShellArg } from "@lib/shell.ts";
```

**Fix line 291** - change:
```typescript
`ls -d "${path}" 2>/dev/null || echo "__NOT_FOUND__"`,
```
to:
```typescript
`ls -d ${escapeShellArg(path)} 2>/dev/null || echo "__NOT_FOUND__"`,
```

**Fix line 309** - change:
```typescript
`mkdir -p "${path}"`,
```
to:
```typescript
`mkdir -p ${escapeShellArg(path)}`,
```

### Step 5: Fix init.ts - Update shell commands

Edit `src/commands/init.ts`:

**Add import at top:**
```typescript
import { escapeShellArg } from "@lib/shell.ts";
```

**Fix line 291-293** - change:
```typescript
`ls -d "${basePath}" 2>/dev/null || echo "__NOT_FOUND__"`,
```
to:
```typescript
`ls -d ${escapeShellArg(basePath)} 2>/dev/null || echo "__NOT_FOUND__"`,
```

**Fix line 310** - change:
```typescript
`mkdir -p "${basePath}"`,
```
to:
```typescript
`mkdir -p ${escapeShellArg(basePath)}`,
```

**Fix line 327-328** - change:
```typescript
`ls -1 "${basePath}" 2>/dev/null | head -10`,
```
to:
```typescript
`ls -1 ${escapeShellArg(basePath)} 2>/dev/null | head -10`,
```

### Step 6: Fix remote.ts (lib) - Update shell commands

Edit `src/lib/remote.ts`:

**Add import at top:**
```typescript
import { escapeShellArg } from "@lib/shell.ts";
```

**Fix line 16-19** - change:
```typescript
const result = await runRemoteCommand(
	host,
	`test -d "${basePath}/${project}" && echo "EXISTS" || echo "NOT_FOUND"`,
);
```
to:
```typescript
const fullPath = `${basePath}/${project}`;
const result = await runRemoteCommand(
	host,
	`test -d ${escapeShellArg(fullPath)} && echo "EXISTS" || echo "NOT_FOUND"`,
);
```

### Step 7: Run all tests to verify no regressions

Run: `bun test`
Expected: All tests pass

### Step 8: Commit

```bash
git add src/commands/push.ts src/commands/remote.ts src/commands/init.ts src/lib/remote.ts
git commit -m "$(cat <<'EOF'
fix(security): escape shell args in remote commands

Replace double-quoted shell variables with escapeShellArg() to prevent
command injection via malicious remote.path config values.

Affected files:
- push.ts: rm -rf and mkdir -p commands
- remote.ts (commands): ls -d and mkdir -p commands
- init.ts: ls -d, mkdir -p, and ls -1 commands
- remote.ts (lib): test -d command

Fixes CRITICAL finding #2 from security audit.
EOF
)"
```

---

## Task 3: Add Mutagen Binary Checksum Verification

**Files:**
- Modify: `src/lib/download.ts:75-158`
- Test: `src/lib/__tests__/download.test.ts`

### Step 1: Write the failing test

Add to `src/lib/__tests__/download.test.ts`:

```typescript
import { createHash } from "node:crypto";

describe("checksum verification", () => {
	test("verifyChecksum returns true for matching hash", () => {
		const content = Buffer.from("test content");
		const expectedHash = createHash("sha256").update(content).digest("hex");

		const result = verifyChecksum(content, expectedHash);
		expect(result).toBe(true);
	});

	test("verifyChecksum returns false for mismatched hash", () => {
		const content = Buffer.from("test content");
		const wrongHash = "0".repeat(64);

		const result = verifyChecksum(content, wrongHash);
		expect(result).toBe(false);
	});

	test("verifyChecksum handles empty buffer", () => {
		const content = Buffer.from("");
		const expectedHash = createHash("sha256").update(content).digest("hex");

		const result = verifyChecksum(content, expectedHash);
		expect(result).toBe(true);
	});
});
```

### Step 2: Run test to verify it fails

Run: `bun test src/lib/__tests__/download.test.ts --grep "checksum"`
Expected: FAIL (verifyChecksum function doesn't exist)

### Step 3: Add verifyChecksum function

Add to `src/lib/download.ts` after the imports:

```typescript
import { createHash } from "node:crypto";
```

Add this function after `parseSHA256Sums`:

```typescript
/**
 * Verify a buffer's SHA256 hash matches the expected value.
 */
export function verifyChecksum(data: Buffer, expectedHash: string): boolean {
	const actualHash = createHash("sha256").update(data).digest("hex");
	return actualHash.toLowerCase() === expectedHash.toLowerCase();
}
```

### Step 4: Run test to verify verifyChecksum passes

Run: `bun test src/lib/__tests__/download.test.ts --grep "checksum"`
Expected: PASS

### Step 5: Add fetchChecksums function

Add to `src/lib/download.ts`:

```typescript
/**
 * Fetch the SHA256SUMS file for a given Mutagen version.
 */
export async function fetchChecksums(version: string): Promise<string | null> {
	const url = getMutagenChecksumUrl(version);
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		return await response.text();
	} catch {
		return null;
	}
}
```

### Step 6: Update downloadMutagen to verify checksums

Modify `downloadMutagen` function in `src/lib/download.ts`. Replace the existing function with:

```typescript
export async function downloadMutagen(
	onProgress?: (message: string) => void,
): Promise<{ success: boolean; error?: string }> {
	const platform = process.platform;
	const arch = process.arch;

	if (platform !== "darwin" && platform !== "linux") {
		return { success: false, error: `Unsupported platform: ${platform}` };
	}

	const os = platform === "darwin" ? "darwin" : "linux";
	const cpu = arch === "arm64" ? "arm64" : "amd64";
	const filename = `mutagen_${os}_${cpu}_v${MUTAGEN_VERSION}.tar.gz`;
	const url = getMutagenDownloadUrl(platform, arch, MUTAGEN_VERSION);
	const binDir = getBinDir();
	const tarPath = join(binDir, "mutagen.tar.gz");

	try {
		// Create bin directory with secure permissions
		if (!existsSync(binDir)) {
			mkdirSync(binDir, { recursive: true, mode: 0o700 });
		}

		// Fetch checksums first
		onProgress?.("Fetching checksums...");
		const checksumContent = await fetchChecksums(MUTAGEN_VERSION);
		if (!checksumContent) {
			return { success: false, error: "Failed to fetch checksums" };
		}

		const expectedHash = parseSHA256Sums(checksumContent, filename);
		if (!expectedHash) {
			return { success: false, error: `No checksum found for ${filename}` };
		}

		onProgress?.(`Downloading mutagen v${MUTAGEN_VERSION}...`);

		// Download tar.gz
		const response = await fetch(url);
		if (!response.ok) {
			return { success: false, error: `Download failed: ${response.status}` };
		}

		// Read entire response into buffer for checksum verification
		const arrayBuffer = await response.arrayBuffer();
		const downloadedBuffer = Buffer.from(arrayBuffer);

		// Verify checksum BEFORE writing to disk
		onProgress?.("Verifying checksum...");
		if (!verifyChecksum(downloadedBuffer, expectedHash)) {
			return {
				success: false,
				error: "Checksum verification failed - download may be corrupted or tampered",
			};
		}

		// Write verified file to disk
		writeFileSync(tarPath, downloadedBuffer, { mode: 0o600 });

		onProgress?.("Extracting...");

		// Extract tar.gz
		await extract({
			file: tarPath,
			cwd: binDir,
			filter: (path) => path === "mutagen" || path === "mutagen-agents.tar.gz",
		});

		// Make executable
		chmodSync(getMutagenPath(), 0o755);

		// Clean up tar file
		unlinkSync(tarPath);

		onProgress?.(`Installed mutagen v${MUTAGEN_VERSION}`);
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}
}
```

### Step 7: Add writeFileSync import

Update imports at top of `src/lib/download.ts`:

```typescript
import {
	chmodSync,
	existsSync,
	mkdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
```

### Step 8: Run all download tests

Run: `bun test src/lib/__tests__/download.test.ts`
Expected: All tests pass

### Step 9: Commit

```bash
git add src/lib/download.ts src/lib/__tests__/download.test.ts
git commit -m "$(cat <<'EOF'
fix(security): verify Mutagen binary checksums before execution

- Add verifyChecksum() function using SHA256
- Add fetchChecksums() to retrieve SHA256SUMS from GitHub
- downloadMutagen() now verifies checksum before extraction
- Download into memory first, verify, then write to disk
- Fail fast if checksums unavailable or mismatched

Fixes CRITICAL finding #3 from security audit.
EOF
)"
```

---

## Task 4: Fix DevBox Home Directory Permissions

**Files:**
- Modify: `src/commands/init.ts:458-459`
- Test: `src/commands/__tests__/init.test.ts` (create if needed)

### Step 1: Write the failing test

Create `src/commands/__tests__/init-permissions.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";
import { getBinDir, getProjectsDir } from "@lib/paths.ts";

describe("init directory permissions", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("init-permissions");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("projects directory created with mode 0o700", () => {
		const projectsDir = getProjectsDir();
		mkdirSync(projectsDir, { recursive: true, mode: 0o700 });

		const stats = statSync(projectsDir);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o700);
	});

	test("bin directory created with mode 0o700", () => {
		const binDir = getBinDir();
		mkdirSync(binDir, { recursive: true, mode: 0o700 });

		const stats = statSync(binDir);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o700);
	});
});
```

### Step 2: Run test to verify pattern works

Run: `bun test src/commands/__tests__/init-permissions.test.ts`
Expected: PASS (test validates the pattern we'll use)

### Step 3: Update init.ts to use secure permissions

Edit `src/commands/init.ts` lines 457-459:

**Before:**
```typescript
// Create directories
header("Setting up devbox...");
try {
	mkdirSync(getProjectsDir(), { recursive: true });
	mkdirSync(getBinDir(), { recursive: true });
```

**After:**
```typescript
// Create directories with secure permissions
header("Setting up devbox...");
try {
	mkdirSync(getProjectsDir(), { recursive: true, mode: 0o700 });
	mkdirSync(getBinDir(), { recursive: true, mode: 0o700 });
```

### Step 4: Run tests to verify no regressions

Run: `bun test`
Expected: All tests pass

### Step 5: Commit

```bash
git add src/commands/init.ts src/commands/__tests__/init-permissions.test.ts
git commit -m "$(cat <<'EOF'
fix(security): create devbox directories with 0o700 permissions

Projects and bin directories under ~/.devbox are now created with
owner-only access (0o700) instead of default world-readable permissions.

Fixes CRITICAL finding #4 from security audit.
EOF
)"
```

---

## Final Verification

### Step 1: Run full test suite

Run: `bun test`
Expected: All tests pass

### Step 2: Run type check

Run: `bun run typecheck`
Expected: No errors

### Step 3: Run linter

Run: `bun run check`
Expected: No errors

### Step 4: Review all changes

Run: `git diff main --stat`

Expected files changed:
- `src/lib/config.ts`
- `src/lib/__tests__/config.test.ts`
- `src/commands/push.ts`
- `src/commands/remote.ts`
- `src/commands/init.ts`
- `src/lib/remote.ts`
- `src/lib/__tests__/remote.test.ts`
- `src/lib/download.ts`
- `src/lib/__tests__/download.test.ts`
- `src/commands/__tests__/init-permissions.test.ts`

---

## Summary

This plan addresses all 4 CRITICAL security findings:

1. **Config file permissions** - Now 0o600 for file, 0o700 for directory
2. **Shell injection** - All remote paths now use `escapeShellArg()`
3. **Binary integrity** - Mutagen downloads verified against SHA256 checksums
4. **Directory permissions** - DevBox home directories now 0o700

After completing this batch, proceed to the SHORT-TERM findings (5, 6, 9, 10) in batch 2.
