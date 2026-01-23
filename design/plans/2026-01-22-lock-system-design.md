# Lock System Design

> Multi-computer lock management for devbox projects

## Overview

The lock system prevents conflicts when using multiple computers with the same project. When you start working on a project (`devbox up`), you acquire a lock. When you stop (`devbox down`), the lock is released after syncing.

## Lock File

**Location:** `<base_path>/.devbox-locks/<project>.lock` (on remote server)

**Format:**
```json
{
  "machine": "macbook-pro",
  "user": "noor",
  "timestamp": "2024-01-15T10:30:00Z",
  "pid": 12345
}
```

## Data Structures

```typescript
// src/types/index.ts

export interface LockInfo {
  machine: string;    // hostname of machine holding lock
  user: string;       // username
  timestamp: string;  // ISO 8601 datetime
  pid: number;        // process ID
}

export type LockStatus =
  | { locked: false }
  | { locked: true; ownedByMe: boolean; info: LockInfo };
```

## Operations

### `src/lib/lock.ts`

```typescript
// Get current machine identifier
getMachineName(): string

// Get lock status for a project
getLockStatus(project: string, config: Config): Promise<LockStatus>

// Acquire lock (creates lock file on remote)
acquireLock(project: string, config: Config): Promise<{
  success: boolean;
  error?: string;
  existingLock?: LockInfo;  // populated if conflict
}>

// Release lock (deletes lock file on remote)
releaseLock(project: string, config: Config): Promise<{
  success: boolean;
  error?: string;
}>
```

### SSH Commands

| Operation | Command |
|-----------|---------|
| Read lock | `cat <base_path>/.devbox-locks/<project>.lock 2>/dev/null` |
| Create lock | `mkdir -p <base_path>/.devbox-locks && cat > <path>.lock` |
| Delete lock | `rm -f <base_path>/.devbox-locks/<project>.lock` |

### Conflict Handling in `acquireLock`

- **No lock exists** → create lock, succeed
- **Locked by same machine** → update timestamp, succeed (reconnecting)
- **Locked by different machine** → fail with `existingLock` info (caller decides)

## Command Integration

| Command | Lock Action |
|---------|-------------|
| `devbox up` | `acquireLock()` - acquire before starting, prompt if conflict |
| `devbox down` | Flush sync → stop container → `releaseLock()` |
| `devbox rm` | `releaseLock()` if held → remove everything |
| `devbox status` | `getLockStatus()` - display lock info |
| `devbox list` | `getLockStatus()` - show lock column |

**Note:** No separate `handoff` command - `down` handles flush + release.

## Status Display

Update status output to show actual lock state:
- `unlocked`
- `locked (this machine)`
- `locked (macbook-pro)` (other machine name)

## Implementation Order

1. Add types to `src/types/index.ts`
2. Create `src/lib/lock.ts` with all operations
3. Update `devbox up` to acquire lock
4. Update `devbox down` to flush sync and release lock
5. Update `devbox status` and `devbox list` to show lock info
6. Implement `devbox rm` using lock release
