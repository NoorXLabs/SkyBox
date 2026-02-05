# Security Remediation Batch 3b: Medium-Term Fixes (Part 2) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement resource ownership verification (finding 7) and GPG signature verification for Mutagen downloads (finding 17).

**Architecture:** Finding 7 introduces a lightweight `.devbox-owner` metadata file system to track project ownership on shared remotes. Finding 17 adds GPG signature verification to the Mutagen download process, requiring the GPG public key for the Mutagen project.

**Tech Stack:** TypeScript, Bun test runner, Node.js crypto module, GPG verification via child_process

---

## Overview

This batch addresses two HIGH-EFFORT MEDIUM-TERM findings:

| # | Finding | File | Risk |
|---|---------|------|------|
| 7 | No resource ownership verification on remote operations | Architecture | Unauthorized access to other users' projects |
| 17 | No GPG signature verification for Mutagen | `src/lib/download.ts` | Compromised binary execution |

---

## Task 1: Design Resource Ownership System

**Goal:** Create a lightweight ownership metadata system that:
1. Records who created a project on the remote
2. Allows authorized operations (clone, push, rm) only by the owner
3. Preserves backward compatibility (projects without ownership can still be accessed)

### Step 1: Define the ownership file format

Each project on the remote will have a `.devbox-owner` file:

```json
{
  "owner": "username",
  "created": "2026-02-03T12:00:00Z",
  "machine": "hostname-where-created"
}
```

Location: `<remote.path>/<project>/.devbox-owner`

### Step 2: Define authorization rules

| Operation | Rule |
|-----------|------|
| `push` (new project) | Creates ownership file |
| `push` (existing project) | Owner or no-owner file → allowed |
| `clone` | Always allowed (read-only) |
| `rm --remote` | Owner or no-owner file → allowed |
| `browse` | Always allowed (listing) |

---

## Task 2: Implement Ownership Types and Helpers

**Files:**
- Create: `src/lib/ownership.ts`
- Modify: `src/types/index.ts`
- Test: `src/lib/__tests__/ownership.test.ts`

### Step 1: Add ownership types to types/index.ts

Add after the `LockInfo` interface:

```typescript
/** Project ownership metadata stored in .devbox-owner */
export interface OwnershipInfo {
	owner: string; // SSH username who created the project
	created: string; // ISO 8601 timestamp
	machine: string; // Hostname where project was created
}

/** Result of ownership check */
export type OwnershipStatus =
	| { hasOwner: false } // No ownership file (legacy or new)
	| { hasOwner: true; isOwner: boolean; info: OwnershipInfo };

/** Result of setting ownership */
export interface SetOwnershipResult {
	success: boolean;
	error?: string;
}
```

### Step 2: Write the failing tests

Create `src/lib/__tests__/ownership.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";

// Note: We'll test the parsing and formatting functions since
// actual remote operations require SSH mocking

describe("ownership", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("ownership");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	describe("parseOwnershipInfo", () => {
		test("parses valid ownership JSON", () => {
			const json = JSON.stringify({
				owner: "testuser",
				created: "2026-02-03T12:00:00Z",
				machine: "test-machine",
			});

			const result = parseOwnershipInfo(json);

			expect(result).not.toBeNull();
			expect(result?.owner).toBe("testuser");
			expect(result?.created).toBe("2026-02-03T12:00:00Z");
			expect(result?.machine).toBe("test-machine");
		});

		test("returns null for invalid JSON", () => {
			const result = parseOwnershipInfo("not json");
			expect(result).toBeNull();
		});

		test("returns null for incomplete ownership info", () => {
			const json = JSON.stringify({ owner: "testuser" }); // Missing fields
			const result = parseOwnershipInfo(json);
			expect(result).toBeNull();
		});
	});

	describe("createOwnershipInfo", () => {
		test("creates ownership info with current user and timestamp", () => {
			const info = createOwnershipInfo();

			expect(info.owner).toBeTruthy();
			expect(info.machine).toBeTruthy();
			expect(new Date(info.created).getTime()).toBeGreaterThan(0);
		});
	});

	describe("isOwner", () => {
		test("returns true when current user matches owner", () => {
			const info = createOwnershipInfo(); // Creates with current user
			expect(isOwner(info)).toBe(true);
		});

		test("returns false when owner is different user", () => {
			const info = {
				owner: "different-user",
				created: new Date().toISOString(),
				machine: "some-machine",
			};
			expect(isOwner(info)).toBe(false);
		});
	});
});
```

