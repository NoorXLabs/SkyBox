# Security Remediation Batch 4: Information Disclosure Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address the MEDIUM priority information disclosure and verbose error output findings (#12-16, #19-22) from the security audit.

**Architecture:** These are defensive hardening fixes that reduce the attack surface by limiting information exposed to users through debug modes, error messages, and verbose output. Changes are primarily to error handling paths and debug/verbose output.

**Tech Stack:** TypeScript, Bun test runner, existing error handling utilities from `src/lib/errors.ts`

---

## Overview

This batch addresses 9 MEDIUM priority findings related to information disclosure:

| # | Finding | File | Risk |
|---|---------|------|------|
| 12 | Debug flag information disclosure | `src/commands/list.ts` | Stack traces exposed |
| 13 | Verbose flag raw output exposure | `src/commands/up.ts` | Unsanitized Docker errors |
| 14 | Config path exposure in error messages | `src/lib/config.ts` | Full file paths exposed |
| 15 | SSH error verbosity | `src/lib/ssh.ts` | Auth details in errors |
| 16 | Lock holder information disclosure | `src/lib/lock.ts` | Machine hostname exposed |
| 19 | DevContainer image tag mutation risk | `src/lib/constants.ts` | Mutable tags allow supply chain |
| 20 | Hook command injection risk | `src/lib/hooks.ts` | User hooks execute via shell |
| 21 | Missing YAML schema validation | `src/lib/config.ts` | Config cast without validation |
| 22 | Race condition in config file creation | `src/lib/config.ts` | Brief readable window |

---

## Task 1: Sanitize Debug Output in list.ts

**Files:**
- Modify: `src/commands/list.ts:21-22, 49-50`
- Test: `src/commands/__tests__/list.test.ts`

### Step 1: Write the failing test

Add to `src/commands/__tests__/list.test.ts`:

```typescript
describe("debug output sanitization", () => {
	test("DEBUG mode does not expose stack traces", () => {
		// Verify error messages are wrapped through getErrorMessage
		// and don't include raw error.stack
		const testError = new Error("Test error");
		testError.stack = "Error: Test error\n    at /sensitive/path/file.ts:123";

		const sanitized = getErrorMessage(testError);

		// Should not contain stack trace paths
		expect(sanitized).not.toContain("/sensitive/path");
		expect(sanitized).not.toContain("at ");
	});
});
```

### Step 2: Run test to verify behavior

Run: `bun test src/commands/__tests__/list.test.ts --grep "debug output"`
Expected: PASS (getErrorMessage already sanitizes)

### Step 3: Update list.ts to use getErrorMessage consistently

Edit `src/commands/list.ts`:

**Find line 21-22 (DEBUG output):**
```typescript
if (process.env.DEBUG === "1") {
	console.error(e);
}
```

**Replace with:**
```typescript
if (process.env.DEBUG === "1") {
	console.error("Debug:", getErrorMessage(e));
}
```

**Find line 49-50:**
```typescript
if (process.env.DEBUG === "1") {
	console.error(e);
}
```

**Replace with:**
```typescript
if (process.env.DEBUG === "1") {
	console.error("Debug:", getErrorMessage(e));
}
```

### Step 4: Verify import exists

Ensure `getErrorMessage` is imported:
```typescript
import { getErrorMessage } from "@lib/errors.ts";
```

### Step 5: Run tests

Run: `bun test`
Expected: All tests pass

### Step 6: Commit

```bash
git add src/commands/list.ts src/commands/__tests__/list.test.ts
git commit -m "$(cat <<'EOF'
fix(security): sanitize debug output in list command

Replace raw error logging with getErrorMessage() to prevent
stack trace and internal path exposure in DEBUG mode.

Fixes MEDIUM finding #12 from security audit.
EOF
)"
```

---

## Task 2: Sanitize Verbose Output in up.ts

**Files:**
- Modify: `src/commands/up.ts:761-766`
- Test: `src/commands/__tests__/up.test.ts`

### Step 1: Locate verbose output code

Find the verbose flag handling around lines 761-766 that outputs raw Docker errors.

### Step 2: Wrap Docker errors with sanitization

Edit `src/commands/up.ts`:

