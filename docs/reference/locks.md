# devbox locks

Show lock status for all projects on a remote server.

## Usage

```bash
devbox locks
```

## Arguments

This command takes no arguments.

## Options

This command has no options.

## Description

The `locks` command shows the lock status for all projects on a remote server. If multiple remotes are configured, you'll be prompted to select which remote to check. This gives teams a quick overview of who's working on what.

For each project with a lock file, it shows:

- Project name
- Lock status (locked or unlocked)
- Timestamp when the lock was acquired

### Lock Expiry

Locks automatically expire after 24 hours. If a machine crashes without running `devbox down`, the lock becomes stale and is treated as unlocked. Expired locks are not displayed.

### Output Format

Projects are displayed in a table sorted with locked projects first:

```
Locks on my-server:

  PROJECT                         STATUS                     SINCE
  backend-api                     locked (alices-macbook)    2024-01-15T09:00:00Z
  frontend-app                    locked (you)               2024-01-15T10:30:00Z
  data-service                    unlocked
```

Lock status values:
- `unlocked` — No active lock (or lock expired)
- `locked (you)` — You have the lock from your current machine
- `locked (<machine>)` — Another machine has the lock

If no lock files exist on the remote:

```
No lock files found on remote.
Locks are created when someone runs 'devbox up'.
```

## Examples

```bash
# Check who's working on what
devbox locks

# Output:
# Locks on my-server:
#
#   PROJECT                         STATUS                     SINCE
#   backend-api                     locked (alices-macbook)    2024-01-15T09:00:00Z
#   frontend-app                    unlocked
```

### Team Coordination

```bash
# Before starting work, check if anyone has the project locked
devbox locks

# If unlocked, start working
devbox up backend-api

# When done, release the lock
devbox down backend-api
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (not configured, SSH connection failed) |

## See Also

- [devbox browse](/reference/browse) - List projects with lock status
- [devbox status](/reference/status) - Show detailed status for a single project
- [devbox up](/reference/up) - Start a project (acquires lock)
- [devbox down](/reference/down) - Stop a project (releases lock)
- [Team Sharing Workflow](/guide/workflows/team-sharing) - Full guide on locks and team coordination