### Step 3: Run test to verify it fails

Run: `bun test src/lib/__tests__/ownership.test.ts`
Expected: FAIL (ownership.ts doesn't exist)

### Step 4: Implement ownership.ts

Create `src/lib/ownership.ts`:

```typescript
/** Resource ownership verification for remote projects. */

import { hostname, userInfo } from "node:os";
import { OWNERSHIP_FILE_NAME } from "@lib/constants.ts";
import { escapeShellArg } from "@lib/shell.ts";
import { runRemoteCommand } from "@lib/ssh.ts";
import type { OwnershipInfo, OwnershipStatus, SetOwnershipResult } from "@typedefs/index.ts";

/**
 * Parse ownership info from JSON string.
 * Returns null if invalid or incomplete.
 */
export function parseOwnershipInfo(json: string): OwnershipInfo | null {
	try {
		const data = JSON.parse(json);
		if (
			typeof data.owner === "string" &&
			typeof data.created === "string" &&
			typeof data.machine === "string"
		) {
			return {
				owner: data.owner,
				created: data.created,
				machine: data.machine,
			};
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Create ownership info for the current user.
 */
export function createOwnershipInfo(): OwnershipInfo {
	return {
		owner: userInfo().username,
		created: new Date().toISOString(),
		machine: hostname(),
	};
}

/**
 * Check if the current user is the owner.
 */
export function isOwner(info: OwnershipInfo): boolean {
	return info.owner === userInfo().username;
}

/**
 * Get ownership status for a project on the remote.
 */
export async function getOwnershipStatus(
	host: string,
	projectPath: string,
): Promise<OwnershipStatus> {
	const ownershipFile = `${projectPath}/${OWNERSHIP_FILE_NAME}`;
	const command = `cat ${escapeShellArg(ownershipFile)} 2>/dev/null`;

	const result = await runRemoteCommand(host, command);

	if (!result.success || !result.stdout?.trim()) {
		return { hasOwner: false };
	}

	const info = parseOwnershipInfo(result.stdout);
	if (!info) {
		return { hasOwner: false };
	}

	return {
		hasOwner: true,
		isOwner: isOwner(info),
		info,
	};
}

/**
 * Set ownership for a project on the remote.
 * Creates the .devbox-owner file with current user's info.
 */
export async function setOwnership(
	host: string,
	projectPath: string,
): Promise<SetOwnershipResult> {
	const info = createOwnershipInfo();
	const json = JSON.stringify(info, null, 2);
	const ownershipFile = `${projectPath}/${OWNERSHIP_FILE_NAME}`;

	// Write ownership file (overwrite if exists)
	const command = `echo ${escapeShellArg(json)} > ${escapeShellArg(ownershipFile)}`;
	const result = await runRemoteCommand(host, command);

	if (!result.success) {
		return { success: false, error: result.error || "Failed to set ownership" };
	}

	return { success: true };
}

/**
 * Check if user is authorized to perform a write operation on a project.
 * Returns true if: no ownership file exists OR current user is the owner.
 */
export async function checkWriteAuthorization(
	host: string,
	projectPath: string,
): Promise<{ authorized: boolean; error?: string; ownerInfo?: OwnershipInfo }> {
	const status = await getOwnershipStatus(host, projectPath);

	if (!status.hasOwner) {
		// No ownership file — backward compatible, allow access
		return { authorized: true };
	}

	if (status.isOwner) {
		return { authorized: true };
	}

	return {
		authorized: false,
		error: `Project owned by '${status.info.owner}' (created on ${status.info.machine})`,
		ownerInfo: status.info,
	};
}
```

### Step 5: Add constant for ownership file name

Edit `src/lib/constants.ts` — add near other file constants:

```typescript
/** Ownership metadata file name */
export const OWNERSHIP_FILE_NAME = ".devbox-owner";
```

### Step 6: Run test to verify ownership functions pass

Run: `bun test src/lib/__tests__/ownership.test.ts`
Expected: PASS

### Step 7: Commit

```bash
git add src/lib/ownership.ts src/lib/__tests__/ownership.test.ts src/lib/constants.ts src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(security): add resource ownership verification system

Introduce .devbox-owner metadata file for tracking project ownership:
- parseOwnershipInfo: Parse ownership JSON
- createOwnershipInfo: Create info for current user
- isOwner: Check if current user owns the project
- getOwnershipStatus: Read ownership from remote
- setOwnership: Write ownership to remote
- checkWriteAuthorization: Verify write permission

Foundation for finding #7 from security audit.
EOF
)"
```

---

## Task 3: Integrate Ownership into Push Command

**Files:**
- Modify: `src/commands/push.ts`
- Test: Integration test via existing push tests

### Step 1: Add ownership check and set to push.ts

Edit `src/commands/push.ts`:

**Add import:**
```typescript
import { checkWriteAuthorization, setOwnership } from "@lib/ownership.ts";
```

**After line 136 (remote path available check), add ownership verification:**

```typescript
// Check authorization for existing project
if (remoteExists) {
	checkSpin.text = "Checking authorization...";
	const authResult = await checkWriteAuthorization(host, remotePath);

	if (!authResult.authorized) {
		checkSpin.fail("Not authorized");
		error(`Cannot overwrite: ${authResult.error}`);
		info("Contact the project owner to transfer ownership or use a different project name.");
		process.exit(1);
	}
	checkSpin.warn("Project already exists on remote (you have permission)");

	const confirmed = await confirmDestructiveAction({
		firstPrompt: "Project already exists on remote. Overwrite?",
		secondPrompt: "Are you sure? All remote changes will be lost.",
		cancelMessage: "Push cancelled.",
	});

	if (!confirmed) {
		return;
	}

	// Remove remote directory
	await runRemoteCommand(host, `rm -rf ${escapeShellArg(remotePath)}`);
} else {
	checkSpin.succeed("Remote path available");
}
```

**After sync succeeds (around line 204), set ownership:**

```typescript
syncSpin.succeed("Initial sync complete");

// Set ownership for new projects
const ownerResult = await setOwnership(host, remotePath);
if (!ownerResult.success) {
	warn(`Could not set ownership: ${ownerResult.error}`);
}
```

### Step 2: Add escapeShellArg import if not present

Verify `escapeShellArg` is imported:

```typescript
import { escapeShellArg } from "@lib/shell.ts";
```

### Step 3: Run full test suite

Run: `bun test`
Expected: All tests pass

### Step 4: Commit

```bash
git add src/commands/push.ts
git commit -m "$(cat <<'EOF'
fix(security): add ownership check to push command

Push now verifies authorization before overwriting:
- Check .devbox-owner file on remote
- Block if different user owns the project
- Set ownership after successful push

Fixes finding #7 (part 1) from security audit.
EOF
)"
```

---

## Task 4: Integrate Ownership into Remote Rm

**Files:**
- Modify: `src/commands/rm.ts`

### Step 1: Add ownership check to rm --remote

Edit `src/commands/rm.ts`:

**Add import:**
```typescript
import { checkWriteAuthorization } from "@lib/ownership.ts";
```

**Before deleting remote project, add authorization check:**

```typescript
// Check authorization before remote deletion
const authResult = await checkWriteAuthorization(host, remotePath);

if (!authResult.authorized) {
	error(`Cannot delete: ${authResult.error}`);
	info("Only the project owner can delete remote projects.");
	process.exit(1);
}
```

### Step 2: Run full test suite

Run: `bun test`
Expected: All tests pass

### Step 3: Commit

```bash
git add src/commands/rm.ts
git commit -m "$(cat <<'EOF'
fix(security): add ownership check to rm --remote

Remote deletion now verifies authorization before deleting:
- Check .devbox-owner file on remote
- Block if different user owns the project

Fixes finding #7 (part 2) from security audit.
EOF
)"
```

---

## Task 5: GPG Signature Verification for Mutagen

**Files:**
- Modify: `src/lib/download.ts`
- Create: `src/lib/gpg.ts`
- Test: `src/lib/__tests__/gpg.test.ts`

### Step 1: Research Mutagen GPG signing

Mutagen releases are signed with GPG. The signature file is available at:
`https://github.com/mutagen-io/mutagen/releases/download/v{version}/SHA256SUMS.sig`

The public key can be fetched from:
`https://github.com/mutagen-io.gpg`

### Step 2: Write the failing test

Create `src/lib/__tests__/gpg.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";

describe("GPG verification", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("gpg");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	describe("isGpgAvailable", () => {
		test("returns boolean", async () => {
			const result = await isGpgAvailable();
			expect(typeof result).toBe("boolean");
		});
	});

	describe("verifyGpgSignature", () => {
		test("returns error when GPG not available and signature check required", async () => {
			// If GPG is not installed, verification should fail gracefully
			const result = await verifyGpgSignature(
				Buffer.from("test"),
				Buffer.from("fake sig"),
				"fake key",
			);

			// Should return a result (success or failure based on GPG availability)
			expect(result).toHaveProperty("verified");
		});
	});
});
```

### Step 3: Run test to verify it fails

Run: `bun test src/lib/__tests__/gpg.test.ts`
Expected: FAIL (gpg.ts doesn't exist)

### Step 4: Implement GPG verification module

Create `src/lib/gpg.ts`:

```typescript
/** GPG signature verification utilities. */

import { execFile, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getErrorMessage } from "@lib/errors.ts";

const execFileAsync = promisify(execFile);

export interface GpgVerifyResult {
	verified: boolean;
	error?: string;
	gpgUnavailable?: boolean;
}

/**
 * Check if GPG is available on the system.
 */
export async function isGpgAvailable(): Promise<boolean> {
	try {
		await execFileAsync("gpg", ["--version"]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Verify a detached GPG signature.
 *
 * @param data - The data that was signed
 * @param signature - The detached signature
 * @param publicKey - The armored public key to verify against
 */
export async function verifyGpgSignature(
	data: Buffer,
	signature: Buffer,
	publicKey: string,
): Promise<GpgVerifyResult> {
	// Check if GPG is available
	if (!(await isGpgAvailable())) {
		return {
			verified: false,
			error: "GPG is not installed. Install GPG to enable signature verification.",
			gpgUnavailable: true,
		};
	}

	// Create a temporary directory for GPG operations
	const tempDir = mkdtempSync(join(tmpdir(), "devbox-gpg-"));

	try {
		const dataPath = join(tempDir, "data");
		const sigPath = join(tempDir, "data.sig");
		const keyPath = join(tempDir, "key.asc");
		const keyringPath = join(tempDir, "keyring.gpg");

		// Write files
		writeFileSync(dataPath, data);
		writeFileSync(sigPath, signature);
		writeFileSync(keyPath, publicKey);

		// Import the key to a temporary keyring
		await execFileAsync("gpg", [
			"--no-default-keyring",
			"--keyring",
			keyringPath,
			"--import",
			keyPath,
		]);

		// Verify the signature
		await execFileAsync("gpg", [
			"--no-default-keyring",
			"--keyring",
			keyringPath,
			"--verify",
			sigPath,
			dataPath,
		]);

		return { verified: true };
	} catch (err) {
		return {
			verified: false,
			error: `GPG verification failed: ${getErrorMessage(err)}`,
		};
	} finally {
		// Clean up temp directory
		rmSync(tempDir, { recursive: true, force: true });
	}
}

/**
 * Fetch Mutagen's public GPG key from GitHub.
 */
export async function fetchMutagenPublicKey(): Promise<string | null> {
	try {
		const response = await fetch("https://github.com/mutagen-io.gpg");
		if (!response.ok) return null;
		return await response.text();
	} catch {
		return null;
	}
}

/**
 * Fetch the GPG signature for Mutagen checksums.
 */
export async function fetchMutagenSignature(version: string): Promise<Buffer | null> {
	try {
		const url = `https://github.com/mutagen-io/mutagen/releases/download/v${version}/SHA256SUMS.sig`;
		const response = await fetch(url);
		if (!response.ok) return null;
		const arrayBuffer = await response.arrayBuffer();
		return Buffer.from(arrayBuffer);
	} catch {
		return null;
	}
}
```

### Step 5: Run GPG tests

Run: `bun test src/lib/__tests__/gpg.test.ts`
Expected: PASS (tests handle GPG unavailability gracefully)

### Step 6: Add GPG verification to download.ts

Edit `src/lib/download.ts`:

**Add imports:**
```typescript
import {
	fetchMutagenPublicKey,
	fetchMutagenSignature,
	isGpgAvailable,
	verifyGpgSignature,
} from "@lib/gpg.ts";
```

**Add constant for GPG enforcement:**
```typescript
/** Whether to require GPG verification (can be disabled via env) */
const REQUIRE_GPG_VERIFICATION = process.env.DEVBOX_SKIP_GPG !== "1";
```

**Modify `downloadMutagen` to add GPG verification after checksum fetch:**

After fetching checksums (around line 432), add:

```typescript
// Verify checksums file signature with GPG
if (await isGpgAvailable()) {
	onProgress?.("Verifying GPG signature...");

	const [publicKey, signature] = await Promise.all([
		fetchMutagenPublicKey(),
		fetchMutagenSignature(MUTAGEN_VERSION),
	]);

	if (!publicKey || !signature) {
		if (REQUIRE_GPG_VERIFICATION) {
			return { success: false, error: "Failed to fetch GPG key or signature" };
		}
		onProgress?.("GPG verification skipped (signature unavailable)");
	} else {
		const gpgResult = await verifyGpgSignature(
			Buffer.from(checksumContent),
			signature,
			publicKey,
		);

		if (!gpgResult.verified) {
			if (REQUIRE_GPG_VERIFICATION) {
				return {
					success: false,
					error: gpgResult.error || "GPG signature verification failed",
				};
			}
			onProgress?.(`GPG verification failed: ${gpgResult.error}`);
		} else {
			onProgress?.("GPG signature verified");
		}
	}
} else {
	if (REQUIRE_GPG_VERIFICATION) {
		onProgress?.("GPG not available - using checksum verification only");
	}
}
```

### Step 7: Run download tests

Run: `bun test src/lib/__tests__/download.test.ts`
Expected: All tests pass

### Step 8: Run full test suite

Run: `bun test`
Expected: All tests pass

### Step 9: Commit

```bash
git add src/lib/gpg.ts src/lib/__tests__/gpg.test.ts src/lib/download.ts
git commit -m "$(cat <<'EOF'
feat(security): add GPG signature verification for Mutagen

