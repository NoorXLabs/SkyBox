# Plan: Security Audit Fixes

**Date:** 2026-02-05
**Source:** `.context/security-audit-report.md`
**Branch:** `NoorChasib/security-audit-fixes` (create from `main`)

---

## Overview

Fix all 10 findings from the security audit (3 HIGH, 4 MEDIUM, 3 LOW). Changes are grouped into 6 tasks, ordered by severity and dependency.

---

## Task 1: Add `--` to all SCP invocations (H1)

**Why:** Prevents SCP option injection via crafted hostnames (e.g., `evil.com -o ProxyCommand=malicious`).

**Files to change:**
- `src/commands/encrypt.ts` — lines 222, 229
- `src/commands/down.ts` — lines 123, 131
- `src/commands/up.ts` — lines 443, 452

**Change pattern (all 6 occurrences):**

```typescript
// BEFORE
await execa("scp", [`${host}:${remoteArchivePath}`, localEncPath]);

// AFTER
await execa("scp", ["--", `${host}:${remoteArchivePath}`, localEncPath]);
```

Specific locations:

1. `encrypt.ts:222` — `await execa("scp", ["--", ...)` (download encrypted archive)
2. `encrypt.ts:229` — `await execa("scp", ["--", ...)` (upload decrypted tar)
3. `down.ts:123` — `await execa("scp", ["--", ...)` (download tar)
4. `down.ts:131` — `await execa("scp", ["--", ...)` (upload encrypted archive)
5. `up.ts:443` — `await execa("scp", ["--", ...)` (download encrypted archive)
6. `up.ts:452` — `await execa("scp", ["--", ...)` (upload decrypted tar)

**Tests:** Add unit tests in `tests/unit/commands/` verifying the `--` separator is present in the execa call args for each SCP invocation. Can mock `execa` and assert the args array.

---

## Task 2: Escape basePath in browse.ts (H2)

**Why:** `basePath` is the only remote command argument in the codebase that skips `escapeShellArg()`. Shell metacharacters in the config value would execute on the remote.

**File:** `src/commands/browse.ts`

**Change:**

```typescript
// BEFORE (line 16)
const script = `for d in "${basePath}"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    branch=$(git -C "$d" branch --show-current 2>/dev/null || echo "-")
    echo "$name|$branch"
  done`;

// AFTER
import { escapeShellArg } from "@lib/shell.ts";

const script = `for d in ${escapeShellArg(basePath)}/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    branch=$(git -C "$d" branch --show-current 2>/dev/null || echo "-")
    echo "$name|$branch"
  done`;
```

Note: `escapeShellArg` wraps in single quotes, so the double quotes around `"${basePath}"` must be removed. The single-quote wrapping from `escapeShellArg` provides stronger protection.

**Tests:** Unit test that `getRemoteProjects()` calls `runRemoteCommand` with a script containing the escaped basePath. Test with a basePath containing special characters like spaces and quotes.

---

## Task 3: Add `validateSSHHost()` and validate SSH config fields (H3, M1, M2)

**Why:** Closes SSH config injection (H3), missing init validation (M1), and hostname validation gap (M2) in one pass.

### Step 3a: Add validation functions to `src/lib/validation.ts`

Add two new functions after the existing `validateRemotePath()`:

```typescript
/**
 * Validate an SSH hostname or user@host string.
 * Allows: alphanumeric, dots, hyphens, underscores, @, colons (IPv6).
 * Blocks: newlines, spaces, shell metacharacters, quotes.
 */
export function validateSSHHost(host: string): { valid: true } | { valid: false; error: string } {
	if (!host || host.trim() === "") {
		return { valid: false, error: "Host cannot be empty" };
	}
	if (!/^[a-zA-Z0-9@._:\-]+$/.test(host)) {
		return { valid: false, error: "Host contains invalid characters" };
	}
	return { valid: true };
}

/**
 * Validate an SSH config field value (hostname, username, friendly name).
 * Blocks newlines and characters that could inject SSH config directives.
 */
export function validateSSHField(value: string, fieldName: string): { valid: true } | { valid: false; error: string } {
	if (!value || value.trim() === "") {
		return { valid: false, error: `${fieldName} cannot be empty` };
	}
	if (/[\n\r]/.test(value)) {
		return { valid: false, error: `${fieldName} cannot contain newlines` };
	}
	if (!/^[a-zA-Z0-9@._~:\-/]+$/.test(value)) {
		return { valid: false, error: `${fieldName} contains invalid characters` };
	}
	return { valid: true };
}
```

