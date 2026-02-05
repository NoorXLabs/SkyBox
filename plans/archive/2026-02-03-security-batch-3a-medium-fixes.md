# Security Remediation Batch 3a: Medium-Term Fixes (Part 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix findings 8 (unsafe script piping) and 11 (lock takeover authorization) from the security audit.

**Architecture:** Finding 8 replaces `curl | bash` install patterns with safer alternatives using verified package managers or checksummed installers. Finding 11 adds authorization checks to `forceLock()` to prevent unauthorized lock hijacking.

**Tech Stack:** TypeScript, Bun test runner, Node.js crypto module, existing lock.ts patterns

---

## Overview

This batch addresses two MEDIUM-TERM findings that reduce risk when containers run and when locks are managed:

| # | Finding | File | Risk |
|---|---------|------|------|
| 8 | Unsafe script piping in devcontainer templates | `src/lib/constants.ts` | Arbitrary code execution in containers |
| 11 | Unconditional lock takeover without permission check | `src/lib/lock.ts` | Data loss from unauthorized takeover |

---

## Task 1: Replace Unsafe Script Piping in Bun Template

**Files:**
- Modify: `src/lib/constants.ts:258-259`
- Test: `src/lib/__tests__/constants.test.ts`

### Step 1: Write the failing test

Add to `src/lib/__tests__/constants.test.ts`:

```typescript
describe("template security", () => {
	test("bun template does not use curl pipe to bash", () => {
		const bunTemplate = TEMPLATES.find((t) => t.id === "bun");
		expect(bunTemplate).toBeDefined();

		const postCreateCommand = bunTemplate?.config.postCreateCommand ?? "";

		// Should not contain curl piped directly to bash/sh
		expect(postCreateCommand).not.toMatch(/curl\s+[^|]*\|\s*(ba)?sh/i);
	});

	test("no template uses curl pipe to bash pattern", () => {
		for (const template of TEMPLATES) {
			const postCreateCommand = template.config.postCreateCommand ?? "";
			const postStartCommand = template.config.postStartCommand ?? "";

			// Neither command should contain curl | bash
			expect(postCreateCommand).not.toMatch(/curl\s+[^|]*\|\s*(ba)?sh/i);
			expect(postStartCommand).not.toMatch(/curl\s+[^|]*\|\s*(ba)?sh/i);
		}
	});
});
```

### Step 2: Run test to verify it fails

Run: `bun test src/lib/__tests__/constants.test.ts --grep "template security"`
Expected: FAIL (bun template currently uses `curl | bash` pattern)

### Step 3: Write minimal implementation

Edit `src/lib/constants.ts` — replace the bun template's `postCreateCommand`:

**Before (line 258-259):**
```typescript
postCreateCommand:
	"curl -fsSL https://bun.sh/install | bash && [ -f package.json ] && bun install || true",
```

**After:**
```typescript
postCreateCommand:
	"npm install -g bun && [ -f package.json ] && bun install || true",
```

**Rationale:** The devcontainer already uses a Node.js base image with npm available. Installing bun via npm is:
1. Verified via npm's package integrity checks
2. No shell injection risk from piping untrusted content
3. Reproducible and auditable

### Step 4: Run test to verify it passes

Run: `bun test src/lib/__tests__/constants.test.ts --grep "template security"`
Expected: PASS

### Step 5: Run full test suite

Run: `bun test`
Expected: All tests pass

### Step 6: Commit

```bash
git add src/lib/constants.ts src/lib/__tests__/constants.test.ts
git commit -m "$(cat <<'EOF'
fix(security): replace curl|bash with npm install in bun template

Replace unsafe `curl | bash` pattern with `npm install -g bun` which:
- Uses npm's package integrity verification
- Eliminates shell injection risk from untrusted content
- Is reproducible and auditable

Fixes MEDIUM-TERM finding #8 from security audit.
EOF
)"
```

---

## Task 2: Add Lock Takeover Authorization Check

**Files:**
- Modify: `src/lib/lock.ts:178-197`
- Modify: `src/types/index.ts` (add new type)
- Test: `src/lib/__tests__/lock.test.ts`

### Step 1: Define the authorization model

The lock system needs to prevent unauthorized users from forcibly taking locks. The authorization rule is:

