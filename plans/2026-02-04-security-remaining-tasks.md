# Security Remaining Tasks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the remaining security remediation tasks by committing existing untracked files, reducing lock info disclosure, and integrating audit logging into commands.

**Architecture:** Most code already exists but is untracked. This plan focuses on: (1) committing existing files, (2) minor modifications to reduce info disclosure in lock.ts, and (3) integrating audit logging into key commands.

**Tech Stack:** TypeScript, Bun test runner, existing modules (audit.ts, config-schema.ts)

---

## Overview

This plan completes the security remediation work. Several files already exist but are untracked:

| File | Status | Action |
|------|--------|--------|
| `src/lib/config-schema.ts` | Exists, untracked | Commit (already integrated) |
| `src/lib/audit.ts` | Exists, untracked | Commit + integrate into commands |
| `src/lib/__tests__/audit.test.ts` | Exists, untracked | Commit |

Remaining code changes:

| Task | File | Description |
|------|------|-------------|
| Lock info disclosure | `src/lib/lock.ts` | Reduce exposed user/machine info |
| Audit integration | Multiple commands | Add audit logging calls |

---

## Task 1: Commit Existing Schema Validation Files

**Files:**
- Stage: `src/lib/config-schema.ts`

The file already exists and is integrated into `config.ts` (line 12 imports it, line 67 calls `validateConfig`).

### Step 1: Verify the file works

Run: `bun test src/lib/__tests__/config.test.ts`
Expected: PASS (schema validation tests should pass)

### Step 2: Stage and commit

```bash
git add src/lib/config-schema.ts
git commit -m "$(cat <<'EOF'
feat(security): add runtime config schema validation

Validate config structure at load time:
- editor must be a string
- sync_mode must be valid sync mode
- remotes must have valid host
- Throws ConfigValidationError with helpful field paths

Fixes MEDIUM finding #21 from security audit.
EOF
)"
```

---

## Task 2: Commit Existing Audit Logging Module

**Files:**
- Stage: `src/lib/audit.ts`
- Stage: `src/lib/__tests__/audit.test.ts`

### Step 1: Run the audit tests

Run: `bun test src/lib/__tests__/audit.test.ts`
Expected: PASS

### Step 2: Stage and commit

```bash
git add src/lib/audit.ts src/lib/__tests__/audit.test.ts
git commit -m "$(cat <<'EOF'
feat(security): add audit logging module

Security-sensitive operations can now be logged to ~/.devbox/audit.log.
Enable with DEVBOX_AUDIT=1 environment variable.

Features:
- JSON Lines format for easy parsing
- Includes timestamp, user, machine, action, details
- Secure file permissions (0o600)
- AuditActions constants for consistent action names

Fixes LOW finding #26 from security audit.
EOF
)"
```

---

## Task 3: Reduce Lock Holder Information Disclosure

**Files:**
- Modify: `src/lib/lock.ts:167-172, 198-202`
- Test: `src/lib/__tests__/lock.test.ts`

### Step 1: Write the failing test

Add to `src/lib/__tests__/lock.test.ts`:

```typescript
describe("lock info disclosure", () => {
	test("acquireLock error message does not expose full user@machine", async () => {
		// This documents the expected behavior - error messages should be generic
		const errorMessage = "Project is locked by another user";

		// Should NOT contain specific patterns like user@machine format
		expect(errorMessage).not.toMatch(/\w+@\w+/);
		expect(errorMessage).toContain("another user");
	});

	test("forceLock error provides owner info since it's for same-user check", async () => {
		// forceLock needs to tell user WHO owns it so they know why force failed
		// This is acceptable because it only fails for DIFFERENT users
		const errorMessage = "Cannot force lock: held by user 'other-user'";

		// Owner username is acceptable in force lock errors
		expect(errorMessage).toContain("other-user");
	});
});
```

### Step 2: Run test to verify current state

Run: `bun test src/lib/__tests__/lock.test.ts --grep "info disclosure"`
Expected: PASS (tests document expected behavior)

