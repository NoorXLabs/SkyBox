# Security Audit Review Fixes

**Branch:** `NoorChasib/security-audit-src`
**Date:** 2026-02-06
**Source:** Code review of security hardening changes

## Overview

The security audit branch is strong overall. These are the issues identified during review, ordered by priority.

---

## Fixes

### 1. Reword misleading GPG progress message (Low)

**File:** `src/lib/download.ts:218-221`

**Problem:** When `SKYBOX_SKIP_GPG=1`, the message says "GPG signature verification disabled" but `verifyGpgChecksums()` still attempts verification if GPG is available (just treating failures as non-fatal). This misleads users about what's actually happening.

**Fix:** Change the progress message to reflect reality:

```typescript
// Before
onProgress?.(
    "GPG signature verification disabled (SKYBOX_SKIP_GPG=1). Using checksum-only verification.",
);

// After
onProgress?.(
    "GPG verification is best-effort (SKYBOX_SKIP_GPG=1). Failures will not block installation.",
);
```

---

### 2. Broaden credential redaction in audit sanitizer (Low)

**File:** `src/lib/audit.ts:66-67`

**Problem:** The regex only covers `password=` and `token=`. Common credential patterns like `secret=`, `api_key=`, `apikey=`, `auth=` are not redacted.

**Fix:** Replace the two separate regexes with a single broader pattern:

```typescript
// Before
clean = clean.replace(/password[=:]\S+/gi, "password=[REDACTED]");
clean = clean.replace(/token[=:]\S+/gi, "token=[REDACTED]");

// After
clean = clean.replace(
    /(?:password|token|secret|api_?key|auth(?:orization)?)[=:]\S+/gi,
    (match) => `${match.split(/[=:]/)[0]}=[REDACTED]`,
);
```

This preserves the key name in the redacted output (e.g., `api_key=[REDACTED]`).

---

### 3. Simplify `cloneSingleProject` config parameter type (Low)

**File:** `src/commands/clone.ts:14, 47-49`

**Problem:** `type loadConfig` is imported solely for `ReturnType<typeof loadConfig>` on line 47. Since all callers now use `requireConfig()` (which returns non-null `SkyboxConfigV2`), the nullable type and the null-check on line 49 are dead code.

**Fix:**

```typescript
// Before (line 14)
import { type loadConfig, requireConfig, saveConfig } from "@lib/config.ts";

// After
import { requireConfig, saveConfig } from "@lib/config.ts";

// Before (line 44-49)
export async function cloneSingleProject(
    project: string,
    remoteName: string,
    config: ReturnType<typeof loadConfig>,
): Promise<boolean> {
    if (!config) return false;

// After
export async function cloneSingleProject(
    project: string,
    remoteName: string,
    config: SkyboxConfigV2,
): Promise<boolean> {
```

Add `import type { SkyboxConfigV2 } from "@typedefs/index.ts"` if not already imported (check existing imports first).

---

### 4. Guard `secureScp` test against missing binary (Low)

**File:** `tests/unit/lib/ssh.test.ts:192-207`

**Problem:** The `secureScp` test calls the real `scp` binary. If `scp` isn't installed in the CI environment, the test fails in a confusing way.

**Fix:** Add a skip guard:

```typescript
import { existsSync } from "node:fs";

const scpAvailable = existsSync("/usr/bin/scp") || existsSync("/usr/local/bin/scp");

// Then wrap the test:
test.skipIf(!scpAvailable)(
    "treats malicious source as literal filename via -- separator",
    async () => { ... }
);
```

Or check with `which scp` via a helper at the top of the describe block.

---

### 5. Document shallow-only sanitization contract (Low)

**File:** `src/lib/audit.ts:54-56`

**Problem:** `sanitizeDetails` only processes top-level string values. If callers later pass nested objects with credentials, those won't be redacted.

**Fix:** Add a JSDoc note making the contract explicit:

```typescript
/**
 * Sanitize audit log details to prevent sensitive data leakage.
 * Replaces home directory paths with ~ and redacts credential patterns.
 *
 * NOTE: Only sanitizes top-level string values. Nested objects are passed
 * through as-is. Callers should ensure sensitive data is in top-level fields.
 */
```

---

### 6. Add comment about TOCTOU in log rotation (Low)

**File:** `src/lib/audit.ts:108-115`

**Problem:** The `statSync` + `renameSync` pattern has a race if two SkyBox processes write concurrently. Not a real risk for a CLI tool, but worth documenting.

**Fix:** Add a brief comment:

```typescript
// Rotate log if it exceeds size threshold.
// Note: slight TOCTOU race with concurrent processes; second rename fails
// silently which is acceptable — both processes will create a new log file.
try {
```

---

## Non-actionable Notes (for tracking)

### Placeholder GPG fingerprint (`src/lib/constants.ts:139-149`)

The `MUTAGEN_GPG_FINGERPRINT` is a placeholder. Fingerprint pinning is effectively inert until mutagen-io publishes their GPG key. The TODO in the code already tracks this. No action needed now — just be aware that GPG verification falls through to the non-fatal path for all users.

**Follow-up:** When mutagen-io publishes a GPG key, replace the fingerprint value and remove the TODO.

---

## Checklist

- [ ] Fix 1: Reword GPG progress message in `download.ts`
- [ ] Fix 2: Broaden credential regex in `audit.ts`
- [ ] Fix 3: Simplify `cloneSingleProject` config type in `clone.ts`
- [ ] Fix 4: Guard `secureScp` test in `ssh.test.ts`
- [ ] Fix 5: Document shallow sanitization in `audit.ts`
- [ ] Fix 6: Add TOCTOU comment in `audit.ts`
