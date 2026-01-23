# Design: devbox clone and devbox push

> Copy projects between local and remote with bidirectional sync

## Overview

Two commands that enable the core devbox workflow:
- `devbox clone <project>` - Copy project from remote to local
- `devbox push <path> [name]` - Copy local project to remote

Both use a shared `mutagen.ts` module for bidirectional file sync.

## Output Examples

### devbox clone

```
$ devbox clone myapp
Cloning 'myapp' from DevBox-VPS-Dedicated:~/code/myapp...
  ✓ Created ~/.devbox/projects/myapp
  ⠋ Syncing files... (142 files, 12.3 MB)
  ✓ Initial sync complete
Start dev container now? [y/N]
```

### devbox push

```
$ devbox push ./my-local-project
Pushing 'my-local-project' to DevBox-VPS-Dedicated:~/code/my-local-project...
  ✓ Created remote directory
  ⠋ Syncing files... (89 files, 8.1 MB)
  ✓ Initial sync complete
Start dev container now? [y/N]
```

## Clone Command Flow

1. **Verify config exists** - Error if not configured
2. **Check project exists on remote** - SSH to verify `~/code/<project>` exists
3. **Check local doesn't exist** - If `~/.devbox/projects/<project>` exists:
   - Prompt: "Project already exists locally. Overwrite?"
   - If yes: "Are you sure? All local changes will be lost."
   - If confirmed: Remove local directory
   - If no: Abort
4. **Create local directory** - `mkdir -p ~/.devbox/projects/<project>`
5. **Create mutagen sync session** - Name: `devbox-<project>`
6. **Wait for initial sync** - Show progress with file count and size
7. **Register in config** - Add to `projects: {}` in config.yaml
8. **Offer to start container** - "Start dev container now?"
   - If yes: Run `devbox up <project>` logic
   - If no: Show "Run 'devbox up <project>' when ready"

### Clone Error Cases

| Scenario | Message |
|----------|---------|
| Project not on remote | "Project 'X' not found on remote. Run 'devbox browse' to see available projects." |
| SSH connection fails | "Failed to connect to remote." |
| Sync fails | "Sync failed: <error>. Try again or check mutagen status." |

## Push Command Flow

1. **Verify config exists** - Error if not configured
2. **Resolve path and name**
   - Path: Resolve to absolute path, verify exists
   - Name: Use provided name, or `basename` of path
3. **Check if git repo** - If no `.git` folder:
   - Prompt: "This project isn't a git repo. Initialize git?"
   - If yes: Run `git init`, create initial commit
   - If no: Continue without git
4. **Check remote doesn't exist** - SSH to check `~/code/<name>`
   - If exists: "Project already exists on remote. Overwrite?"
   - If yes: "Are you sure? All remote changes will be lost."
   - If confirmed: Remove remote directory
   - If no: Abort
5. **Create remote directory** - `ssh <host> mkdir -p ~/code/<name>`
6. **Copy to devbox projects** - Copy to `~/.devbox/projects/<name>`
7. **Create mutagen sync session** - Name: `devbox-<project>`
8. **Wait for initial sync** - Show progress (local → remote)
9. **Register in config** - Add to `projects: {}` in config.yaml
10. **Offer to start container** - Same as clone

### Push Error Cases

| Scenario | Message |
|----------|---------|
| Local path not found | "Path '<path>' not found." |
| SSH connection fails | "Failed to connect to remote." |
| No write permission | "Cannot create directory on remote." |

## Mutagen Module

### Interface

```typescript
// src/lib/mutagen.ts

interface SyncProgress {
  status: 'watching' | 'scanning' | 'syncing' | 'idle';
  filesTotal?: number;
  filesSynced?: number;
  bytesTotal?: number;
  bytesSynced?: number;
}

interface SyncStatus {
  exists: boolean;
  paused: boolean;
  connected: boolean;
  lastSync?: Date;
  conflicts?: string[];
}

// Session naming: devbox-<project>
function sessionName(project: string): string

// Create bidirectional sync session
async function createSyncSession(
  project: string,
  localPath: string,
  remoteHost: string,
  remotePath: string
): Promise<void>

// Wait for sync with progress callback
async function waitForSync(
  project: string,
  onProgress?: (status: SyncProgress) => void
): Promise<void>

// Get current sync status
async function getSyncStatus(project: string): Promise<SyncStatus>

// Pause/resume sync
async function pauseSync(project: string): Promise<void>
async function resumeSync(project: string): Promise<void>

// Terminate and remove session
async function terminateSession(project: string): Promise<void>

// List all devbox sync sessions
async function listSessions(): Promise<string[]>
```

### Mutagen CLI Commands Used

| Function | CLI Command |
|----------|-------------|
| createSyncSession | `mutagen sync create` |
| getSyncStatus | `mutagen sync list --json` |
| waitForSync | `mutagen sync flush` + poll status |
| pauseSync | `mutagen sync pause` |
| resumeSync | `mutagen sync resume` |
| terminateSession | `mutagen sync terminate` |

### Sync Configuration

- **Mode:** `two-way-resolved` (remote wins on conflict)
- **Ignores:** From config defaults (node_modules, .venv, etc.)
- **Watch mode:** Enabled for continuous sync after initial

## File Structure

```
src/
  commands/
    clone.ts      # devbox clone command
    push.ts       # devbox push command
  lib/
    mutagen.ts    # Mutagen sync wrapper
```

## Testing Approach

- Unit tests for mutagen command building (mock execa, don't run mutagen)
- Unit tests for path resolution, validation logic
- Manual integration testing against real remote

## Not In Scope

- Lock system (implemented in `devbox up`)
- Container management (implemented in `devbox up`)
- Selective sync / sparse checkout
- Multiple remote servers