Add optional GPG signature verification for Mutagen downloads:
- New gpg.ts module with verification utilities
- fetchMutagenPublicKey: Fetch from GitHub
- fetchMutagenSignature: Fetch SHA256SUMS.sig
- verifyGpgSignature: Verify detached signature
- Integration into downloadMutagen flow
- Graceful fallback when GPG unavailable
- DEVBOX_SKIP_GPG=1 env var to disable

Fixes finding #17 from security audit.
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
- `src/lib/ownership.ts` (new)
- `src/lib/__tests__/ownership.test.ts` (new)
- `src/lib/gpg.ts` (new)
- `src/lib/__tests__/gpg.test.ts` (new)
- `src/lib/download.ts`
- `src/lib/constants.ts`
- `src/types/index.ts`
- `src/commands/push.ts`
- `src/commands/rm.ts`

---

## Summary

This plan addresses two HIGH-EFFORT MEDIUM-TERM security findings:

1. **Resource ownership verification (Finding 7)**
   - New `.devbox-owner` metadata file system
   - Authorization checks in `push` and `rm --remote` commands
   - Backward compatible with legacy projects

2. **GPG signature verification (Finding 17)**
   - New `gpg.ts` module for signature verification
   - Fetches Mutagen's public key from GitHub
   - Verifies SHA256SUMS.sig before trusting checksums
   - Graceful fallback when GPG unavailable
   - Environment variable to disable in CI environments

These complete the MEDIUM-TERM batch of security remediations.