**Add helper function near top of file:**
```typescript
/**
 * Sanitize Docker error output for display.
 * Removes potentially sensitive information while preserving useful details.
 */
function sanitizeDockerError(error: string): string {
	// Remove absolute paths that could expose system structure
	let sanitized = error.replace(/\/[\w\-/.]+/g, (match) => {
		// Keep relative paths and common paths
		if (match.startsWith("/tmp") || match.startsWith("/var/run/docker")) {
			return match;
		}
		// Redact user home paths
		if (match.includes("/Users/") || match.includes("/home/")) {
			return "[REDACTED_PATH]";
		}
		return match;
	});

	// Remove potential credential fragments
	sanitized = sanitized.replace(/password[=:]\S+/gi, "password=[REDACTED]");
	sanitized = sanitized.replace(/token[=:]\S+/gi, "token=[REDACTED]");

	return sanitized;
}
```

**Update verbose output section:**
```typescript
if (options.verbose) {
	console.error("Docker error:", sanitizeDockerError(getErrorMessage(e)));
}
```

### Step 3: Run tests

Run: `bun test`
Expected: All tests pass

### Step 4: Commit

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
fix(security): sanitize verbose Docker error output

Add sanitizeDockerError() to redact:
- User home directory paths
- Password and token fragments
- Other potentially sensitive paths

Fixes MEDIUM finding #13 from security audit.
EOF
)"
```

---

## Task 3: Redact Config Paths in Error Messages

**Files:**
- Modify: `src/lib/config.ts:30`
- Test: `src/lib/__tests__/config.test.ts`

### Step 1: Write the failing test

Add to `src/lib/__tests__/config.test.ts`:

```typescript
describe("error message sanitization", () => {
	test("config parse errors do not expose full paths", () => {
		// Create invalid YAML in config
		const invalidYaml = "invalid: yaml: content:";
		writeFileSync(join(ctx.testDir, "config.yaml"), invalidYaml);

		expect(() => loadConfig()).toThrow();

		try {
			loadConfig();
		} catch (e) {
			const message = getErrorMessage(e);
			// Should not contain full home path
			expect(message).not.toMatch(/\/Users\/\w+/);
			expect(message).not.toMatch(/\/home\/\w+/);
		}
	});
});
```

### Step 2: Create path sanitization helper

Add to `src/lib/config.ts`:

```typescript
/**
 * Sanitize a path for error messages.
 * Replaces home directory with ~ for privacy.
 */
function sanitizePath(path: string): string {
	const home = homedir();
	if (path.startsWith(home)) {
		return "~" + path.slice(home.length);
	}
	return path;
}
```

**Add import:**
```typescript
import { homedir } from "node:os";
```

### Step 3: Update error message

Find line 30 (config parse error) and wrap path:

**Before:**
```typescript
throw new Error(`Failed to parse config at ${configPath}: ${getErrorMessage(e)}`);
```

**After:**
```typescript
throw new Error(`Failed to parse config at ${sanitizePath(configPath)}: ${getErrorMessage(e)}`);
```

### Step 4: Run tests

Run: `bun test src/lib/__tests__/config.test.ts`
Expected: All tests pass

### Step 5: Commit

```bash
git add src/lib/config.ts src/lib/__tests__/config.test.ts
git commit -m "$(cat <<'EOF'
fix(security): redact home directory in config error paths

Config parse errors now show ~/... instead of /Users/name/...
to avoid exposing full username in error messages.

Fixes MEDIUM finding #14 from security audit.
EOF
)"
```

---

## Task 4: Reduce SSH Error Verbosity

**Files:**
- Modify: `src/lib/ssh.ts:100, 112, 130`
- Test: `src/lib/__tests__/ssh.test.ts`

### Step 1: Create SSH error sanitizer

Add to `src/lib/ssh.ts`:

```typescript
/**
 * Sanitize SSH error messages for user display.
 * Removes authentication details and host-specific info.
 */
function sanitizeSshError(error: string): string {
	let sanitized = error;

	// Remove private key paths
	sanitized = sanitized.replace(/identity file[^,\n]*/gi, "identity file [REDACTED]");

	// Remove specific host fingerprints
	sanitized = sanitized.replace(/[A-Fa-f0-9]{2}(:[A-Fa-f0-9]{2}){15,}/g, "[FINGERPRINT]");

	// Remove usernames from error if embedded
	sanitized = sanitized.replace(/user(name)?[=:\s]+\S+/gi, "user=[REDACTED]");

	// Generic auth failure message
	if (sanitized.includes("Permission denied") || sanitized.includes("authentication")) {
		return "SSH authentication failed. Check your SSH key and remote configuration.";
	}

	return sanitized;
}
```

### Step 2: Apply sanitizer to error paths

Find lines 100, 112, 130 where SSH errors are thrown or returned, and wrap with sanitizer:

**Example update:**
```typescript
// Before
return { success: false, error: result.stderr };

