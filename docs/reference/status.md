# devbox status

Show status of projects or detailed information about a specific project.

## Usage

```bash
devbox status [project]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[project]` | Name of the project to show detailed status for. If omitted, shows overview of all projects. |

## Options

This command has no options.

## Description

The `status` command displays information about your DevBox projects. It has two modes:

### Overview Mode (no argument)

Shows a table of all local projects with columns:

| Column | Description |
|--------|-------------|
| NAME | Project name |
| CONTAINER | Container status (running/stopped) |
| SYNC | Sync status (syncing/paused/error/no session) |
| BRANCH | Current git branch |
| LOCK | Lock status (unlocked/locked by machine) |
| LAST ACTIVE | Time since last activity |
| SIZE | Local disk usage |

### Detailed Mode (with project name)

Shows comprehensive information organized into sections:

**Container**
- Status (running/stopped)
- Image name
- Uptime
- CPU usage
- Memory usage

**Sync**
- Status (syncing/paused/error)
- Session name
- Pending files
- Last sync time

**Git**
- Current branch
- Working tree status (clean/dirty)
- Commits ahead of upstream
- Commits behind upstream

**Lock**
- Lock status
- Machine holding lock (if locked)
- User and timestamp

**Disk Usage**
- Local size
- Remote size

## Examples

```bash
# Show overview of all projects
devbox status

# Show detailed status of specific project
devbox status my-api
```

### Overview Output Example

```
Projects:

  NAME          CONTAINER  SYNC      BRANCH  LOCK      LAST ACTIVE  SIZE
  my-api        running    syncing   main    unlocked  2 hours ago  1.2G
  frontend-app  stopped    paused    dev     unlocked  3 days ago   856M
  data-service  running    syncing   main    locked    just now     2.1G
```

### Detailed Output Example

```bash
devbox status my-api

# Output:
# Project: my-api
# --------------------------------------------------
#
# Container
#   Status:     running
#   Image:      node:20
#   Uptime:     2 hours
#   CPU:        0.5%
#   Memory:     256MiB / 8GiB
#
# Sync
#   Status:     syncing
#   Session:    devbox-my-api
#   Pending:    0 files
#   Last sync:  -
#
# Git
#   Branch:     main
#   Status:     clean
#   Ahead:      0 commits
#   Behind:     0 commits
#
# Lock
#   Status:     unlocked
#
# Disk Usage
#   Local:      1.2G
#   Remote:     1.2G
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (DevBox not configured, project not found) |

## See Also

- [devbox list](/reference/list) - Simple list of local projects
- [devbox up](/reference/up) - Start a container
- [devbox down](/reference/down) - Stop a container
