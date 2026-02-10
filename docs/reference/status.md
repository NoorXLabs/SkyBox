---
title: skybox status
description: Show status of projects or detailed information about a specific project with skybox status. View container and sync state.
---

# skybox status

Show status of projects or detailed information about a specific project.

<!-- COMMAND-SPEC:START -->
## Usage

```bash
skybox status [options] [project]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[project]` | Optional project name. Omit to show status overview for all local projects. |

## Options

None.

## Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | display help for command |
| `-v, --version` | output the version number |
| `--dry-run` | Preview commands without executing them |
<!-- COMMAND-SPEC:END -->

## Description

The `status` command displays information about your SkyBox projects. It has two modes:

### Overview Mode (no argument)

Shows a table of all local projects with columns:

| Column | Description |
|--------|-------------|
| NAME | Project name |
| CONTAINER | Container status (running/stopped) |
| SYNC | Sync status (syncing/paused/error/no session) |
| BRANCH | Current git branch |
| SESSION | Session status (none/active here/active on machine) |
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

**Session**
- Session status (none / active here / active on another machine)
- Machine name (if active)
- User and start time

**Disk Usage**
- Local size
- Remote size

## Examples

```bash
# Show overview of all projects
skybox status

# Show detailed status of specific project
skybox status my-api
```

### Overview Output Example

```
Projects:

  NAME          CONTAINER  SYNC      BRANCH  SESSION          LAST ACTIVE  SIZE
  my-api        running    syncing   main    active here      2 hours ago  1.2G
  frontend-app  stopped    paused    dev     none             3 days ago   856M
  data-service  running    syncing   main    active here      just now     2.1G
```

### Detailed Output Example

```bash
skybox status my-api

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
#   Session:    skybox-my-api
#   Pending:    0 files
#   Last sync:  -
#
# Git
#   Branch:     main
#   Status:     clean
#   Ahead:      0 commits
#   Behind:     0 commits
#
# Session
#   Status:     none
#
# Disk Usage
#   Local:      1.2G
#   Remote:     1.2G
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (SkyBox not configured, project not found) |

## See Also

- [skybox list](/reference/list) - Simple list of local projects
- [skybox up](/reference/up) - Start a container
- [skybox down](/reference/down) - Stop a container