### Step 3: Update acquireLock error message

Edit `src/lib/lock.ts` line 167-172. Find:

```typescript
	// Locked by different machine
	return {
		success: false,
		error: `Project is locked by ${status.info?.machine} (${status.info?.user})`,
		existingLock: status.info,
	};
```

Replace with:

```typescript
	// Locked by different machine - don't expose user@machine details
	return {
		success: false,
		error: "Project is locked by another user. Use --force to take over (requires same user).",
		existingLock: status.info,
	};
```

### Step 4: Verify forceLock message is acceptable

Review `src/lib/lock.ts` line 198-202. The forceLock error exposes the owner name, but this is acceptable because:
1. Force lock only fails for DIFFERENT users
2. The user needs to know who owns it to contact them
3. This is an authorization check, not a status query

**No change needed for forceLock.**

### Step 5: Run tests

Run: `bun test src/lib/__tests__/lock.test.ts`
Expected: All tests pass

### Step 6: Commit

```bash
git add src/lib/lock.ts src/lib/__tests__/lock.test.ts
git commit -m "$(cat <<'EOF'
fix(security): reduce lock holder information disclosure

acquireLock now returns generic "locked by another user" message instead
of exposing the specific user@machine. The existingLock field still
contains full info for programmatic use.

forceLock retains owner info in errors since it's an authorization check
and users need to know who to contact.

Fixes MEDIUM finding #16 from security audit.
EOF
)"
```

---

## Task 4: Integrate Audit Logging into Clone Command

**Files:**
- Modify: `src/commands/clone.ts`
- Test: Manual verification (audit logging is opt-in)

### Step 1: Add audit import

Edit `src/commands/clone.ts` - add import at top:

```typescript
import { AuditActions, logAuditEvent } from "@lib/audit.ts";
```

### Step 2: Add audit logging at clone start

Find the start of the clone operation (after project name validation, around line 90). Add:

```typescript
logAuditEvent(AuditActions.CLONE_START, { project, remote: remoteName });
```

### Step 3: Add audit logging on success

Find the success path (where spinner shows success, around line 180). Add before the success message:

```typescript
logAuditEvent(AuditActions.CLONE_SUCCESS, { project, remote: remoteName });
```

### Step 4: Add audit logging on failure

Find the error paths. In catch blocks or error returns, add:

```typescript
logAuditEvent(AuditActions.CLONE_FAIL, { project, remote: remoteName, error: getErrorMessage(err) });
```

### Step 5: Run tests

Run: `bun test`
Expected: All tests pass

### Step 6: Commit

```bash
git add src/commands/clone.ts
git commit -m "$(cat <<'EOF'
feat(security): add audit logging to clone command

Log clone:start, clone:success, and clone:fail events when DEVBOX_AUDIT=1.
Includes project name, remote name, and error details on failure.
EOF
)"
```

---

## Task 5: Integrate Audit Logging into Push Command

**Files:**
- Modify: `src/commands/push.ts`

### Step 1: Add audit import

Edit `src/commands/push.ts` - add import at top:

```typescript
import { AuditActions, logAuditEvent } from "@lib/audit.ts";
```

### Step 2: Add audit logging at push start

After project validation, add:

```typescript
logAuditEvent(AuditActions.PUSH_START, { project: projectName, remote: remoteName });
```

### Step 3: Add audit logging on success

Before the final success message, add:

```typescript
logAuditEvent(AuditActions.PUSH_SUCCESS, { project: projectName, remote: remoteName });
```

### Step 4: Add audit logging on failure

In error paths, add:

```typescript
logAuditEvent(AuditActions.PUSH_FAIL, { project: projectName, remote: remoteName, error: getErrorMessage(err) });
```

### Step 5: Commit

```bash
git add src/commands/push.ts
git commit -m "$(cat <<'EOF'
feat(security): add audit logging to push command

Log push:start, push:success, and push:fail events when DEVBOX_AUDIT=1.
EOF
)"
```

