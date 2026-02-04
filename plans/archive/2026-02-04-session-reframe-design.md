# Design: Reframe Locks as Multi-Machine Sessions

**Date:** 2026-02-04
**Status:** Draft

## Overview

Replace the team collaboration lock system with a simpler multi-machine session system. Sessions prevent sync conflicts when one person works across multiple computers, not for coordinating between team members.

## Problem

The current lock system is framed as a team collaboration feature, but:
- It's cumbersome for teams (constant `devbox up`/`down` cycles)
- Git already handles code collaboration better
- The primary value of DevBox remotes is disk space offloading, not team coordination

However, locks are still valuable for a single user working across multiple machines (laptop + desktop) to prevent Mutagen sync conflicts.

## Solution

1. **Reframe:** Locks become "sessions" — a personal safety feature
2. **Simplify:** Remove team coordination features and messaging
3. **Optimize:** Move session files into synced project directory (no SSH polling)

## Key Changes

### Conceptual Reframe

| Before | After |
|--------|-------|
| "Team sharing workflow" | "Multi-machine workflow" |
| "Lock" | "Session" |
| "Alice locked it" | "Your laptop has this running" |
| "Take over lock from Bob?" | "Continue anyway?" |
| Lock = collaboration tool | Session = conflict prevention |

### Session File Location

**Before:** Remote-only lock file requiring SSH to check
```
remote:~/.devbox-locks/<project>.lock
```

**After:** Session file inside project, synced by Mutagen
```
<project>/.devbox/session.lock
```

Benefits:
- Zero SSH calls for status checks
- Near real-time updates via Mutagen sync
- Automatically propagates to other machines syncing the project

### Session File Format

```json
{
  "machine": "your-macbook",
  "user": "alice",
  "timestamp": "2026-02-04T10:00:00Z",
  "pid": 12345,
  "expires": "2026-02-05T10:00:00Z"
}
```

Same content as current lock files, just new location.

### Flow: `devbox up`

1. Check if `<project>/.devbox/session.lock` exists locally
2. If exists and not expired:
   - If same machine: update timestamp, continue
   - If different machine: warn "This project is running on <machine>. Continue anyway?"
3. If user continues (or no conflict): write new session file
4. Mutagen syncs session file to remote (and other machines)

### Flow: `devbox down`

1. Delete `<project>/.devbox/session.lock`
2. Mutagen syncs deletion to remote

### Dashboard Integration

Add session status to dashboard cards:

```typescript
interface DashboardProject {
  // ... existing fields
  sessionStatus: string;  // "active here" | "active on <machine>" | "none"
}
```

Read from local `.devbox/session.lock` — no SSH needed.

Display:
- "active here" → green
- "active on X" → yellow
- "none" → dim gray

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/lock.ts` | Rewrite: local file ops, rename to session terminology |
| `src/lib/constants.ts` | Add `SESSION_FILE = ".devbox/session.lock"`, remove `LOCKS_DIR_NAME` |
| `src/commands/up.ts` | Update messaging, use new session API |
| `src/commands/down.ts` | Update messaging, use new session API |
| `src/commands/status.ts` | Read local session file, update labels |
| `src/commands/dashboard.tsx` | Add session field, read from local files |
| `src/commands/browse.ts` | Remove lock column |
| `src/index.ts` | Remove locks command registration |

## Files to Create

| File | Purpose |
|------|---------|
| `docs/guide/workflows/multi-machine.md` | New focused guide |

## Files to Delete

| File | Reason |
|------|--------|
| `src/commands/locks.ts` | Command removed |
| `docs/guide/workflows/team-sharing.md` | Replaced by multi-machine.md |

## Documentation Updates Required

### Delete
- `docs/guide/workflows/team-sharing.md`

### Create
- `docs/guide/workflows/multi-machine.md` — focused guide covering:
  - How sessions prevent sync conflicts
  - Common scenarios (forgot to stop on other machine, intentional switching)
  - Checking session status

### Update
- Remove "team" references from any other docs that mention team-sharing
- Update sidebar/navigation if team-sharing.md was linked

## Migration

Existing users with locks in `~/.devbox-locks/`:
- On first `devbox up` after upgrade, ignore old remote locks
- Old lock files can be left to expire (24h TTL) or manually cleaned

No data migration needed — sessions start fresh.

## Gitignore

Ensure `.devbox/` is in the default `.gitignore` template for new projects:

```gitignore
.devbox/
```

Existing projects should already have this or users should add it.

## Testing

- Unit tests for new session file operations
- Test conflict detection (different machine name in session file)
- Test expiry handling
- Test dashboard reads local session files correctly
- Integration test: `up` creates file, `down` removes it

## Out of Scope

- Team collaboration features (intentionally removed)
- Push notifications from remote (Mutagen sync is sufficient)
- Per-user remote folders (can be done manually if needed)
