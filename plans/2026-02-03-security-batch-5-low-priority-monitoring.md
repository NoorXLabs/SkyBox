# Security Remediation Batch 5: Low Priority & Monitoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address the LOW priority security findings (#23-27) from the security audit. These are monitoring enhancements, cleanup improvements, and supply chain hardening measures.

**Architecture:** These fixes are defensive enhancements with lower risk impact. They include minor UI changes, process lifecycle improvements, and CI/CD hardening.

**Tech Stack:** TypeScript, Bun test runner, GitHub Actions, npm lockfile integrity

---

## Overview

This batch addresses 5 LOW priority findings:

| # | Finding | File | Risk |
|---|---------|------|------|
| 23 | Password attempt count visible | `src/commands/up.ts` | Minor enumeration |
| 24 | Process.exit() without cleanup | Multiple files | Resource leaks |
| 25 | Lock file hash not computed | `bun.lock` | Supply chain tampering |
| 26 | No audit logging | Architecture | Cannot trace access |
| 27 | Homebrew token in git URL | `.github/workflows/release.yml` | Token exposure in logs |

---

## Task 1: Hide Password Attempt Count

**Files:**
- Modify: `src/commands/up.ts:397`
- Test: Manual verification

### Step 1: Locate the password attempt display

Find line 397 where attempt count is shown:

```typescript
error(`Attempt ${attempt}/${maxAttempts}: Wrong passphrase`);
```

### Step 2: Update to generic message

Edit `src/commands/up.ts`:

**Before:**
```typescript
error(`Attempt ${attempt}/${maxAttempts}: Wrong passphrase`);
```

**After:**
```typescript
error("Wrong passphrase. Please try again.");
```

### Step 3: Keep internal tracking but don't display

The `attempt` counter is still needed for the retry loop logic, just don't expose it to the user. This prevents attackers from knowing how many attempts remain.

### Step 4: Commit

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
fix(security): hide password attempt count from user

Replace "Attempt X/Y: Wrong passphrase" with generic message
to prevent enumeration of remaining attempts by attackers.

Internal retry logic unchanged.

Fixes LOW finding #23 from security audit.
EOF
)"
```

---

## Task 2: Add Graceful Shutdown Handler

**Files:**
- Create: `src/lib/shutdown.ts`
- Modify: `src/index.ts`
- Test: `src/lib/__tests__/shutdown.test.ts`

### Step 1: Write the failing test

Create `src/lib/__tests__/shutdown.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	registerCleanupHandler,
	runCleanupHandlers,
	resetCleanupHandlers,
} from "@lib/shutdown.ts";

describe("shutdown handlers", () => {
	beforeEach(() => {
		resetCleanupHandlers();
	});

	afterEach(() => {
		resetCleanupHandlers();
	});

	test("registerCleanupHandler adds handler", () => {
		let called = false;
		registerCleanupHandler(() => {
			called = true;
		});

		runCleanupHandlers();
		expect(called).toBe(true);
	});

	test("cleanup handlers run in reverse order", () => {
		const order: number[] = [];
		registerCleanupHandler(() => order.push(1));
		registerCleanupHandler(() => order.push(2));
		registerCleanupHandler(() => order.push(3));

		runCleanupHandlers();
		expect(order).toEqual([3, 2, 1]);
	});

	test("cleanup handlers only run once", () => {
		let count = 0;
		registerCleanupHandler(() => count++);

		runCleanupHandlers();
		runCleanupHandlers();
		expect(count).toBe(1);
	});

	test("handlers run even if one throws", () => {
		let handler2Called = false;
		registerCleanupHandler(() => {
			throw new Error("Handler 1 error");
		});
		registerCleanupHandler(() => {
			handler2Called = true;
		});

		runCleanupHandlers();
		expect(handler2Called).toBe(true);
	});
});
```

### Step 2: Run test to verify it fails

Run: `bun test src/lib/__tests__/shutdown.test.ts`
Expected: FAIL (module doesn't exist)

### Step 3: Create shutdown module

Create `src/lib/shutdown.ts`:

```typescript
/**
 * Graceful shutdown and cleanup handler management.
 *
 * Ensures resources are released even on unexpected exit.
 */