// After
return { success: false, error: sanitizeSshError(result.stderr) };
```

### Step 3: Run tests

Run: `bun test`
Expected: All tests pass

### Step 4: Commit

```bash
git add src/lib/ssh.ts src/lib/__tests__/ssh.test.ts
git commit -m "$(cat <<'EOF'
fix(security): reduce SSH error verbosity

SSH error messages now redact:
- Identity file paths
- Host fingerprints
- Username fragments
- Detailed auth failure reasons

Generic "SSH authentication failed" message for auth errors.

Fixes MEDIUM finding #15 from security audit.
EOF
)"
```

---

## Task 5: Limit Lock Holder Information

**Files:**
- Modify: `src/lib/lock.ts:169`
- Test: `src/lib/__tests__/lock.test.ts`

### Step 1: Update lock status message

Edit `src/lib/lock.ts` line 169 to reduce information:

**Before:**
```typescript
`Locked by ${info.user}@${info.machine} (expires ${expiresAt})`
```

**After:**
```typescript
`Locked by another session (expires ${expiresAt})`
```

### Step 2: Add verbose flag for detailed info

Modify getLockStatus to accept options:

```typescript
export async function getLockStatus(
	project: string,
	remoteInfo: LockRemoteInfo,
	options?: { verbose?: boolean },
): Promise<LockStatus> {
	// ... existing code ...

	// In the locked branch:
	const displayInfo = options?.verbose
		? `Locked by ${info.user}@${info.machine}`
		: "Locked by another session";
}
```

### Step 3: Run tests

Run: `bun test src/lib/__tests__/lock.test.ts`
Expected: All tests pass

### Step 4: Commit

```bash
git add src/lib/lock.ts src/lib/__tests__/lock.test.ts
git commit -m "$(cat <<'EOF'
fix(security): limit lock holder information disclosure

Lock status now shows generic "Locked by another session" by default.
Add verbose option to getLockStatus for cases where full info is needed.

Fixes MEDIUM finding #16 from security audit.
EOF
)"
```

---

## Task 6: Pin DevContainer Image Digests

**Files:**
- Modify: `src/lib/constants.ts:202-210`
- Test: `src/lib/__tests__/constants.test.ts`

### Step 1: Write the test

Add to `src/lib/__tests__/constants.test.ts`:

```typescript
describe("devcontainer image security", () => {
	test("all templates use pinned image digests or sha256", () => {
		for (const template of TEMPLATES) {
			const image = template.config.image;
			if (image) {
				// Should have sha256 digest or be a known stable tag
				const hasShaDigest = image.includes("@sha256:");
				const hasVersionTag = /:[\d.]+(-\w+)?$/.test(image);

				expect(hasShaDigest || hasVersionTag).toBe(true);
			}
		}
	});
});
```

### Step 2: Update images with SHA256 digests

Edit `src/lib/constants.ts` - update each template image:

**Research current digest** (run these commands):
```bash
docker pull mcr.microsoft.com/devcontainers/javascript-node:1 --quiet
docker inspect mcr.microsoft.com/devcontainers/javascript-node:1 --format='{{index .RepoDigests 0}}'
```

**Update template:**
```typescript
// Before
image: "mcr.microsoft.com/devcontainers/javascript-node:1",

// After (example - use actual digest from docker inspect)
image: "mcr.microsoft.com/devcontainers/javascript-node@sha256:abc123...",
```

**Note:** Document the image versions in comments for maintenance.

### Step 3: Run tests

Run: `bun test src/lib/__tests__/constants.test.ts --grep "image security"`
Expected: PASS

### Step 4: Commit

```bash
git add src/lib/constants.ts src/lib/__tests__/constants.test.ts
git commit -m "$(cat <<'EOF'
fix(security): pin devcontainer images to SHA256 digests

Replace mutable version tags with immutable SHA256 digests to prevent
supply chain attacks via tag mutation. Images can now only change
through explicit updates in constants.ts.

Pinned images:
- javascript-node: sha256:...
- python: sha256:...
- go: sha256:...
- base: sha256:...

Fixes MEDIUM finding #19 from security audit.
EOF
)"
```

---

## Task 7: Document Hook Security and Add Warning

**Files:**
- Modify: `src/lib/hooks.ts:55`
- Modify: `docs/reference/hooks.md` (if exists)

### Step 1: Add security warning to hooks

Edit `src/lib/hooks.ts`:

**Add comment before hook execution:**
```typescript
/**
 * Execute a hook command.
 *
 * SECURITY NOTE: Hook commands execute with full shell access.
 * Users are responsible for securing their hook configurations.
 * Hooks should only be defined in trusted CLAUDE.md or config files.
 */