### Step 3b: Validate in `writeSSHConfigEntry()` (`src/lib/ssh.ts:174-199`)

Before building the config string (around line 193), validate all fields:

```typescript
import { validateSSHField } from "@lib/validation.ts";

// Add validation before building config entry (after the duplicate check)
for (const [field, value] of Object.entries({
	name: entry.name,
	hostname: entry.hostname,
	user: entry.user,
	identityFile: entry.identityFile,
})) {
	if (value) {
		const result = validateSSHField(value, field);
		if (!result.valid) {
			return { success: false, error: result.error };
		}
	}
}
```

### Step 3c: Add inquirer validators in `src/commands/init.ts:119-132`

```typescript
import { validateSSHField, validateSSHHost } from "@lib/validation.ts";

// hostname prompt (line 120)
{
	type: "input",
	name: "hostname",
	message: "Server hostname or IP:",
	validate: (v: string) => {
		const r = validateSSHField(v, "Hostname");
		return r.valid || r.error;
	},
}

// username prompt (line 122-126)
{
	type: "input",
	name: "username",
	message: "SSH username:",
	default: "root",
	validate: (v: string) => {
		const r = validateSSHField(v, "Username");
		return r.valid || r.error;
	},
}

// friendlyName prompt (line 128-131)
{
	type: "input",
	name: "friendlyName",
	message: "Friendly name for this host:",
	validate: (v: string) => {
		const r = validateSSHField(v, "Name");
		return r.valid || r.error;
	},
}
```

### Step 3d: Validate custom SSH key path in `src/commands/init.ts:156-163`

Add path validation for the custom key input:

```typescript
// customPath prompt (line 158-162)
{
	type: "input",
	name: "customPath",
	message: "Path to SSH private key:",
	default: "~/.ssh/id_ed25519",
	validate: (v: string) => {
		const r = validateSSHField(v, "Key path");
		return r.valid || r.error;
	},
}
```

Also check `src/commands/remote.ts` for any similar add-remote prompts that accept hostname/username/key path and add the same validators there.

**Tests:**
- Unit tests for `validateSSHHost()` and `validateSSHField()` in `tests/unit/lib/validation.test.ts`:
  - Valid: `"myserver"`, `"user@host"`, `"192.168.1.1"`, `"host.example.com"`
  - Invalid: `"host\nProxyCommand=evil"`, `"host;rm -rf /"`, `""`, `"host name"` (space)
- Unit test that `writeSSHConfigEntry()` rejects entries with newlines in any field

---

## Task 4: Sanitize audit log details (M3)

**Why:** The `details` field in audit log entries may contain file paths or error messages with sensitive data. Apply the same sanitization used elsewhere.

**File:** `src/lib/audit.ts`

**Change:** Add a `sanitizeDetails()` function and apply before writing:

```typescript
import { homedir } from "node:os";

/**
 * Sanitize audit log details to prevent sensitive data leakage.
 * Replaces home directory paths with ~ and redacts credential patterns.
 */
function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
	const home = homedir();
	const sanitized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(details)) {
		if (typeof value === "string") {
			let clean = value;
			if (home && clean.includes(home)) {
				clean = clean.replaceAll(home, "~");
			}
			// Redact credential-like patterns
			clean = clean.replace(/password[=:]\S+/gi, "password=[REDACTED]");
			clean = clean.replace(/token[=:]\S+/gi, "token=[REDACTED]");
			sanitized[key] = clean;
		} else {
			sanitized[key] = value;
		}
	}
	return sanitized;
}
```

Apply in `logAuditEvent()` at line 72:

```typescript
// BEFORE
details,

// AFTER
details: sanitizeDetails(details),
```

**Tests:** Unit test in `tests/unit/lib/audit.test.ts` verifying:
- Home directory replaced with `~`
- `password=secret` redacted
- Non-string values passed through unchanged

---

## Task 5: Validate Docker container IDs (M4)