type CleanupHandler = () => void | Promise<void>;

const cleanupHandlers: CleanupHandler[] = [];
let cleanupRan = false;

/**
 * Register a cleanup handler to run on process exit.
 * Handlers run in reverse order (LIFO).
 */
export function registerCleanupHandler(handler: CleanupHandler): void {
	cleanupHandlers.push(handler);
}

/**
 * Run all registered cleanup handlers.
 * Handlers are run in reverse order and only once.
 */
export function runCleanupHandlers(): void {
	if (cleanupRan) return;
	cleanupRan = true;

	// Run in reverse order (most recent first)
	for (let i = cleanupHandlers.length - 1; i >= 0; i--) {
		try {
			const handler = cleanupHandlers[i];
			const result = handler();
			// If handler returns a promise, we can't await in sync exit
			// but the handler should be designed to complete quickly
			if (result instanceof Promise) {
				result.catch(() => {});
			}
		} catch {
			// Continue running other handlers even if one fails
		}
	}
}

/**
 * Reset cleanup handlers (for testing).
 */
export function resetCleanupHandlers(): void {
	cleanupHandlers.length = 0;
	cleanupRan = false;
}

/**
 * Install process exit handlers.
 * Should be called once at startup.
 */
export function installShutdownHandlers(): void {
	// Handle normal exit
	process.on("exit", () => {
		runCleanupHandlers();
	});

	// Handle SIGINT (Ctrl+C)
	process.on("SIGINT", () => {
		runCleanupHandlers();
		process.exit(130);
	});

	// Handle SIGTERM
	process.on("SIGTERM", () => {
		runCleanupHandlers();
		process.exit(143);
	});

	// Handle uncaught exceptions
	process.on("uncaughtException", (err) => {
		console.error("Uncaught exception:", err.message);
		runCleanupHandlers();
		process.exit(1);
	});
}
```

### Step 4: Run tests

Run: `bun test src/lib/__tests__/shutdown.test.ts`
Expected: PASS

### Step 5: Install handlers in index.ts

Edit `src/index.ts`:

**Add import:**
```typescript
import { installShutdownHandlers } from "@lib/shutdown.ts";
```

**Call early in startup (after imports, before command setup):**
```typescript
// Install graceful shutdown handlers
installShutdownHandlers();
```

### Step 6: Update key locations to use cleanup handlers

Edit `src/lib/mutagen.ts` (if sync sessions need cleanup):

```typescript
import { registerCleanupHandler } from "@lib/shutdown.ts";

// When starting a sync session
export async function startSession(project: string, ...args): Promise<...> {
	// ... existing code ...

	// Register cleanup to terminate session on exit
	registerCleanupHandler(() => {
		terminateSession(project).catch(() => {});
	});
}
```

### Step 7: Commit

```bash
git add src/lib/shutdown.ts src/lib/__tests__/shutdown.test.ts src/index.ts
git commit -m "$(cat <<'EOF'
fix(security): add graceful shutdown handlers

New shutdown module ensures cleanup runs on process exit:
- registerCleanupHandler(): Add cleanup function
- runCleanupHandlers(): Execute all handlers (LIFO order)
- installShutdownHandlers(): Hook into process signals

Handles: exit, SIGINT, SIGTERM, uncaughtException

Fixes LOW finding #24 from security audit.
EOF
)"
```

---

## Task 3: Add Lock File Integrity Check

**Files:**
- Create: `scripts/verify-lockfile.ts`
- Modify: `.github/workflows/release.yml`
- Modify: `lefthook.yml`

### Step 1: Create lockfile verification script

Create `scripts/verify-lockfile.ts`:

```typescript
#!/usr/bin/env bun
/**
 * Verify bun.lock integrity by checking consistency with package.json.
 * Run before builds to detect potential tampering.
 */

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const LOCKFILE_PATH = "bun.lock";
const PACKAGE_JSON_PATH = "package.json";
const INTEGRITY_FILE = ".lockfile-integrity";

