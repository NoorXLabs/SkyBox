# Status Command Design

> Show project status for devbox-managed projects

## Overview

The `devbox status` command provides visibility into project state across two modes:
- **Overview mode** (`devbox status`): Quick table of all projects
- **Detailed mode** (`devbox status <project>`): Deep dive on one project

## Overview Mode

**Command:** `devbox status` (no arguments)

**Output format:**
```
Projects:
  NAME          CONTAINER   SYNC      BRANCH    LOCK      LAST ACTIVE   SIZE
  myapp         running     syncing   main      n/a       2 hours ago   1.2 GB
  backend       stopped     paused    develop   n/a       3 days ago    856 MB
  experiments   running     syncing   feature   n/a       5 mins ago    2.1 GB
```

**Columns:**
| Column | Source | Notes |
|--------|--------|-------|
| NAME | Directory names in `~/.devbox/Projects/` | |
| CONTAINER | Docker ps with devcontainer labels | |
| SYNC | Mutagen session status | |
| BRANCH | Git current branch | |
| LOCK | Placeholder "n/a" | Until lock system implemented |
| LAST ACTIVE | Git log timestamp or dir mtime | |
| SIZE | `du -sh` on project directory | |

**Color coding:**
- Container: `running` = green, `stopped` = dim/gray
- Sync: `syncing` = green, `paused` = yellow, `error` = red
- Lock: `n/a` = dim (placeholder)

## Detailed Mode

**Command:** `devbox status <project>`

**Output format:**
```
Project: myapp
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Container
  Status:     running
  Image:      mcr.microsoft.com/devcontainers/typescript-node:18
  Uptime:     2 hours 15 minutes
  CPU:        1.2%
  Memory:     256 MB / 4 GB

Sync
  Status:     syncing
  Session:    devbox-myapp
  Pending:    0 files
  Last sync:  12 seconds ago

Git
  Branch:     main
  Status:     clean
  Ahead:      2 commits
  Behind:     0 commits

Lock
  Status:     n/a (not implemented)

Disk Usage
  Local:      1.2 GB
  Remote:     1.2 GB
```

**Sections:**
| Section | Data Source |
|---------|-------------|
| Container | `docker inspect`, `docker stats --no-stream` |
| Sync | `mutagen sync list` with session filter |
| Git | `git branch`, `git status --porcelain`, `git rev-list` |
| Lock | Placeholder until lock system exists |
| Disk | `du -sh` locally, SSH for remote |

## Data Gathering

**Container status:**
- Use existing `src/lib/container.ts` functions
- Filter by devcontainer label: `--filter "label=devcontainer.local_folder=<path>"`
- Stats via `docker stats --no-stream --format json`

**Sync status:**
- Use existing `src/lib/mutagen.ts`
- Session naming: `devbox-<project>`
- Parse `mutagen sync list --label-selector=devbox=<project>`

**Git info:**
- `git rev-parse --abbrev-ref HEAD` for branch
- `git status --porcelain` for clean/dirty
- `git rev-list --left-right --count @{upstream}...HEAD` for ahead/behind

**Last active:**
- `git log -1 --format=%ct` for last commit timestamp
- Fallback: directory mtime

**Disk usage:**
- Local: `du -sh <path>`
- Remote: SSH to run `du -sh <remote_path>` (detailed mode only)

**Performance:**
- Overview runs container and sync checks in parallel via `Promise.all()`
- Skip remote disk check in overview mode

## Error Handling

| Situation | Behavior |
|-----------|----------|
| No container | Show `stopped` |
| No mutagen session | Show `no session` (yellow) |
| Not a git repo | Show `-` for branch |
| Git has no upstream | Skip ahead/behind |
| Remote unreachable | Show `remote: unavailable` |
| Docker not running | Show error once, `container: unknown` |
| Mutagen not installed | Error, suggest `devbox init` |

**Timeouts:**
- Docker/mutagen commands: 5 seconds
- SSH for remote disk: 10 seconds
- On timeout: show `timeout`, don't block

**Edge cases:**
- Empty projects dir: "No projects found. Use `devbox clone` or `devbox push` to get started."
- Project not found: "Project 'foo' not found. Run `devbox list` to see available projects."

## Implementation Structure

**File:** `src/commands/status.ts`

**Functions:**
```typescript
// Entry point
export async function statusCommand(project?: string): Promise<void>

// Overview mode
async function showOverview(): Promise<void>
async function getProjectSummary(projectName: string): Promise<ProjectSummary>

// Detailed mode
async function showDetailed(projectName: string): Promise<void>

// Data collectors
async function getContainerStatus(projectPath: string): Promise<ContainerInfo>
async function getSyncStatus(projectName: string): Promise<SyncInfo>
async function getGitInfo(projectPath: string): Promise<GitInfo | null>
async function getDiskUsage(path: string): Promise<string>
async function getRemoteDiskUsage(projectName: string): Promise<string>
async function getLastActive(projectPath: string): Promise<Date>

// Formatting
function formatOverviewTable(summaries: ProjectSummary[]): string
function formatDetailedView(status: DetailedStatus): string
function colorStatus(status: string, type: 'container' | 'sync'): string
```

**Types (in `src/types/index.ts`):**
- `ProjectSummary` - overview row data
- `DetailedStatus` - all detailed view data
- `ContainerInfo`, `SyncInfo`, `GitInfo` - sub-structures

**CLI registration (in `src/index.ts`):**
```typescript
program
  .command("status [project]")
  .description("Show project status")
  .action(statusCommand);
```

## Design Decisions

1. **Single-file command** - All logic in `status.ts`, using existing lib functions. Simple, matches other commands.

2. **Placeholder for locks** - Show "n/a" until lock system is built, keeping interface consistent.

3. **Colored table output** - Matches existing CLI style with chalk/ora.

4. **Parallel data fetching** - Overview mode runs checks concurrently for speed.

5. **Graceful degradation** - Missing data shows inline warnings, doesn't block output.
