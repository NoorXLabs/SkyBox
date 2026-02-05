# Security Remediation Batch 2: High Priority Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the HIGH priority security findings #5, #6, #9, and #10 from the security audit to harden DevBox before production use.

**Architecture:** Direct fixes to existing files. Temp file security uses `mkdtempSync()` for unpredictable paths. Argon2 parameters updated in constants. Validation standardized across all project name inputs. Remote path validation added during configuration.

**Tech Stack:** TypeScript, Bun test runner, Node.js fs module, existing validation utilities

---

## Overview

This batch addresses 4 HIGH priority findings scheduled for short-term remediation:

| # | Finding | File | Risk |
|---|---------|------|------|
| 5 | Predictable temp file paths | `encrypt.ts`, `up.ts` | Symlink attacks |
| 6 | Argon2 parameters below OWASP | `constants.ts` | Password cracking |
| 9 | Inconsistent project name validation | `rm.ts` | Attack surface inconsistency |
| 10 | Missing remote path validation | `remote.ts` | Shell metachar injection |

---

## Task 1: Fix Predictable Temp File Paths in encrypt.ts

**Files:**
- Modify: `src/commands/encrypt.ts:207-215`
- Test: `src/commands/__tests__/encrypt-tempfiles.test.ts` (create)

### Step 1: Write the failing test

Create `src/commands/__tests__/encrypt-tempfiles.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("secure temp file creation", () => {
	let tempDirs: string[] = [];

	afterEach(() => {
		// Cleanup any created temp directories
		for (const dir of tempDirs) {
			try {
				rmSync(dir, { recursive: true, force: true });
			} catch {}
		}
		tempDirs = [];
	});

	test("mkdtempSync creates unpredictable directory names", () => {
		// Create two temp directories and verify they differ
		const dir1 = mkdtempSync(join(tmpdir(), "devbox-"));
		const dir2 = mkdtempSync(join(tmpdir(), "devbox-"));
		tempDirs.push(dir1, dir2);

		expect(dir1).not.toBe(dir2);
		expect(dir1).toMatch(/devbox-[a-zA-Z0-9]+$/);
		expect(dir2).toMatch(/devbox-[a-zA-Z0-9]+$/);
	});

	test("mkdtempSync directories are not guessable from timestamp", () => {
		const timestamp = Date.now();
		const dir = mkdtempSync(join(tmpdir(), "devbox-"));
		tempDirs.push(dir);

		// Directory name should NOT contain the timestamp
		expect(dir).not.toContain(timestamp.toString());
	});
});
```

### Step 2: Run test to verify pattern works