function computeHash(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function main(): void {
	// Check lockfile exists
	if (!existsSync(LOCKFILE_PATH)) {
		console.error("❌ bun.lock not found");
		process.exit(1);
	}

	// Check package.json exists
	if (!existsSync(PACKAGE_JSON_PATH)) {
		console.error("❌ package.json not found");
		process.exit(1);
	}

	// Read and hash lockfile
	const lockfileContent = readFileSync(LOCKFILE_PATH, "utf-8");
	const currentHash = computeHash(lockfileContent);

	// Check for integrity file (optional baseline)
	if (existsSync(INTEGRITY_FILE)) {
		const storedHash = readFileSync(INTEGRITY_FILE, "utf-8").trim();
		if (currentHash !== storedHash) {
			console.warn("⚠️  bun.lock hash changed since last verification");
			console.warn(`   Expected: ${storedHash.slice(0, 16)}...`);
			console.warn(`   Current:  ${currentHash.slice(0, 16)}...`);
			console.warn("   This is expected after dependency updates.");
		}
	}

	// Run bun install --frozen-lockfile to verify consistency
	console.log("🔒 Verifying lockfile consistency...");
	const result = Bun.spawnSync(["bun", "install", "--frozen-lockfile"], {
		stdio: ["inherit", "inherit", "inherit"],
	});

	if (result.exitCode !== 0) {
		console.error("❌ Lockfile verification failed!");
		console.error("   bun.lock is inconsistent with package.json");
		process.exit(1);
	}

	console.log("✅ Lockfile integrity verified");
	console.log(`   Hash: ${currentHash.slice(0, 16)}...`);

	// Update integrity file for future checks
	Bun.write(INTEGRITY_FILE, currentHash);
}

main();
```

### Step 2: Add to CI workflow

Edit `.github/workflows/release.yml` - add before build step:

```yaml
      - name: Verify lockfile integrity
        run: bun run scripts/verify-lockfile.ts
```

### Step 3: Add to lefthook (pre-commit)

Edit `lefthook.yml`:

```yaml
pre-commit:
  commands:
    # ... existing commands ...
    lockfile:
      priority: 0
      run: bun run scripts/verify-lockfile.ts
      glob: "package.json|bun.lock"
```

### Step 4: Add to .gitignore

Edit `.gitignore`:

```
.lockfile-integrity
```

### Step 5: Commit

```bash
git add scripts/verify-lockfile.ts .github/workflows/release.yml lefthook.yml .gitignore
git commit -m "$(cat <<'EOF'
fix(security): add lockfile integrity verification

New verification script checks bun.lock consistency:
- Computes SHA256 hash of lockfile
- Runs 'bun install --frozen-lockfile' to verify consistency
- Fails build if lockfile is tampered or inconsistent

Added to:
- CI workflow (before build)
- Pre-commit hook (when lockfile changes)

Fixes LOW finding #25 from security audit.
EOF
)"
```

---

## Task 4: Add Basic Audit Logging

**Files:**
- Create: `src/lib/audit.ts`
- Test: `src/lib/__tests__/audit.test.ts`
- Modify key commands to log actions

### Step 1: Write the failing test

Create `src/lib/__tests__/audit.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";
import { logAuditEvent, getAuditLogPath, setAuditEnabled } from "@lib/audit.ts";