```

**Add runtime warning for first hook execution:**
```typescript
let hookWarningShown = false;

async function executeHook(command: string): Promise<void> {
	if (!hookWarningShown && process.env.DEVBOX_HOOK_WARNINGS !== "0") {
		console.warn("⚠️  Executing user-defined hook (see devbox docs for security info)");
		hookWarningShown = true;
	}

	// ... existing execution code
}
```

### Step 2: Run tests

Run: `bun test`
Expected: All tests pass

### Step 3: Commit

```bash
git add src/lib/hooks.ts
git commit -m "$(cat <<'EOF'
fix(security): add hook execution security warning

Show one-time warning when hooks execute to remind users that hooks
run with full shell access. Disable with DEVBOX_HOOK_WARNINGS=0.

Documents MEDIUM finding #20 from security audit.
EOF
)"
```

---

## Task 8: Add YAML Schema Validation

**Files:**
- Modify: `src/lib/config.ts:17-44`
- Create: `src/lib/config-schema.ts`
- Test: `src/lib/__tests__/config.test.ts`

### Step 1: Write the failing test

Add to `src/lib/__tests__/config.test.ts`:

```typescript
describe("config schema validation", () => {
	test("rejects config with invalid editor value", () => {
		const invalidConfig = { editor: 123, remotes: {}, projects: {} };
		expect(() => validateConfig(invalidConfig)).toThrow("editor");
	});

	test("rejects config with invalid remote structure", () => {
		const invalidConfig = {
			editor: "cursor",
			remotes: { test: "not-an-object" },
			projects: {},
		};
		expect(() => validateConfig(invalidConfig)).toThrow("remote");
	});

	test("accepts valid config", () => {
		const validConfig = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: { work: { host: "server", path: "~/code" } },
			projects: {},
		};
		expect(() => validateConfig(validConfig)).not.toThrow();
	});
});
```

### Step 2: Create schema validation

Create `src/lib/config-schema.ts`:

```typescript
/**
 * Runtime schema validation for DevBox config.
 */

import type { DevboxConfigV2 } from "@typedefs/index.ts";

export class ConfigValidationError extends Error {
	constructor(field: string, message: string) {
		super(`Invalid config: ${field} - ${message}`);
		this.name = "ConfigValidationError";
	}
}

const VALID_EDITORS = ["cursor", "code", "vim", "nvim", "zed", "none"];
const VALID_SYNC_MODES = ["two-way-resolved", "two-way-safe", "one-way-replica"];

/**
 * Validate a config object at runtime.
 * Throws ConfigValidationError if invalid.
 */
export function validateConfig(config: unknown): asserts config is DevboxConfigV2 {
	if (typeof config !== "object" || config === null) {
		throw new ConfigValidationError("root", "Config must be an object");
	}

	const c = config as Record<string, unknown>;

	// Validate editor
	if (c.editor !== undefined) {
		if (typeof c.editor !== "string" || !VALID_EDITORS.includes(c.editor)) {
			throw new ConfigValidationError("editor", `Must be one of: ${VALID_EDITORS.join(", ")}`);
		}
	}

	// Validate defaults
	if (c.defaults !== undefined) {
		if (typeof c.defaults !== "object" || c.defaults === null) {
			throw new ConfigValidationError("defaults", "Must be an object");
		}
		const defaults = c.defaults as Record<string, unknown>;

		if (defaults.sync_mode !== undefined) {
			if (!VALID_SYNC_MODES.includes(defaults.sync_mode as string)) {
				throw new ConfigValidationError("defaults.sync_mode", `Must be one of: ${VALID_SYNC_MODES.join(", ")}`);
			}
		}

		if (defaults.ignore !== undefined && !Array.isArray(defaults.ignore)) {
			throw new ConfigValidationError("defaults.ignore", "Must be an array");
		}
	}

	// Validate remotes
	if (c.remotes !== undefined) {
		if (typeof c.remotes !== "object" || c.remotes === null) {
			throw new ConfigValidationError("remotes", "Must be an object");
		}

		for (const [name, remote] of Object.entries(c.remotes)) {
			if (typeof remote !== "object" || remote === null) {
				throw new ConfigValidationError(`remotes.${name}`, "Must be an object");
			}
			const r = remote as Record<string, unknown>;

			if (typeof r.host !== "string" && typeof r.path !== "string") {
				throw new ConfigValidationError(`remotes.${name}`, "Must have host or path");
			}
		}
	}

	// Validate projects
	if (c.projects !== undefined) {
		if (typeof c.projects !== "object" || c.projects === null) {
			throw new ConfigValidationError("projects", "Must be an object");
		}
	}
}
```

### Step 3: Integrate into loadConfig

Edit `src/lib/config.ts`:

**Add import:**
```typescript
import { validateConfig } from "@lib/config-schema.ts";
```

**Update loadConfig (around line 40):**
```typescript
export function loadConfig(): DevboxConfigV2 {
	const configPath = getConfigPath();

	if (!existsSync(configPath)) {
		return createDefaultConfig();
	}

	try {
		const content = readFileSync(configPath, "utf-8");
		const parsed = parse(content);

		// Validate schema at runtime
		validateConfig(parsed);

		return parsed;
	} catch (e) {
		throw new Error(`Failed to parse config at ${sanitizePath(configPath)}: ${getErrorMessage(e)}`);
	}
}
```

### Step 4: Run tests

Run: `bun test src/lib/__tests__/config.test.ts`
Expected: All tests pass

### Step 5: Commit

```bash
git add src/lib/config.ts src/lib/config-schema.ts src/lib/__tests__/config.test.ts
git commit -m "$(cat <<'EOF'
fix(security): add runtime YAML schema validation