1. **Same user** on different machine: ALLOWED (user managing their own sessions)
2. **Different user**: DENIED (potential malicious takeover)
3. **Expired lock**: ALLOWED (lock is stale, fair game)
4. **No existing lock**: ALLOWED (nothing to protect)

### Step 2: Write the failing test

Add to `src/lib/__tests__/lock.test.ts`:

```typescript
import { hostname, userInfo } from "node:os";

describe("forceLock authorization", () => {
	test("forceLock succeeds when no lock exists", async () => {
		// Mock runRemoteCommand to simulate no existing lock
		const mockRunRemote = mock.module("@lib/ssh.ts", () => ({
			runRemoteCommand: async () => ({ success: true, stdout: "" }),
		}));

		const result = await forceLock("test-project", {
			host: "test-host",
			basePath: "/home/test",
		});

		expect(result.success).toBe(true);
	});

	test("forceLock succeeds when same user on different machine", async () => {
		const currentUser = userInfo().username;
		const existingLock = {
			machine: "other-machine",
			user: currentUser, // Same user
			timestamp: new Date().toISOString(),
			pid: 12345,
			expires: new Date(Date.now() + 3600000).toISOString(),
		};

		// Mock to return existing lock owned by same user
		mock.module("@lib/ssh.ts", () => ({
			runRemoteCommand: async (host: string, cmd: string) => {
				if (cmd.includes("cat")) {
					return { success: true, stdout: JSON.stringify(existingLock) };
				}
				return { success: true, stdout: "" };
			},
		}));

		const result = await forceLock("test-project", {
			host: "test-host",
			basePath: "/home/test",
		});

		expect(result.success).toBe(true);
	});

	test("forceLock fails when different user holds lock", async () => {
		const existingLock = {
			machine: "other-machine",
			user: "different-user", // Different user
			timestamp: new Date().toISOString(),
			pid: 12345,
			expires: new Date(Date.now() + 3600000).toISOString(),
		};

		mock.module("@lib/ssh.ts", () => ({
			runRemoteCommand: async (host: string, cmd: string) => {
				if (cmd.includes("cat")) {
					return { success: true, stdout: JSON.stringify(existingLock) };
				}
				return { success: true, stdout: "" };
			},
		}));

		const result = await forceLock("test-project", {
			host: "test-host",
			basePath: "/home/test",
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("different-user");
		expect(result.unauthorized).toBe(true);
	});

	test("forceLock succeeds when existing lock is expired", async () => {
		const existingLock = {
			machine: "other-machine",
			user: "different-user",
			timestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
			pid: 12345,
			expires: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
		};

		mock.module("@lib/ssh.ts", () => ({
			runRemoteCommand: async (host: string, cmd: string) => {
				if (cmd.includes("cat")) {
					return { success: true, stdout: JSON.stringify(existingLock) };
				}
				return { success: true, stdout: "" };
			},
		}));

		const result = await forceLock("test-project", {
			host: "test-host",
			basePath: "/home/test",
		});

		expect(result.success).toBe(true);
	});
});
```

### Step 3: Run test to verify it fails