Run: `bun test src/commands/__tests__/encrypt-tempfiles.test.ts`
Expected: PASS (test validates the pattern we'll use)

### Step 3: Update encrypt.ts to use secure temp directories

Edit `src/commands/encrypt.ts`. Update the imports at top:

```typescript
import { mkdtempSync, unlinkSync, rmSync } from "node:fs";
```

Replace lines 200-215 in `disableEncryption` function. Find:

```typescript
				const { tmpdir } = await import("node:os");
				const { join } = await import("node:path");
				const { unlinkSync } = await import("node:fs");
				const { execa } = await import("execa");

				const key = await deriveKey(passphrase, projectConfig.encryption.salt);
				const timestamp = Date.now();
				const localEncPath = join(
					tmpdir(),
					`devbox-${project}-${timestamp}.tar.enc`,
				);
				const localTarPath = join(
					tmpdir(),
					`devbox-${project}-${timestamp}.tar`,
				);
```

Replace with:

```typescript
				const { tmpdir } = await import("node:os");
				const { join } = await import("node:path");
				const { mkdtempSync, unlinkSync, rmSync } = await import("node:fs");
				const { execa } = await import("execa");

				const key = await deriveKey(passphrase, projectConfig.encryption.salt);
				// Use mkdtempSync for unpredictable temp directory (prevents symlink attacks)
				const tempDir = mkdtempSync(join(tmpdir(), "devbox-"));
				const localEncPath = join(tempDir, "archive.tar.enc");
				const localTarPath = join(tempDir, "archive.tar");
```

Update the finally block (around lines 241-247). Find:

```typescript
				} finally {
					try {
						unlinkSync(localEncPath);
					} catch {}
					try {
						unlinkSync(localTarPath);
					} catch {}
				}
```

Replace with:

```typescript
				} finally {
					// Clean up entire temp directory
					try {
						rmSync(tempDir, { recursive: true, force: true });
					} catch {}
				}
```

### Step 4: Run tests to verify no regressions

Run: `bun test src/commands/__tests__/encrypt-tempfiles.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/commands/encrypt.ts src/commands/__tests__/encrypt-tempfiles.test.ts
git commit -m "$(cat <<'EOF'
fix(security): use unpredictable temp dirs in encrypt.ts

Replace timestamp-based temp file names with mkdtempSync() which
generates cryptographically random directory names. This prevents
symlink attacks where attackers pre-create symlinks to intercept
encrypted archives.

Fixes HIGH priority finding #5 from security audit.
EOF
)"
```

---

## Task 2: Fix Predictable Temp File Paths in up.ts

**Files:**
- Modify: `src/commands/up.ts:385-394`
- Test: Already covered by Task 1 test

### Step 1: Locate the vulnerable code in up.ts

The vulnerable code is in the `decryptProjectArchive` function around lines 385-394:

```typescript
	const timestamp = Date.now();
	const localEncPath = join(tmpdir(), `devbox-${project}-${timestamp}.tar.enc`);
	const localTarPath = join(tmpdir(), `devbox-${project}-${timestamp}.tar`);
```

### Step 2: Update up.ts to use secure temp directories

Edit `src/commands/up.ts`. Find the imports section and add `mkdtempSync` and `rmSync`:

Locate:
```typescript
import { unlinkSync } from "node:fs";
```

And update to include the additional imports where needed (dynamic imports are used in the function).

Find the decryptProjectArchive function (around line 360) and locate:

```typescript
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const { unlinkSync } = await import("node:fs");
	const { execa } = await import("execa");

	const timestamp = Date.now();
	const localEncPath = join(tmpdir(), `devbox-${project}-${timestamp}.tar.enc`);
	const localTarPath = join(tmpdir(), `devbox-${project}-${timestamp}.tar`);
```

Replace with:

```typescript
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const { mkdtempSync, rmSync } = await import("node:fs");
	const { execa } = await import("execa");

	// Use mkdtempSync for unpredictable temp directory (prevents symlink attacks)
	const tempDir = mkdtempSync(join(tmpdir(), "devbox-"));
	const localEncPath = join(tempDir, "archive.tar.enc");
	const localTarPath = join(tempDir, "archive.tar");
```

### Step 3: Update cleanup code in up.ts

Find the cleanup code in the finally block or after the try/catch. Look for:

```typescript
		} finally {
			// Cleanup temp files
			try {
				unlinkSync(localEncPath);
			} catch {}
			try {
				unlinkSync(localTarPath);
			} catch {}
		}
```

Replace with:

```typescript
		} finally {
			// Clean up entire temp directory
			try {
				rmSync(tempDir, { recursive: true, force: true });
			} catch {}
		}
```

### Step 4: Run tests to verify no regressions

Run: `bun test`
Expected: All tests pass

### Step 5: Commit

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
fix(security): use unpredictable temp dirs in up.ts

Replace timestamp-based temp file names with mkdtempSync() in the
decryptProjectArchive function. Consistent with encrypt.ts fix.

Fixes HIGH priority finding #5 from security audit (part 2).
EOF
)"
```

---

## Task 3: Strengthen Argon2 Parameters

**Files:**
- Modify: `src/lib/constants.ts:162-166`
- Test: `src/lib/__tests__/encryption.test.ts` (verify existing tests still pass)

### Step 1: Review current parameters

Current values in `src/lib/constants.ts`:

```typescript
export const ARGON2_TIME_COST = 2;      // Too low per OWASP
export const ARGON2_PARALLELISM = 1;    // Too low per OWASP
```

OWASP recommends: `time_cost >= 3`, `parallelism >= 4` for Argon2id.

### Step 2: Update constants.ts with OWASP-compliant values

Edit `src/lib/constants.ts` lines 162-166. Find:

```typescript
/** Argon2 time cost (iterations). */
export const ARGON2_TIME_COST = 2;

/** Argon2 parallelism factor. */
export const ARGON2_PARALLELISM = 1;
```

Replace with:

```typescript
/** Argon2 time cost (iterations). OWASP minimum: 3. */
export const ARGON2_TIME_COST = 3;

/** Argon2 parallelism factor. OWASP minimum: 4. */
export const ARGON2_PARALLELISM = 4;
```

### Step 3: Run encryption tests to verify compatibility

Run: `bun test src/lib/__tests__/encryption.test.ts`
Expected: PASS (key derivation works with new parameters)

### Step 4: Run full test suite

Run: `bun test`
Expected: All tests pass

### Step 5: Commit

```bash
git add src/lib/constants.ts
git commit -m "$(cat <<'EOF'
fix(security): strengthen Argon2 parameters to OWASP minimums

Update Argon2 parameters to meet OWASP recommendations:
- time_cost: 2 -> 3 (iterations)
- parallelism: 1 -> 4 (threads)

This significantly increases resistance to GPU-based password attacks.
Note: Existing encrypted archives will still decrypt (salt stored per-project).

