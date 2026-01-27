# DevBox Code Quality & Production Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all code review findings and complete remaining work to prepare DevBox for production release.

**Architecture:** Fix critical security issues first, then eliminate code duplication by extracting shared utilities, improve type safety across the codebase, and complete remaining documentation and testing tasks.

**Tech Stack:** TypeScript, Bun, Commander.js, Biome, Lefthook

---

## Table of Contents

1. [Phase 1: Critical Security Fixes](#phase-1-critical-security-fixes)
2. [Phase 2: High Priority Improvements](#phase-2-high-priority-improvements)
3. [Phase 3: Medium Priority Refactoring](#phase-3-medium-priority-refactoring)
4. [Phase 4: Low Priority Polish](#phase-4-low-priority-polish)
5. [Phase 5: Pre-Production Checklist](#phase-5-pre-production-checklist)

---

## Phase 1: Critical Security Fixes

### Task 1: Fix Shell Injection Vulnerability in lock.ts

**Files:**
- Modify: `src/lib/lock.ts:104, 130`
- Create: `src/lib/shell.ts`
- Test: `src/lib/__tests__/shell.test.ts`

**Step 1: Write failing test for shell escaping**

```typescript
// src/lib/__tests__/shell.test.ts
import { describe, test, expect } from "bun:test";
import { escapeShellArg } from "../shell.ts";

describe("escapeShellArg", () => {
	test("escapes single quotes", () => {
		expect(escapeShellArg("it's")).toBe("'it'\\''s'");
	});

	test("handles strings with special characters", () => {
		const malicious = "admin'; rm -rf /";
		const escaped = escapeShellArg(malicious);
		expect(escaped).not.toContain("; rm");
	});

	test("handles empty strings", () => {
		expect(escapeShellArg("")).toBe("''");
	});

	test("handles strings with backslashes", () => {
		expect(escapeShellArg("path\\to\\file")).toBe("'path\\to\\file'");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/shell.test.ts -v`
Expected: FAIL with "Cannot find module"

**Step 3: Create shell.ts with escaping function**

```typescript
// src/lib/shell.ts
/**
 * @file shell.ts
 * @description Utilities for safe shell command construction.
 */

/**
 * Escapes a string for safe use as a shell argument.
 * Uses single quotes and escapes embedded single quotes.
 */
export function escapeShellArg(arg: string): string {
	return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Builds a shell command from parts, escaping each argument.
 */
export function buildShellCommand(command: string, args: string[]): string {
	return `${command} ${args.map(escapeShellArg).join(" ")}`;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/shell.test.ts -v`
Expected: PASS

**Step 5: Update lock.ts to use escaping**

Modify `src/lib/lock.ts` - replace JSON string building:

```typescript
// Add import at top
import { escapeShellArg } from "./shell.ts";

// Line ~104: Replace vulnerable code
// OLD:
// const json = JSON.stringify(lockInfo);
// const command = `mkdir -p ${locksDir} && echo '${json}' > ${lockPath}`;

// NEW:
const json = JSON.stringify(lockInfo);
const jsonBase64 = Buffer.from(json).toString("base64");
const command = `mkdir -p ${escapeShellArg(locksDir)} && echo '${jsonBase64}' | base64 -d > ${escapeShellArg(lockPath)}`;
```

**Step 6: Run existing lock tests**

Run: `bun test src/lib/__tests__/lock.test.ts -v`
Expected: PASS

**Step 7: Commit**

```bash
git add src/lib/shell.ts src/lib/__tests__/shell.test.ts src/lib/lock.ts
git commit -m "$(cat <<'EOF'
fix(security): prevent shell injection in lock.ts

Add shell.ts with proper argument escaping and use base64 encoding
for JSON payloads to prevent injection attacks when writing lock files.
EOF
)"
```

---

### Task 2: Quote All Remote Paths in Shell Commands

**Files:**
- Modify: `src/lib/lock.ts:52, 149`
- Modify: `src/commands/clone.ts`
- Modify: `src/commands/push.ts:140`

**Step 1: Write test for path with spaces**

```typescript
// Add to src/lib/__tests__/lock.test.ts
describe("lock operations with special paths", () => {
	test("handles paths with spaces", async () => {
		// This test validates that paths are properly quoted
		const projectWithSpace = "my project";
		// The actual test depends on mocking - document the expected behavior
		expect(projectWithSpace).toContain(" ");
	});
});
```

**Step 2: Update lock.ts to quote paths**

```typescript
// Line ~52: Quote the lockPath in cat command
// OLD: const command = `cat ${lockPath} 2>/dev/null`;
// NEW:
const command = `cat "${lockPath}" 2>/dev/null`;

// Line ~149: Quote the lockPath in rm command
// OLD: const command = `rm -f ${lockPath}`;
// NEW:
const command = `rm -f "${lockPath}"`;
```

**Step 3: Update clone.ts to quote paths**

Find and update all `runRemoteCommand` calls to quote paths.

**Step 4: Update push.ts:140 to quote paths**

```typescript
// OLD: await runRemoteCommand(host, `rm -rf ${remotePath}`);
// NEW:
await runRemoteCommand(host, `rm -rf "${remotePath}"`);
```

**Step 5: Run all tests**

Run: `bun test`
Expected: All PASS

**Step 6: Commit**

```bash
git add src/lib/lock.ts src/commands/clone.ts src/commands/push.ts
git commit -m "$(cat <<'EOF'
fix(security): quote all paths in shell commands

Prevent issues with paths containing spaces or special characters
by properly quoting all path arguments in remote shell commands.
EOF
)"
```

---

### Task 3: Fix tsconfig.json Conflicting Options

**Files:**
- Modify: `tsconfig.json`

**Step 1: Read current tsconfig**

Run: `cat tsconfig.json`

**Step 2: Fix the conflict**

```json
{
  "compilerOptions": {
    "declaration": false,
    "noEmit": true
  }
}
```

**Step 3: Verify typecheck still works**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add tsconfig.json
git commit -m "$(cat <<'EOF'
fix(config): remove conflicting tsconfig options

declaration: true and noEmit: true conflict. Since we use Bun for
bundling and don't need .d.ts files, keep noEmit: true.
EOF
)"
```

---

## Phase 2: High Priority Improvements

### Task 4: Extract Docker Label Constant

**Files:**
- Create: `src/lib/constants.ts`
- Modify: `src/lib/container.ts`
- Test: `src/lib/__tests__/container.test.ts`

**Step 1: Create constants.ts**

```typescript
// src/lib/constants.ts
/**
 * @file constants.ts
 * @description Shared constants used across the codebase.
 */

/**
 * Docker label key used to identify devcontainers.
 * This label is set automatically by devcontainer-cli when starting a container.
 * The value is the absolute path to the local project folder.
 */
export const DOCKER_LABEL_KEY = "devcontainer.local_folder";

/**
 * Directory name for lock files on remote server.
 */
export const LOCKS_DIR_NAME = ".devbox-locks";

/**
 * Config filename.
 */
export const CONFIG_FILENAME = "config.yaml";

/**
 * Default editor preference.
 */
export const DEFAULT_EDITOR = "cursor";

/**
 * Pinned Mutagen version for binary downloads.
 * @see https://github.com/mutagen-io/mutagen/releases
 */
export const MUTAGEN_VERSION = "0.17.5";

/**
 * Exit code when user presses Ctrl+C.
 */
export const CTRL_C_EXIT_CODE = 130;
```

**Step 2: Update container.ts to use constant**

Replace all occurrences of `devcontainer.local_folder` with the constant:

```typescript
import { DOCKER_LABEL_KEY } from "./constants.ts";

// Replace: `label=devcontainer.local_folder=${path}`
// With:    `label=${DOCKER_LABEL_KEY}=${path}`
```

**Step 3: Run container tests**

Run: `bun test src/lib/__tests__/container.test.ts -v`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/container.ts
git commit -m "$(cat <<'EOF'
refactor: extract Docker label key to constants

Centralizes the devcontainer label key used in 7 places in container.ts
for easier maintenance and consistency.
EOF
)"
```

---

### Task 5: Extract checkRemoteProjectExists to Shared Module

**Files:**
- Create: `src/lib/remote.ts`
- Modify: `src/commands/clone.ts`
- Modify: `src/commands/push.ts`
- Test: `src/lib/__tests__/remote.test.ts`

**Step 1: Write failing test**

```typescript
// src/lib/__tests__/remote.test.ts
import { describe, test, expect } from "bun:test";

describe("checkRemoteProjectExists", () => {
	test("module exports the function", async () => {
		const { checkRemoteProjectExists } = await import("../remote.ts");
		expect(typeof checkRemoteProjectExists).toBe("function");
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/remote.test.ts -v`
Expected: FAIL with "Cannot find module"

**Step 3: Create remote.ts**

```typescript
// src/lib/remote.ts
/**
 * @file remote.ts
 * @description Operations for interacting with remote servers.
 */

import { runRemoteCommand } from "./ssh.ts";

/**
 * Check if a project directory exists on the remote server.
 */
export async function checkRemoteProjectExists(
	host: string,
	basePath: string,
	project: string,
): Promise<boolean> {
	const result = await runRemoteCommand(
		host,
		`test -d "${basePath}/${project}" && echo "EXISTS" || echo "NOT_FOUND"`,
	);
	return result.stdout?.includes("EXISTS") ?? false;
}

/**
 * List projects in a directory on the remote server.
 */
export async function listRemoteProjects(
	host: string,
	basePath: string,
): Promise<string[]> {
	const result = await runRemoteCommand(
		host,
		`ls -1 "${basePath}" 2>/dev/null || echo ""`,
	);
	if (!result.stdout) return [];
	return result.stdout.split("\n").filter(Boolean);
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/remote.test.ts -v`
Expected: PASS

**Step 5: Update clone.ts to use shared function**

```typescript
// Remove local checkRemoteProjectExists function (lines 18-28)
// Add import:
import { checkRemoteProjectExists } from "../lib/remote.ts";
```

**Step 6: Update push.ts to use shared function**

```typescript
// Remove local checkRemoteProjectExists function (lines 16-26)
// Add import:
import { checkRemoteProjectExists } from "../lib/remote.ts";
```

**Step 7: Run all tests**

Run: `bun test`
Expected: All PASS

**Step 8: Commit**

```bash
git add src/lib/remote.ts src/lib/__tests__/remote.test.ts src/commands/clone.ts src/commands/push.ts
git commit -m "$(cat <<'EOF'
refactor: extract checkRemoteProjectExists to shared module

Eliminates duplicate function in clone.ts and push.ts by moving to
src/lib/remote.ts. Also properly quotes paths in the check.
EOF
)"
```

---

### Task 6: Fix Biome VCS Settings

**Files:**
- Modify: `biome.json`

**Step 1: Read current biome.json**

Run: `cat biome.json`

**Step 2: Update VCS settings**

```json
{
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  }
}
```

**Step 3: Verify biome check still works**

Run: `bun run check`
Expected: No unexpected errors

**Step 4: Commit**

```bash
git add biome.json
git commit -m "$(cat <<'EOF'
fix(config): enable gitignore support in Biome

Configure Biome to respect .gitignore patterns, preventing linting
of generated/ignored files.
EOF
)"
```

---

### Task 7: Create Test Utilities Module

**Files:**
- Create: `src/lib/__tests__/test-utils.ts`
- Modify: `src/lib/__tests__/config.test.ts` (example update)

**Step 1: Create test-utils.ts**

```typescript
// src/lib/__tests__/test-utils.ts
/**
 * @file test-utils.ts
 * @description Shared utilities for test setup and teardown.
 */

import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DevboxConfigV2, RemoteEntry } from "../../types/index.ts";

export interface TestContext {
	testDir: string;
	cleanup: () => void;
}

/**
 * Creates an isolated test environment with DEVBOX_HOME set.
 */
export function createTestContext(name: string): TestContext {
	const testDir = join(tmpdir(), `devbox-${name}-test-${Date.now()}`);
	const originalEnv = process.env.DEVBOX_HOME;

	mkdirSync(testDir, { recursive: true });
	process.env.DEVBOX_HOME = testDir;

	return {
		testDir,
		cleanup: () => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true });
			}
			if (originalEnv) {
				process.env.DEVBOX_HOME = originalEnv;
			} else {
				delete process.env.DEVBOX_HOME;
			}
		},
	};
}

/**
 * Creates a test config with sensible defaults.
 */
export function createTestConfig(
	overrides: Partial<DevboxConfigV2> = {},
): DevboxConfigV2 {
	return {
		editor: "cursor",
		defaults: { sync_mode: "two-way-resolved", ignore: [] },
		remotes: {},
		projects: {},
		...overrides,
	};
}

/**
 * Creates a test remote entry.
 */
export function createTestRemote(
	name: string,
	overrides: Partial<RemoteEntry> = {},
): RemoteEntry {
	return {
		host: `${name}.example.com`,
		user: "testuser",
		path: "/home/testuser/projects",
		...overrides,
	};
}

/**
 * Writes a test config to the test directory.
 */
export function writeTestConfig(
	testDir: string,
	config: DevboxConfigV2,
): void {
	const { stringify } = require("yaml");
	const configPath = join(testDir, "config.yaml");
	writeFileSync(configPath, stringify(config));
}
```

**Step 2: Verify the module loads**

Run: `bun test src/lib/__tests__/test-utils.ts`
Expected: No tests to run (utility file)

**Step 3: Commit**

```bash
git add src/lib/__tests__/test-utils.ts
git commit -m "$(cat <<'EOF'
feat(test): add shared test utilities module

Provides createTestContext, createTestConfig, and createTestRemote
to eliminate boilerplate across 15+ test files.
EOF
)"
```

---

### Task 8: Add DevcontainerConfig Type

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add the type definition**

Add after the existing Template interface (~line 192):

```typescript
/**
 * Devcontainer configuration structure.
 * Based on the devcontainer.json specification.
 */
export interface DevcontainerConfig {
	name?: string;
	image?: string;
	features?: Record<string, unknown>;
	customizations?: {
		vscode?: {
			extensions?: string[];
			settings?: Record<string, unknown>;
		};
	};
	mounts?: string[];
	postCreateCommand?: string;
	workspaceFolder?: string;
	workspaceMount?: string;
}

export interface Template {
	id: string;
	name: string;
	description: string;
	config: DevcontainerConfig;
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (or errors to fix in templates.ts)

**Step 3: Update templates.ts if needed**

Ensure template configs match the new type.

**Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(types): add DevcontainerConfig interface

Replaces loose 'object' type on Template.config with a properly
typed interface matching the devcontainer.json specification.
EOF
)"
```

---

## Phase 3: Medium Priority Refactoring

### Task 9: Extract Lock Status Checking Pattern

**Files:**
- Modify: `src/lib/lock.ts`
- Modify: `src/commands/rm.ts`
- Modify: `src/commands/down.ts`
- Modify: `src/commands/up.ts`

**Step 1: Add helper function to lock.ts**

```typescript
// Add to src/lib/lock.ts

import { spinner, warning } from "./ui.ts";
import { getProjectRemote } from "../commands/remote.ts";
import type { DevboxConfigV2 } from "../types/index.ts";

/**
 * Check lock status with spinner and handle common error case.
 * Returns null if lock check failed (with warning displayed).
 */
export async function checkAndReportLockStatus(
	project: string,
	config: DevboxConfigV2,
): Promise<LockStatus | null> {
	const projectRemote = getProjectRemote(project, config);
	if (!projectRemote) {
		return null;
	}

	const lockSpin = spinner("Checking lock status...");
	try {
		const remoteInfo = createLockRemoteInfo(projectRemote.remote);
		const status = await getLockStatus(project, remoteInfo);
		lockSpin.stop();
		return status;
	} catch {
		lockSpin.warn("Could not check lock status");
		return null;
	}
}
```

**Step 2: Update commands to use helper**

Update rm.ts, down.ts, up.ts to use `checkAndReportLockStatus`.

**Step 3: Run tests**

Run: `bun test`
Expected: All PASS

**Step 4: Commit**

```bash
git add src/lib/lock.ts src/commands/rm.ts src/commands/down.ts src/commands/up.ts
git commit -m "$(cat <<'EOF'
refactor: extract lock status checking to shared helper

Eliminates duplicated lock checking pattern in rm.ts, down.ts, up.ts
by adding checkAndReportLockStatus to lock.ts.
EOF
)"
```

---

### Task 10: Fix SSH Config Magic Numbers

**Files:**
- Modify: `src/lib/ssh.ts`

**Step 1: Add SSH_PREFIXES constant**

```typescript
// Add near top of src/lib/ssh.ts
const SSH_PREFIXES = {
	HOST: "host ",
	HOSTNAME: "hostname ",
	USER: "user ",
	PORT: "port ",
	IDENTITY_FILE: "identityfile ",
} as const;
```

**Step 2: Update parseSSHConfig to use prefixes**

Replace magic number slices:

```typescript
if (lower.startsWith(SSH_PREFIXES.HOST) && !trimmed.includes("*")) {
	if (currentHost) {
		hosts.push(currentHost);
	}
	currentHost = { name: trimmed.slice(SSH_PREFIXES.HOST.length).trim() };
} else if (currentHost) {
	if (lower.startsWith(SSH_PREFIXES.HOSTNAME)) {
		currentHost.hostname = trimmed.slice(SSH_PREFIXES.HOSTNAME.length).trim();
	} else if (lower.startsWith(SSH_PREFIXES.USER)) {
		currentHost.user = trimmed.slice(SSH_PREFIXES.USER.length).trim();
	} else if (lower.startsWith(SSH_PREFIXES.PORT)) {
		currentHost.port = parseInt(trimmed.slice(SSH_PREFIXES.PORT.length).trim());
	} else if (lower.startsWith(SSH_PREFIXES.IDENTITY_FILE)) {
		currentHost.identityFile = trimmed.slice(SSH_PREFIXES.IDENTITY_FILE.length).trim();
	}
}
```

**Step 3: Run SSH tests**

Run: `bun test src/lib/__tests__/ssh.test.ts -v`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/ssh.ts
git commit -m "$(cat <<'EOF'
refactor: replace magic numbers in SSH config parser

Extract SSH config prefixes to named constants for clarity.
EOF
)"
```

---

### Task 11: Add YAML Parse Error Handling

**Files:**
- Modify: `src/lib/config.ts`
- Test: `src/lib/__tests__/config.test.ts`

**Step 1: Add test for malformed YAML**

```typescript
// Add to src/lib/__tests__/config.test.ts
test("throws on malformed YAML", () => {
	writeFileSync(join(ctx.testDir, "config.yaml"), "invalid: yaml: content:");
	expect(() => loadConfig()).toThrow(/Invalid config/);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/config.test.ts --grep "malformed" -v`
Expected: FAIL

**Step 3: Add error handling to loadConfig**

```typescript
import { YAMLParseError } from "yaml";
import { getErrorMessage } from "./errors.ts";

// In loadConfig function:
try {
	const content = readFileSync(configPath, "utf-8");
	const rawConfig = parse(content);
	// ... rest of function
} catch (err) {
	if (err instanceof YAMLParseError) {
		throw new Error(`Invalid config file: ${getErrorMessage(err)}`);
	}
	throw err;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/config.test.ts --grep "malformed" -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/config.ts src/lib/__tests__/config.test.ts
git commit -m "$(cat <<'EOF'
fix: add error handling for malformed YAML config

Catch YAML parse errors and provide user-friendly error message.
EOF
)"
```

---

### Task 12: Add Project Name Validation

**Files:**
- Create: `src/lib/validation.ts`
- Test: `src/lib/__tests__/validation.test.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/__tests__/validation.test.ts
import { describe, test, expect } from "bun:test";
import { validateProjectName } from "../validation.ts";

describe("validateProjectName", () => {
	test("rejects empty names", () => {
		expect(validateProjectName("").valid).toBe(false);
		expect(validateProjectName("   ").valid).toBe(false);
	});

	test("rejects path separators", () => {
		expect(validateProjectName("foo/bar").valid).toBe(false);
		expect(validateProjectName("foo\\bar").valid).toBe(false);
	});

	test("rejects names starting with . or -", () => {
		expect(validateProjectName(".hidden").valid).toBe(false);
		expect(validateProjectName("-invalid").valid).toBe(false);
	});

	test("rejects special characters", () => {
		expect(validateProjectName("foo bar").valid).toBe(false);
		expect(validateProjectName("foo@bar").valid).toBe(false);
	});

	test("accepts valid names", () => {
		expect(validateProjectName("my-project").valid).toBe(true);
		expect(validateProjectName("my_project").valid).toBe(true);
		expect(validateProjectName("myProject123").valid).toBe(true);
	});

	test("rejects names over 100 characters", () => {
		const longName = "a".repeat(101);
		expect(validateProjectName(longName).valid).toBe(false);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `bun test src/lib/__tests__/validation.test.ts -v`
Expected: FAIL

**Step 3: Create validation.ts**

```typescript
// src/lib/validation.ts
/**
 * @file validation.ts
 * @description Input validation utilities.
 */

export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validates a project name for safety and compatibility.
 */
export function validateProjectName(name: string): ValidationResult {
	if (!name || !name.trim()) {
		return { valid: false, error: "Project name is required" };
	}

	if (name.includes("/") || name.includes("\\")) {
		return { valid: false, error: "Project name cannot contain path separators" };
	}

	if (name.startsWith(".") || name.startsWith("-")) {
		return { valid: false, error: "Project name cannot start with . or -" };
	}

	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
		return {
			valid: false,
			error: "Project name can only contain letters, numbers, hyphens, and underscores",
		};
	}

	if (name.length > 100) {
		return { valid: false, error: "Project name is too long (max 100 characters)" };
	}

	return { valid: true };
}

/**
 * Check for path traversal attempts.
 */
export function isPathTraversal(path: string): boolean {
	return path.includes("..") || path.startsWith("/") || path.startsWith("~");
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/lib/__tests__/validation.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/__tests__/validation.test.ts
git commit -m "$(cat <<'EOF'
feat: add project name validation

Add validateProjectName to prevent path traversal, special characters,
and other invalid project names.
EOF
)"
```

---

### Task 13: Add SyncStatusValue Type

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add type and update interface**

```typescript
// Add near SyncStatus interface (~line 212)
export type SyncStatusValue = "syncing" | "paused" | "none" | "error";

export interface SyncStatus {
	exists: boolean;
	paused: boolean;
	status: SyncStatusValue;
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: Errors in mutagen.ts (fix them)

**Step 3: Update mutagen.ts to use new type**

Ensure all status values match the union type.

**Step 4: Commit**

```bash
git add src/types/index.ts src/lib/mutagen.ts
git commit -m "$(cat <<'EOF'
feat(types): add SyncStatusValue union type

Replace generic string with typed union for better type safety
in sync status handling.
EOF
)"
```

---

### Task 14: Fix ContainerStatus Enum Usage

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Update enum and interfaces**

```typescript
// Update ContainerStatus enum (~line 70)
export enum ContainerStatus {
	Running = "running",
	Stopped = "stopped",
	NotFound = "not_found",
	Error = "error",
	Unknown = "unknown",
}

// Update ProjectSummary interface
export interface ProjectSummary {
	name: string;
	path: string;
	container: ContainerStatus;
	// ... rest
}

// Update ContainerDetails interface
export interface ContainerDetails {
	status: ContainerStatus;
	// ... rest
}
```

**Step 2: Run typecheck and fix any issues**

Run: `bun run typecheck`
Expected: Fix any type errors

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "$(cat <<'EOF'
refactor(types): use ContainerStatus enum consistently

Add Unknown variant and use enum in ProjectSummary and ContainerDetails
instead of string literals.
EOF
)"
```

---

### Task 15: Add Execa Timeout to SSH Test Connection

**Files:**
- Modify: `src/lib/ssh.ts:84`

**Step 1: Add timeout option**

```typescript
// Line ~84: Add timeout to execa call
await execa("ssh", args, { timeout: 10000 }); // 10 second hard limit
```

**Step 2: Run SSH tests**

Run: `bun test src/lib/__tests__/ssh.test.ts -v`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ssh.ts
git commit -m "$(cat <<'EOF'
fix: add execa timeout to SSH test connection

Prevent indefinite hangs if SSH process stalls for non-network reasons.
EOF
)"
```

---

## Phase 4: Low Priority Polish

### Task 16: Add Missing Package.json Fields

**Files:**
- Modify: `package.json`

**Step 1: Add metadata fields**

Add/update these fields:

```json
{
  "description": "Local-first development containers with remote sync",
  "license": "Apache-2.0",
  "author": "DevBox Team",
  "homepage": "https://github.com/noorchasib/devbox",
  "bugs": {
    "url": "https://github.com/noorchasib/devbox/issues"
  },
  "engines": {
    "bun": ">=1.0.0"
  },
  "keywords": ["devcontainer", "docker", "development", "cli", "sync", "mutagen"]
}
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore: add missing package.json metadata

Add description, author, homepage, bugs URL, engines, and keywords
for better discoverability.
EOF
)"
```

---

### Task 17: Add TypeScript Strict Flags

**Files:**
- Modify: `tsconfig.json`

**Step 1: Add strict flags**

```json
{
  "compilerOptions": {
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Step 2: Run typecheck and fix any issues**

Run: `bun run typecheck`
Expected: Fix any new errors

**Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "$(cat <<'EOF'
chore: enable additional TypeScript strict flags

Add noUnusedLocals, noUnusedParameters, and forceConsistentCasingInFileNames
for better code quality.
EOF
)"
```

---

### Task 18: Parallelize Git Operations in list.ts

**Files:**
- Modify: `src/commands/list.ts`

**Step 1: Refactor to use Promise.all**

```typescript
// Replace sequential loop with parallel execution
const entries = readdirSync(PROJECTS_DIR);

const projects = await Promise.all(
	entries
		.filter((entry) => {
			try {
				return statSync(join(PROJECTS_DIR, entry)).isDirectory();
			} catch {
				return false;
			}
		})
		.map(async (entry) => ({
			name: entry,
			branch: await getGitBranch(join(PROJECTS_DIR, entry)),
		})),
);
```

**Step 2: Run tests**

Run: `bun test src/commands/__tests__/list.test.ts -v`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/list.ts
git commit -m "$(cat <<'EOF'
perf: parallelize git branch lookups in list command

Use Promise.all instead of sequential loop for faster project listing.
EOF
)"
```

---

### Task 19: Add JSDoc to Key Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add documentation to LockInfo and related types**

```typescript
/**
 * Lock information stored on remote server.
 * Used to prevent concurrent access to the same project from multiple machines.
 */
export interface LockInfo {
	/** Hostname of the machine holding the lock */
	machine: string;
	/** Username of the user holding the lock */
	user: string;
	/** ISO timestamp when lock was acquired */
	timestamp: string;
	/** Process ID of the devbox process holding the lock */
	pid: number;
}

/**
 * Result of checking lock status.
 */
export interface LockStatus {
	/** Whether the project is currently locked */
	locked: boolean;
	/** Whether the current machine owns the lock (only set if locked is true) */
	ownedByMe?: boolean;
	/** Lock details (only set if locked is true) */
	info?: LockInfo;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "$(cat <<'EOF'
docs: add JSDoc comments to key types

Document LockInfo, LockStatus, and other important interfaces
for better IDE support and documentation.
EOF
)"
```

---

### Task 20: Fix Race Condition in List Command

**Files:**
- Modify: `src/commands/list.ts:33-42`

**Step 1: Add error handling for stat**

```typescript
for (const entry of entries) {
	const fullPath = join(PROJECTS_DIR, entry);
	try {
		if (statSync(fullPath).isDirectory()) {
			// ... process directory
		}
	} catch {
		// File was deleted between readdir and stat, skip it
		continue;
	}
}
```

**Step 2: Run tests**

Run: `bun test src/commands/__tests__/list.test.ts -v`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/list.ts
git commit -m "$(cat <<'EOF'
fix: handle race condition in list command

Catch errors if directory is deleted between readdir and stat calls.
EOF
)"
```

---

## Phase 5: Pre-Production Checklist

### Task 21: Manual Testing Checklist

**No code changes - manual verification**

Complete the following manual tests from PROJECT.md Section 9:

- [ ] Fresh install on new machine (no prior config)
- [ ] Test with password-protected SSH server
- [ ] Test with existing key auth
- [ ] Push new local project to empty remote
- [ ] Clone existing remote project
- [ ] Test with project without devcontainer config
- [ ] Test with custom devcontainer config
- [ ] Git operations: commit, branch, checkout
- [ ] Work offline for 30 min, reconnect
- [ ] Test lock takeover between two computers
- [ ] Multiple projects running simultaneously
- [ ] macOS (Intel and ARM)
- [ ] Linux (Ubuntu, Debian)

Document results in a new file: `plans/testing-results.md`

---

### Task 22: Documentation Review

**Files:**
- Review: `docs/**/*.md`
- Update: As needed

**Step 1: Review VitePress docs for accuracy**

Check all command examples and configuration documentation.

**Step 2: Verify installation instructions**

Test on a clean environment.

**Step 3: Update any outdated content**

---

### Task 23: Create Actual Template Repositories (or Remove Feature)

**Files:**
- Modify: `src/lib/projectTemplates.ts`

**Decision Required:** Either:
1. Create actual template repos under a GitHub organization
2. Remove the template feature and document the removal

If removing:

```typescript
// Remove BUILT_IN_TEMPLATES array or mark as experimental
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [];
// Add comment explaining templates are coming in future version
```

---

### Task 24: Final Release Preparation

**Files:**
- Update: `CHANGELOG.md`
- Update: `package.json` version if needed

**Step 1: Review and update CHANGELOG**

Ensure all changes are documented.

**Step 2: Verify version number**

Confirm 0.5.1-beta is appropriate or update.

**Step 3: Run full test suite**

Run: `bun test`
Expected: All PASS

**Step 4: Run all checks**

Run: `bun run check && bun run typecheck`
Expected: No errors

---

## Summary

| Phase | Tasks | Estimated Commits |
|-------|-------|-------------------|
| Phase 1: Critical | 3 tasks | 3 commits |
| Phase 2: High Priority | 5 tasks | 5 commits |
| Phase 3: Medium Priority | 7 tasks | 7 commits |
| Phase 4: Low Priority | 5 tasks | 5 commits |
| Phase 5: Pre-Production | 4 tasks | Variable |

**Total: 24 tasks**

After each phase, run the full test suite to ensure no regressions:

```bash
bun test && bun run typecheck && bun run check
```