Config files are now validated at load time:
- editor must be a valid editor name
- sync_mode must be a valid sync mode
- remotes must have proper structure
- Helpful error messages for invalid fields

Fixes MEDIUM finding #21 from security audit.
EOF
)"
```

---

## Task 9: Fix Race Condition in Config Creation

**Files:**
- Modify: `src/lib/config.ts:46-56`
- Test: `src/lib/__tests__/config.test.ts`

### Step 1: Understand the race condition

The race condition occurs because:
1. File is created with default permissions
2. Then permissions are changed

Fix: Use atomic write with correct permissions from the start.

### Step 2: Update saveConfig for atomic writes

Edit `src/lib/config.ts`:

```typescript
import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

export function saveConfig(config: DevboxConfigV2): void {
	const configPath = getConfigPath();
	const dir = dirname(configPath);

	// Create directory with secure permissions
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true, mode: 0o700 });
	}

	const content = stringify(config);

	// Atomic write: create temp file, then rename
	const tempDir = mkdtempSync(join(tmpdir(), "devbox-config-"));
	const tempPath = join(tempDir, "config.yaml");

	try {
		// Write to temp file with secure permissions
		writeFileSync(tempPath, content, { encoding: "utf-8", mode: 0o600 });

		// Atomic rename to final location
		renameSync(tempPath, configPath);

		// Ensure final file has correct permissions (rename preserves original)
		chmodSync(configPath, 0o600);
	} finally {
		// Clean up temp directory
		rmSync(tempDir, { recursive: true, force: true });
	}
}
```

**Add imports:**
```typescript
import { chmodSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
```

### Step 3: Run tests

Run: `bun test src/lib/__tests__/config.test.ts`
Expected: All tests pass

### Step 4: Commit

```bash
git add src/lib/config.ts
git commit -m "$(cat <<'EOF'
fix(security): atomic config file creation with correct permissions

Config files are now written atomically:
1. Create temp file with 0o600 permissions
2. Rename to final location
3. Chmod to ensure permissions

Eliminates race condition window where config could be readable.

Fixes MEDIUM finding #22 from security audit.
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
- `src/commands/list.ts`
- `src/commands/up.ts`
- `src/lib/config.ts`
- `src/lib/config-schema.ts` (new)
- `src/lib/ssh.ts`
- `src/lib/lock.ts`
- `src/lib/constants.ts`
- `src/lib/hooks.ts`
- Various test files

---

## Summary

This plan addresses 9 MEDIUM priority security findings:

| # | Finding | Fix |
|---|---------|-----|
| 12 | Debug info disclosure | Use `getErrorMessage()` consistently |
| 13 | Verbose output exposure | Add `sanitizeDockerError()` helper |
| 14 | Config path exposure | Add `sanitizePath()` for ~ substitution |
| 15 | SSH error verbosity | Add `sanitizeSshError()` helper |
| 16 | Lock holder info | Default to generic message, verbose option |
| 19 | Image tag mutation | Pin images to SHA256 digests |
| 20 | Hook injection risk | Add security warning and documentation |
| 21 | Missing schema validation | Add runtime `validateConfig()` |
| 22 | Config race condition | Atomic file creation with temp + rename |

After completing this batch, proceed to Batch 5 for the LOW priority findings (#23-27).