Fixes HIGH priority finding #6 from security audit.
EOF
)"
```

---

## Task 4: Standardize Project Name Validation in rm.ts

**Files:**
- Modify: `src/commands/rm.ts:30, 70-73`
- Test: `src/commands/__tests__/rm.test.ts` (add validation tests)

### Step 1: Write the failing test

Add to `src/commands/__tests__/rm.test.ts` (create if doesn't exist):

```typescript
import { describe, expect, test } from "bun:test";
import { validateProjectName } from "@lib/projectTemplates.ts";

describe("rm command validation", () => {
	test("validateProjectName rejects path traversal", () => {
		const result = validateProjectName("../etc/passwd");
		expect(result.valid).toBe(false);
	});

	test("validateProjectName rejects shell metacharacters", () => {
		const result = validateProjectName("project;rm -rf /");
		expect(result.valid).toBe(false);
	});

	test("validateProjectName rejects command substitution", () => {
		const result = validateProjectName("$(whoami)");
		expect(result.valid).toBe(false);
	});

	test("validateProjectName rejects backticks", () => {
		const result = validateProjectName("`id`");
		expect(result.valid).toBe(false);
	});

	test("validateProjectName accepts valid names", () => {
		expect(validateProjectName("my-project").valid).toBe(true);
		expect(validateProjectName("my_project").valid).toBe(true);
		expect(validateProjectName("myProject123").valid).toBe(true);
	});
});
```

### Step 2: Run test to verify validateProjectName handles these cases

Run: `bun test src/commands/__tests__/rm.test.ts --grep "validation"`
Expected: PASS (validateProjectName already blocks these patterns)

### Step 3: Update rm.ts to use validateProjectName

Edit `src/commands/rm.ts`. Update the import. Find:

```typescript
import { validatePath } from "@lib/validation.ts";
```

Replace with:

```typescript
import { validateProjectName } from "@lib/projectTemplates.ts";
```

Update the validation call. Find (around line 69-73):

```typescript
	// Validate project name
	const pathCheck = validatePath(project);
	if (!pathCheck.valid) {
		error(`Invalid project name: ${pathCheck.error}`);
		return;
	}
```

Replace with:

```typescript
	// Validate project name (consistent with clone.ts, new.ts, push.ts)
	const validation = validateProjectName(project);
	if (!validation.valid) {
		error(`Invalid project name: ${validation.error}`);
		return;
	}
```

### Step 4: Run tests to verify no regressions

Run: `bun test`
Expected: All tests pass

### Step 5: Commit

```bash
git add src/commands/rm.ts src/commands/__tests__/rm.test.ts
git commit -m "$(cat <<'EOF'
fix(security): standardize project name validation in rm.ts

Replace validatePath() with validateProjectName() to ensure consistent
validation across all commands that accept project names:
- clone.ts: validateProjectName ✓
- new.ts: validateProjectName ✓
- push.ts: validateProjectName ✓
- rm.ts: validateProjectName ✓ (was validatePath)

validateProjectName enforces alphanumeric + hyphen/underscore only,
blocking shell metacharacters and path traversal consistently.

Fixes HIGH priority finding #9 from security audit.
EOF
)"
```

---

## Task 5: Add Remote Path Validation

**Files:**
- Modify: `src/lib/validation.ts` (add validateRemotePath function)
- Modify: `src/commands/remote.ts:180-198`
- Test: `src/lib/__tests__/validation.test.ts`

### Step 1: Write the failing test

Add to `src/lib/__tests__/validation.test.ts` (create if doesn't exist):

```typescript
import { describe, expect, test } from "bun:test";
import { validateRemotePath } from "@lib/validation.ts";

describe("validateRemotePath", () => {
	test("accepts valid absolute paths", () => {
		expect(validateRemotePath("/home/user/code").valid).toBe(true);
		expect(validateRemotePath("/var/projects").valid).toBe(true);
	});

	test("accepts tilde paths", () => {
		expect(validateRemotePath("~/code").valid).toBe(true);
		expect(validateRemotePath("~/projects/devbox").valid).toBe(true);
	});

	test("rejects command substitution with $()", () => {
		const result = validateRemotePath("/home/$(rm -rf /)/code");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("command substitution");
	});

	test("rejects command substitution with backticks", () => {
		const result = validateRemotePath("/home/`whoami`/code");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("command substitution");
	});

	test("rejects semicolon command chaining", () => {
		const result = validateRemotePath("/home/user; rm -rf /");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("shell metacharacter");
	});

	test("rejects pipe command chaining", () => {
		const result = validateRemotePath("/home/user | cat /etc/passwd");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("shell metacharacter");
	});

	test("rejects ampersand command chaining", () => {
		const result = validateRemotePath("/home/user && rm -rf /");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("shell metacharacter");
	});

	test("rejects newlines", () => {
		const result = validateRemotePath("/home/user\nrm -rf /");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("shell metacharacter");
	});

	test("rejects empty paths", () => {
		const result = validateRemotePath("");
		expect(result.valid).toBe(false);
	});

	test("rejects paths with only whitespace", () => {
		const result = validateRemotePath("   ");
		expect(result.valid).toBe(false);
	});
});
```

### Step 2: Run test to verify it fails

Run: `bun test src/lib/__tests__/validation.test.ts --grep "validateRemotePath"`
Expected: FAIL (validateRemotePath doesn't exist yet)

### Step 3: Implement validateRemotePath function

Edit `src/lib/validation.ts`. Add the new function:

```typescript
/** Input validation utilities: path safety, traversal prevention, remote path security. */