Run: `bun test src/lib/__tests__/lock.test.ts --grep "forceLock authorization"`
Expected: FAIL (forceLock currently doesn't check authorization)

### Step 4: Add unauthorized field to return type

Edit `src/types/index.ts` - update the force lock result signature. First, add a new interface after `LockReleaseResult`:

```typescript
/** Result of force-acquiring a lock */
export interface ForceLockResult {
	success: boolean;
	error?: string;
	unauthorized?: boolean; // True if blocked due to authorization failure
}
```

### Step 5: Update forceLock to check authorization

Edit `src/lib/lock.ts` - replace the `forceLock` function:

```typescript
import { userInfo } from "node:os";
import type { ForceLockResult } from "@typedefs/index.ts";

/**
 * Force-acquire a lock by directly overwriting the lock file.
 *
 * Authorization rules:
 * - No existing lock: ALLOWED
 * - Expired lock: ALLOWED (lock is stale)
 * - Same user (any machine): ALLOWED (user managing own sessions)
 * - Different user: DENIED (unauthorized takeover attempt)
 */
export async function forceLock(
	project: string,
	remoteInfo: LockRemoteInfo,
): Promise<ForceLockResult> {
	// Check existing lock status first
	const status = await getLockStatus(project, remoteInfo);

	// If lock exists and is valid (not expired), check authorization
	if (status.locked && status.info) {
		const currentUser = userInfo().username;
		const lockOwner = status.info.user;

		// Only allow force if same user (managing their own sessions)
		if (lockOwner !== currentUser) {
			return {
				success: false,
				error: `Cannot force lock: held by user '${lockOwner}' on ${status.info.machine}. Only the lock owner can force takeover.`,
				unauthorized: true,
			};
		}
	}

	// Authorized — proceed with force lock
	const lockInfo = createLockInfo();
	const lockPath = getLockPath(project, remoteInfo.basePath);
	const locksDir = getLocksDir(remoteInfo.basePath);
	const json = JSON.stringify(lockInfo);
	const jsonBase64 = Buffer.from(json).toString("base64");

	// Direct overwrite — no noclobber
	const command = `mkdir -p ${escapeShellArg(locksDir)} && echo ${escapeShellArg(jsonBase64)} | base64 -d > ${escapeShellArg(lockPath)}`;
	const result = await runRemoteCommand(remoteInfo.host, command);

	if (!result.success) {
		return { success: false, error: result.error || "Failed to force lock" };
	}

	return { success: true };
}
```

### Step 6: Update import at top of lock.ts

Add `userInfo` to the existing os import:

```typescript
import { hostname, userInfo } from "node:os";
```

### Step 7: Run test to verify it passes

Run: `bun test src/lib/__tests__/lock.test.ts --grep "forceLock authorization"`
Expected: PASS

### Step 8: Run full test suite

Run: `bun test`
Expected: All tests pass

### Step 9: Run type check

Run: `bun run typecheck`
Expected: No errors

### Step 10: Commit

```bash
git add src/lib/lock.ts src/types/index.ts src/lib/__tests__/lock.test.ts
git commit -m "$(cat <<'EOF'
fix(security): add authorization check to forceLock

Force lock now checks if the caller is authorized:
- No existing lock: ALLOWED
- Expired lock: ALLOWED (stale)
- Same user on different machine: ALLOWED (managing own sessions)
- Different user: DENIED with unauthorized flag

This prevents malicious users from hijacking another user's project
locks when sharing SSH access to a remote server.

Fixes MEDIUM-TERM finding #11 from security audit.
EOF
)"
```

---

## Task 3: Update Commands Using forceLock

**Files:**
- Modify: `src/commands/up.ts` (if forceLock is called there)
- Check other callers of forceLock

### Step 1: Find all callers of forceLock

Run: `grep -r "forceLock" src/`

Identify all places where `forceLock` is called and ensure they handle the `unauthorized` case properly.

### Step 2: Update callers to handle unauthorized response

If `src/commands/up.ts` or other files call `forceLock`, update the error handling:

```typescript
const forceResult = await forceLock(project, remoteInfo);
if (!forceResult.success) {
	if (forceResult.unauthorized) {
		error("Authorization denied: " + forceResult.error);
		info("Only the lock owner can force a takeover. Contact the lock holder.");
	} else {
		error(forceResult.error || "Failed to force lock");
	}
	process.exit(1);
}
```

### Step 3: Run full test suite

Run: `bun test`
Expected: All tests pass

### Step 4: Commit

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
fix(security): handle unauthorized forceLock in up command

Display helpful message when force lock fails due to authorization:
- Clearly state authorization was denied
- Suggest contacting the lock holder

Follows up on forceLock authorization check.
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
- `src/lib/constants.ts`
- `src/lib/__tests__/constants.test.ts`
- `src/lib/lock.ts`
- `src/lib/__tests__/lock.test.ts`
- `src/types/index.ts`
- `src/commands/up.ts` (if applicable)

---

## Summary

This plan addresses two MEDIUM-TERM security findings:

1. **Unsafe script piping (Finding 8)** - Replaced `curl | bash` with `npm install -g bun` for package integrity verification
2. **Lock takeover authorization (Finding 11)** - Added user-based authorization check to prevent unauthorized hijacking

After completing this batch, proceed to Batch 3b for the HIGH-effort findings (7 and 17).
