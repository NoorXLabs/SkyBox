# Team Sharing Audit: Findings and Recommended Fixes

**Date:** 2026-02-01
**Status:** Draft
**Scope:** Docs accuracy, lock system bugs, workflow gaps

---

## 1. Critical Bugs

### 1.1 `releaseLock()` Doesn't Check Ownership

**File:** `src/lib/lock.ts:165-179`

**Problem:** `releaseLock()` does a blind `rm -f` on the lock file without verifying the caller owns the lock. If Alice holds a lock, Bob takes it over, then Alice runs `skybox down`, Alice deletes Bob's lock.

**Impact:** Bob works without a lock unknowingly. A third developer could start working on the same project, causing sync conflicts.

**Fix:** Read the lock file before deleting. Only delete if the current machine owns it. If someone else owns it, skip deletion and warn.

```typescript
export async function releaseLock(
  project: string,
  remoteInfo: LockRemoteInfo,
): Promise<{ success: boolean; error?: string }> {
  // Check ownership before releasing
  const status = await getLockStatus(project, remoteInfo);

  if (status.locked && !status.ownedByMe) {
    // Lock was taken over by another machine — don't delete it
    return { success: true }; // Not an error, just a no-op
  }

  const lockPath = getLockPath(project, remoteInfo.basePath);
  const command = `rm -f ${escapeShellArg(lockPath)}`;
  const result = await runRemoteCommand(remoteInfo.host, command);

  if (!result.success) {
    return { success: false, error: result.error || "Failed to release lock" };
  }

  return { success: true };
}
```

**Note:** There's a small TOCTOU window between the check and the delete, but it's acceptable — the worst case is a brief moment where no lock exists, which is the same as normal `skybox down` behavior.

### 1.2 Lock Takeover Race Condition

**File:** `src/commands/up.ts:163-176`

**Problem:** Takeover does `releaseLock()` then `acquireLock()` as two separate operations. Between them, a third machine could acquire the lock.

**Fix:** Add a `forceLock()` function that atomically overwrites the lock file without checking noclobber:

```typescript
export async function forceLock(
  project: string,
  remoteInfo: LockRemoteInfo,
): Promise<{ success: boolean; error?: string }> {
  const lockInfo = createLockInfo();
  const lockPath = getLockPath(project, remoteInfo.basePath);
  const locksDir = getLocksDir(remoteInfo.basePath);
  const json = JSON.stringify(lockInfo);
  const jsonBase64 = Buffer.from(json).toString("base64");

  // Direct overwrite — no noclobber, no check
  const command = `mkdir -p ${escapeShellArg(locksDir)} && echo '${jsonBase64}' | base64 -d > ${escapeShellArg(lockPath)}`;
  const result = await runRemoteCommand(remoteInfo.host, command);

  if (!result.success) {
    return { success: false, error: result.error || "Failed to force lock" };
  }

  return { success: true };
}
```

Then in `up.ts`, replace the release-then-acquire with a single `forceLock()` call.

---

## 2. Documentation Inaccuracies

### 2.1 Wrong Encrypt Command

**File:** `docs/guide/workflows/team-sharing.md:389-393`

**Current (wrong):**
```bash
skybox config encrypt myproject
```

**Correct:**
```bash
skybox encrypt enable myproject
```

Also update the warning text to match actual behavior.

### 2.2 `push --remote` Flag Doesn't Exist

**File:** `docs/guide/workflows/team-sharing.md:364-370`

**Current (wrong):**
```bash
skybox push ./backend-api --remote backend-server
```

**Reality:** `push` uses whatever remote the project is configured with. There is no `--remote` flag.

**Fix options:**
- **Option A:** Remove the `--remote` flag from docs and explain projects inherit their remote from config.
- **Option B:** Implement `--remote` flag on push (more work, but matches user expectation).

**Recommendation:** Option A for now. The current workflow is: configure the remote first via `skybox remote add`, then push. Document that instead.

### 2.3 Lock Takeover Notification Claim

**File:** `docs/guide/workflows/team-sharing.md:138`

**Current (wrong):**
> Alice's next `skybox up` or `skybox down` will fail gracefully with a notification that her lock was taken.

**Reality:** `skybox down` blindly deletes the lock (Bug 1.1). `skybox up` would try to acquire and find someone else's lock, but the message says "locked by X" — it doesn't say "your lock was taken over."

**Fix:** After fixing Bug 1.1, update docs to accurately describe what happens:
- `skybox down` skips lock release and warns "Lock owned by another machine — skipping release"
- `skybox up` shows "Project locked by X" as it already does

---

## 3. Workflow Gaps

### 3.1 `skybox browse` Doesn't Show Lock Status

**Current behavior:** `skybox browse` lists remote projects with branch info only.

**Desired behavior:** Show a LOCK column similar to `skybox status` overview table.

**Implementation:** In the browse command, after listing projects, check `.skybox-locks/<project>.lock` for each project. Display lock holder or "unlocked".

**Complexity:** Low — reuse `getLockStatus()` from `lock.ts`.

### 3.2 No Stale Lock Detection

**Problem:** If a machine crashes without running `skybox down`, the lock persists forever. The only fix is manual takeover.

**Options:**
- **Lock TTL:** Add an `expires` field to lock info. Treat expired locks as unlocked. Default TTL: 24 hours.
- **Lock heartbeat:** Periodic background process updates timestamp. Stale = no update in N minutes. Too complex for current scope.

**Recommendation:** Lock TTL is simpler. Add `expires` to `LockInfo`, set it on acquire, check it in `getLockStatus()`. Expired locks are treated as unlocked and auto-cleaned.

### 3.3 No Cross-Project Lock Overview

**Problem:** Can't see all lock statuses without cloning every project. Teams want a quick "who's working on what" view.

**Fix:** Add `skybox browse --locks` or `skybox locks` command that checks all `.skybox-locks/*.lock` files on the remote in a single SSH call.

---

## 4. Documentation Updates Required

After implementing fixes, update these docs pages:

| File | Change |
|------|--------|
| `docs/guide/workflows/team-sharing.md` | Fix encrypt command, remove `--remote` flag from push, fix takeover notification claim, add lock TTL info |
| `docs/reference/commands.md` | Verify all command signatures match implementation |
| `CHANGELOG.md` | Document lock ownership fix, lock TTL, browse --locks |

---

## 5. Priority Order

| Priority | Item | Type | Effort |
|----------|------|------|--------|
| P0 | Fix `releaseLock()` ownership check | Bug fix | Small |
| P0 | Fix docs: encrypt command, push --remote, takeover claim | Docs fix | Small |
| P1 | Add `forceLock()` for atomic takeover | Bug fix | Small |
| P2 | Add lock TTL / expiry | Feature | Medium |
| P2 | Add lock status to `skybox browse` | Feature | Small |
| P3 | Add `skybox locks` / `skybox browse --locks` | Feature | Medium |