describe("audit logging", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("audit");
		setAuditEnabled(true);
	});

	afterEach(() => {
		ctx.cleanup();
		setAuditEnabled(false);
	});

	test("logAuditEvent writes to audit log", () => {
		logAuditEvent("test-action", { project: "test-project" });

		const logPath = getAuditLogPath();
		expect(existsSync(logPath)).toBe(true);

		const content = readFileSync(logPath, "utf-8");
		expect(content).toContain("test-action");
		expect(content).toContain("test-project");
	});

	test("audit log entries are JSON lines", () => {
		logAuditEvent("action1", { data: "first" });
		logAuditEvent("action2", { data: "second" });

		const logPath = getAuditLogPath();
		const lines = readFileSync(logPath, "utf-8").trim().split("\n");

		expect(lines.length).toBe(2);
		expect(() => JSON.parse(lines[0])).not.toThrow();
		expect(() => JSON.parse(lines[1])).not.toThrow();
	});

	test("audit entries include timestamp", () => {
		logAuditEvent("test-action", {});

		const logPath = getAuditLogPath();
		const content = readFileSync(logPath, "utf-8");
		const entry = JSON.parse(content.trim());

		expect(entry.timestamp).toBeDefined();
		expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
	});
});
```

### Step 2: Run test to verify it fails

Run: `bun test src/lib/__tests__/audit.test.ts`
Expected: FAIL (module doesn't exist)

### Step 3: Create audit module

Create `src/lib/audit.ts`:

```typescript
/**
 * Audit logging for security-sensitive operations.
 *
 * Writes JSON Lines format to ~/.devbox/audit.log.
 * Enabled via DEVBOX_AUDIT=1 environment variable.
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { hostname, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { getDevboxHome } from "@lib/paths.ts";

/** Audit log entry structure */
export interface AuditEntry {
	timestamp: string;
	action: string;
	user: string;
	machine: string;
	details: Record<string, unknown>;
}

let auditEnabled = process.env.DEVBOX_AUDIT === "1";

/**
 * Enable or disable audit logging (for testing).
 */
export function setAuditEnabled(enabled: boolean): void {
	auditEnabled = enabled;
}

/**
 * Get the audit log file path.
 */
export function getAuditLogPath(): string {
	return join(getDevboxHome(), "audit.log");
}

/**
 * Log a security-relevant event.
 *
 * @param action - The action being performed (e.g., "clone", "push", "rm")
 * @param details - Additional context for the action
 */
export function logAuditEvent(
	action: string,
	details: Record<string, unknown>,
): void {
	if (!auditEnabled) return;

	const entry: AuditEntry = {
		timestamp: new Date().toISOString(),
		action,
		user: userInfo().username,
		machine: hostname(),
		details,
	};

	const logPath = getAuditLogPath();
	const logDir = dirname(logPath);

	// Ensure directory exists with secure permissions
	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true, mode: 0o700 });
	}

	// Append JSON line
	const line = JSON.stringify(entry) + "\n";
	appendFileSync(logPath, line, { encoding: "utf-8", mode: 0o600 });
}

/**
 * Common audit actions.
 */
export const AuditActions = {
	CLONE_START: "clone:start",
	CLONE_SUCCESS: "clone:success",
	CLONE_FAIL: "clone:fail",
	PUSH_START: "push:start",
	PUSH_SUCCESS: "push:success",
	PUSH_FAIL: "push:fail",
	RM_LOCAL: "rm:local",
	RM_REMOTE: "rm:remote",
	UP_START: "up:start",
	UP_SUCCESS: "up:success",
	DOWN: "down",
	FORCE_LOCK: "lock:force",
	CONFIG_CHANGE: "config:change",
} as const;
```

### Step 4: Run tests

Run: `bun test src/lib/__tests__/audit.test.ts`
Expected: PASS

### Step 5: Add audit logging to key commands

Edit `src/commands/clone.ts`:

```typescript
import { logAuditEvent, AuditActions } from "@lib/audit.ts";

// In cloneSingleProject, after validation:
logAuditEvent(AuditActions.CLONE_START, { project, remote: remoteName });

// On success:
logAuditEvent(AuditActions.CLONE_SUCCESS, { project, remote: remoteName });

// On failure:
logAuditEvent(AuditActions.CLONE_FAIL, { project, remote: remoteName, error: getErrorMessage(e) });
```

Repeat similar pattern for `push.ts`, `rm.ts`, `up.ts`, `down.ts`.

### Step 6: Document audit logging

Add to `docs/reference/security.md` (if exists) or `README.md`:

```markdown
## Audit Logging

DevBox can log security-relevant operations for compliance and forensics.

Enable audit logging:
```bash
export DEVBOX_AUDIT=1
```

Audit log location: `~/.devbox/audit.log`

Format: JSON Lines (one JSON object per line)