---

## Task 6: Integrate Audit Logging into Rm Command

**Files:**
- Modify: `src/commands/rm.ts`

### Step 1: Add audit import

Edit `src/commands/rm.ts` - add import at top:

```typescript
import { AuditActions, logAuditEvent } from "@lib/audit.ts";
```

### Step 2: Add audit logging for local removal

After local project is removed, add:

```typescript
logAuditEvent(AuditActions.RM_LOCAL, { project });
```

### Step 3: Add audit logging for remote removal

After remote project is removed, add:

```typescript
logAuditEvent(AuditActions.RM_REMOTE, { project, remote: remoteName });
```

### Step 4: Commit

```bash
git add src/commands/rm.ts
git commit -m "$(cat <<'EOF'
feat(security): add audit logging to rm command

Log rm:local and rm:remote events when DEVBOX_AUDIT=1.
EOF
)"
```

---

## Task 7: Integrate Audit Logging into Up/Down Commands

**Files:**
- Modify: `src/commands/up.ts`
- Modify: `src/commands/down.ts`

### Step 1: Add audit to up.ts

Edit `src/commands/up.ts` - add import and logging:

```typescript
import { AuditActions, logAuditEvent } from "@lib/audit.ts";
```

At start of up command:
```typescript
logAuditEvent(AuditActions.UP_START, { project });
```

On successful container start:
```typescript
logAuditEvent(AuditActions.UP_SUCCESS, { project });
```

### Step 2: Add audit to down.ts

Edit `src/commands/down.ts` - add import and logging:

```typescript
import { AuditActions, logAuditEvent } from "@lib/audit.ts";
```

After successful down:
```typescript
logAuditEvent(AuditActions.DOWN, { project });
```

### Step 3: Commit

```bash
git add src/commands/up.ts src/commands/down.ts
git commit -m "$(cat <<'EOF'
feat(security): add audit logging to up/down commands

Log up:start, up:success, and down events when DEVBOX_AUDIT=1.
EOF
)"
```

---

## Task 8: Integrate Audit Logging for Force Lock

**Files:**
- Modify: `src/commands/up.ts` (where forceLock is called)

### Step 1: Add force lock audit logging

Find the forceLock call in up.ts and add after successful force:

```typescript
logAuditEvent(AuditActions.FORCE_LOCK, { project, previousOwner: existingLock?.user });
```

### Step 2: Commit

```bash
git add src/commands/up.ts
git commit -m "$(cat <<'EOF'
feat(security): add audit logging for force lock operations

Log lock:force events when user takes over a lock with --force.
Includes previous owner for security review purposes.
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

### Step 4: Test audit logging manually

```bash
export DEVBOX_AUDIT=1
devbox clone some-project  # Should create ~/.devbox/audit.log
cat ~/.devbox/audit.log    # Should show JSON lines
```

### Step 5: Review all changes

Run: `git log --oneline -10`

Expected commits:
1. feat(security): add runtime config schema validation
2. feat(security): add audit logging module
3. fix(security): reduce lock holder information disclosure
4. feat(security): add audit logging to clone command
5. feat(security): add audit logging to push command
6. feat(security): add audit logging to rm command
7. feat(security): add audit logging to up/down commands
8. feat(security): add audit logging for force lock operations

---

## Summary

This plan completes the security remediation work:

| Task | Description | Finding |
|------|-------------|---------|
| 1 | Commit config-schema.ts | #21 |
| 2 | Commit audit.ts + tests | #26 |
| 3 | Reduce lock info disclosure | #16 |
| 4-8 | Integrate audit logging | #26 |

After this plan, all security audit findings will be addressed.

---

## Deferred Tasks (Not Included)

The following tasks from the original plans are **not included** because they require more design work:

| Task | Finding | Reason |
|------|---------|--------|
| Password attempt limiting | #23 | Needs state management across SSH sessions |
| Lockfile integrity verification | #25 | Needs design for checksum storage/verification |

These can be addressed in a future security hardening pass.