**Why:** Container IDs from `docker ps` are used in `docker stop`, `docker rm`, `docker exec` without format validation. Corrupted Docker output could cause unexpected behavior.

**File:** `src/lib/container.ts`

**Change:** Add a validation helper and apply after `queryDockerContainers` returns:

```typescript
/** Validate a Docker container ID (short or full hex format). */
function isValidContainerId(id: string): boolean {
	return /^[a-f0-9]{12,64}$/.test(id);
}
```

Apply in `getContainerId()` (line 97-109):

```typescript
export async function getContainerId(
	projectPath: string,
): Promise<string | null> {
	try {
		const containerId = await queryDockerContainers({
			projectPath,
			idsOnly: true,
		});
		if (!containerId || !isValidContainerId(containerId)) return null;
		return containerId;
	} catch {
		return null;
	}
}
```

Also apply the check in `getContainerInfo()` after parsing the `\t`-separated line — validate the `.ID` field.

**Tests:** Unit test for `isValidContainerId()`:
- Valid: `"abc123def456"` (12 hex), `"abc123def456..."` (64 hex)
- Invalid: `""`, `"not-hex"`, `"abc"` (too short), strings with newlines

---

## Task 6: Low-severity improvements (L1, L2, L3)

### Step 6a: Log warning when GPG is skipped (L1)

**File:** `src/lib/download.ts`

In the download flow, after checking `isGpgPreferred()` returns false, add a visible warning:

```typescript
import { warn } from "@lib/ui.ts";

// Where GPG skip is detected (around the gpg check):
if (!isGpgPreferred()) {
	warn("GPG signature verification disabled (SKYBOX_SKIP_GPG=1). Using checksum-only verification.");
}
```

### Step 6b: Document legacy crypto deprecation timeline (L2)

No code change. Add a note to `plans/IMPLEMENTATION.md` under a future milestone:

```markdown
- [ ] Add `skybox encrypt migrate` subcommand to re-encrypt data with current Argon2 parameters
- [ ] Deprecate legacy Argon2 fallback in v0.9.0
```

### Step 6c: Add audit log rotation (L3)

**File:** `src/lib/audit.ts`

Add rotation check at the start of `logAuditEvent()`:

```typescript
import { renameSync, statSync } from "node:fs";

const AUDIT_LOG_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Inside logAuditEvent(), after ensuring directory exists:
if (existsSync(logPath)) {
	try {
		const stats = statSync(logPath);
		if (stats.size > AUDIT_LOG_MAX_BYTES) {
			const rotatedPath = `${logPath}.${new Date().toISOString().slice(0, 10)}`;
			renameSync(logPath, rotatedPath);
		}
	} catch {}
}
```

Add `AUDIT_LOG_MAX_BYTES` to `src/lib/constants.ts`.

**Tests:**
- L1: Verify warning is printed when `SKYBOX_SKIP_GPG=1` during download
- L3: Unit test that audit log is rotated when exceeding size threshold

---

## Documentation Updates Required

After all fixes are implemented:

- [ ] `docs/reference/security.md` (if exists) — document the SSH field validation, SCP hardening
- [ ] `CHANGELOG.md` — add security fixes under `## [Unreleased]`
- [ ] `CLAUDE.md` — add gotcha about SSH config field validation requirement

---

## Test Summary

| Task | New Test File / Location | Test Count |
|------|--------------------------|------------|
| T1 | `tests/unit/commands/encrypt.test.ts`, `down.test.ts`, `up.test.ts` | ~6 |
| T2 | `tests/unit/commands/browse.test.ts` | ~2 |
| T3 | `tests/unit/lib/validation.test.ts`, `tests/unit/lib/ssh.test.ts` | ~10 |
| T4 | `tests/unit/lib/audit.test.ts` | ~3 |
| T5 | `tests/unit/lib/container.test.ts` | ~4 |
| T6 | `tests/unit/lib/audit.test.ts`, `tests/unit/lib/download.test.ts` | ~3 |

---

## Verification Checklist

After implementation, run:

```bash
bun run check          # Biome lint + format
bun run typecheck      # TypeScript strict
bun run test           # All unit tests
bun run test:integration  # Docker tests (if available)
```

Confirm no regressions in existing tests and all new tests pass.