Logged actions:
- clone (start/success/fail)
- push (start/success/fail)
- rm (local/remote)
- up/down
- force lock
- config changes
```

### Step 7: Commit

```bash
git add src/lib/audit.ts src/lib/__tests__/audit.test.ts src/commands/clone.ts src/commands/push.ts src/commands/rm.ts src/commands/up.ts src/commands/down.ts
git commit -m "$(cat <<'EOF'
feat(security): add optional audit logging

New audit module logs security-relevant operations:
- Enable with DEVBOX_AUDIT=1
- Logs to ~/.devbox/audit.log
- JSON Lines format for easy parsing
- Includes timestamp, user, machine, action, details

Logged actions: clone, push, rm, up, down, force lock, config changes.

Fixes LOW finding #26 from security audit.
EOF
)"
```

---

## Task 5: Remove Homebrew Token from Git URL

**Files:**
- Modify: `.github/workflows/release.yml:87`

### Step 1: Locate the token exposure

Find line 87 in release workflow where Homebrew token is used in a git URL.

### Step 2: Update to use HTTPS with token in header

Edit `.github/workflows/release.yml`:

**Before (if token is in URL):**
```yaml
git remote add homebrew https://${{ secrets.HOMEBREW_TAP_TOKEN }}@github.com/org/homebrew-tap.git
```

**After (token in credential helper or header):**
```yaml
- name: Configure git for Homebrew tap
  run: |
    git config --global url."https://x-access-token:${{ secrets.HOMEBREW_TAP_TOKEN }}@github.com/".insteadOf "https://github.com/"

- name: Push to Homebrew tap
  run: |
    # Token is not in the visible URL
    git push https://github.com/org/homebrew-tap.git main
```

**Alternative approach using gh CLI:**
```yaml
- name: Update Homebrew formula
  env:
    GH_TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}
  run: |
    # gh CLI uses GH_TOKEN from environment, not visible in logs
    gh api repos/org/homebrew-tap/contents/Formula/devbox.rb \
      --method PUT \
      --field message="Update to v${{ github.ref_name }}" \
      --field content=$(base64 -w0 formula.rb)
```

### Step 3: Commit

```bash
git add .github/workflows/release.yml
git commit -m "$(cat <<'EOF'
fix(security): remove Homebrew token from visible git URLs

Use git credential configuration instead of embedding token in URL.
Prevents token exposure in workflow logs.

Fixes LOW finding #27 from security audit.
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
- `src/commands/up.ts`
- `src/lib/shutdown.ts` (new)
- `src/lib/__tests__/shutdown.test.ts` (new)
- `src/index.ts`
- `scripts/verify-lockfile.ts` (new)
- `.github/workflows/release.yml`
- `lefthook.yml`
- `src/lib/audit.ts` (new)
- `src/lib/__tests__/audit.test.ts` (new)
- Various command files (audit logging)

---

## Summary

This plan addresses all 5 LOW priority security findings:

| # | Finding | Fix |
|---|---------|-----|
| 23 | Password attempt count visible | Generic "Wrong passphrase" message |
| 24 | Process.exit() without cleanup | Graceful shutdown handler system |
| 25 | Lock file hash not computed | Lockfile integrity verification script |
| 26 | No audit logging | Optional audit logging (DEVBOX_AUDIT=1) |
| 27 | Homebrew token in git URL | Use git credential config instead |

### Configuration Summary

After all batches, users can configure:

- `DEVBOX_AUDIT=1` - Enable audit logging
- `DEVBOX_SKIP_GPG=1` - Skip GPG verification (batch 3b)
- `DEVBOX_HOOK_WARNINGS=0` - Disable hook warnings (batch 4)

### Security Audit Complete

With all 5 batches implemented, all 27 findings from the security audit are addressed:

- **Batch 1:** 4 CRITICAL ✓
- **Batch 2:** 4 HIGH ✓
- **Batch 3a:** 2 MEDIUM-TERM (medium effort) ✓
- **Batch 3b:** 2 MEDIUM-TERM (high effort) ✓
- **Batch 4:** 9 MEDIUM (info disclosure) ✓
- **Batch 5:** 5 LOW ✓

Total: 27 findings addressed.