export function isPathTraversal(path: string): boolean {
	const normalized = path.replace(/\\/g, "/");
	const segments = normalized.split("/");
	return segments.some((s) => s === "..");
}

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

/**
 * Validate a remote path for shell safety.
 * Allows absolute paths (/...) and tilde paths (~/...).
 * Blocks shell metacharacters that could enable command injection.
 */
export function validateRemotePath(
	path: string,
): { valid: true } | { valid: false; error: string } {
	if (!path || path.trim() === "") {
		return { valid: false, error: "Remote path cannot be empty" };
	}

	// Check for command substitution: $(...) or `...`
	if (/\$\(/.test(path) || /`/.test(path)) {
		return {
			valid: false,
			error: "Remote path cannot contain command substitution ($() or backticks)",
		};
	}

	// Check for shell metacharacters that enable command chaining
	// ; | & are command separators/chaining
	// \n \r can break out of commands
	const dangerousChars = /[;|&\n\r]/;
	if (dangerousChars.test(path)) {
		return {
			valid: false,
			error: "Remote path cannot contain shell metacharacters (;|&)",
		};
	}

	return { valid: true };
}
```

### Step 4: Run test to verify it passes

Run: `bun test src/lib/__tests__/validation.test.ts --grep "validateRemotePath"`
Expected: PASS

### Step 5: Integrate validation into remote.ts

Edit `src/commands/remote.ts`. Add import at top:

```typescript
import { validateRemotePath } from "@lib/validation.ts";
```

Find the remote add command's path prompt (around line 193-198):

```typescript
		{
			type: "input",
			name: "path",
			message: "Remote projects directory:",
			default: "~/code",
		},
```

Add validation to the prompt:

```typescript
		{
			type: "input",
			name: "path",
			message: "Remote projects directory:",
			default: "~/code",
			validate: (input: string) => {
				const result = validateRemotePath(input);
				return result.valid ? true : result.error;
			},
		},
```

### Step 6: Run full test suite

Run: `bun test`
Expected: All tests pass

### Step 7: Commit

```bash
git add src/lib/validation.ts src/lib/__tests__/validation.test.ts src/commands/remote.ts
git commit -m "$(cat <<'EOF'
fix(security): validate remote paths for shell metacharacters

Add validateRemotePath() function that blocks:
- Command substitution: $() and backticks
- Command chaining: ; | &
- Line breaks: \n \r

Integrate validation into 'devbox remote add' path prompt to prevent
malicious paths from being stored in config.

Note: escapeShellArg() in remote commands provides defense-in-depth,
but input validation at config time prevents the issue at source.

Fixes HIGH priority finding #10 from security audit.
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
- `src/commands/encrypt.ts`
- `src/commands/__tests__/encrypt-tempfiles.test.ts` (new)
- `src/commands/up.ts`
- `src/lib/constants.ts`
- `src/commands/rm.ts`
- `src/commands/__tests__/rm.test.ts` (new or updated)
- `src/lib/validation.ts`
- `src/lib/__tests__/validation.test.ts` (new or updated)
- `src/commands/remote.ts`

---

## Summary

This plan addresses all 4 HIGH priority security findings in Batch 2:

| # | Finding | Fix |
|---|---------|-----|
| 5 | Predictable temp file paths | Use `mkdtempSync()` for cryptographically random temp dirs |
| 6 | Argon2 parameters below OWASP | Increase time_cost to 3, parallelism to 4 |
| 9 | Inconsistent project name validation | Standardize on `validateProjectName()` in rm.ts |
| 10 | Missing remote path validation | Add `validateRemotePath()` and integrate into remote add |

### Migration Notes

- **Argon2 change**: Existing encrypted projects will still work because the salt is stored per-project. New encryptions will use stronger parameters. There is no migration needed.
- **Validation changes**: These are purely additive - existing valid configs remain valid.

After completing this batch, proceed to MEDIUM priority findings (#7, #8, #11, #17) in Batch 3.
