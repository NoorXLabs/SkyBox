# devbox rm

Remove a project from your local machine, with optional remote deletion.

## Usage

```bash
devbox rm [project] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[project]` | Name of the project to remove. If omitted, shows an interactive multi-select list of all local projects. |

## Options

| Option | Description |
|--------|-------------|
| `-f, --force` | Skip all confirmation prompts |
| `-r, --remote` | Also delete the project from the remote server (requires double confirmation) |

## Description

The `rm` command removes a project from your local machine. This is useful for freeing up disk space or cleaning up after switching to a different machine.

The command performs the following steps:

1. **Confirmation** - Prompts for confirmation (unless `--force` is used)
2. **Session Cleanup** - Removes any active session for this project
3. **Container Cleanup** - Stops and removes the container and volumes
4. **Sync Termination** - Terminates the Mutagen sync session
5. **File Removal** - Deletes local project files
6. **Deregistration** - Removes project from DevBox configuration

### Interactive Multi-Select

When run without a project argument, `devbox rm` displays a checkbox list of all local projects. You can select multiple projects for batch removal using the spacebar and confirm with enter.

### Remote Deletion

When using `--remote`, the command also deletes the project from the remote server. Because this is an irreversible action, it requires **double confirmation**:

1. First prompt: confirms you want to permanently delete from the remote
2. Second prompt: asks "Are you absolutely sure?"

Both confirmations are skipped when `--force` is used.

If the project does not exist locally but `--remote` is passed, the command skips local cleanup and proceeds directly to remote deletion.

### Data Safety

- Without `--remote`, remote files are **never deleted**
- You can always restore a locally-removed project with `devbox clone`
- Running containers are stopped before removal

### Session Handling

If a session exists for this project, it will be removed as part of the cleanup. If another machine has an active session, the command continues with the removal since the project is being deleted locally.

## Examples

```bash
# Remove a project (with confirmation)
devbox rm my-project

# Remove without confirmation
devbox rm my-project --force

# Remove locally and from remote (double confirmation)
devbox rm my-project --remote

# Force remove locally and from remote (no prompts)
devbox rm my-project --remote --force

# Interactive multi-select (no argument)
devbox rm
# Shows checkbox list: select projects with spacebar, confirm with enter
```

### Interactive Session

```bash
devbox rm my-project

# Output:
# ? Remove project 'my-project' locally? This will NOT delete remote files. (y/N) y
#
# Removing 'my-project'...
#   Session cleared
#   Container stopped
#   Container removed
#   Sync session terminated
#   Local files removed
#
#   Project 'my-project' removed locally. Remote copy preserved.
```

### Remote Deletion Session

```bash
devbox rm my-project --remote

# Output:
# ? Remove project 'my-project' locally AND from the remote server? (y/N) y
#
# Removing 'my-project'...
#   Session cleared
#   Container stopped
#   Container removed
#   Sync session terminated
#   Local files removed
#
# ? This will permanently delete 'my-project' from server:~/code/my-project. Continue? (y/N) y
# ? Are you absolutely sure? This action cannot be undone. (y/N) y
#   Deleted 'my-project' from remote
#
#   Project 'my-project' removed locally and from remote.
```

### Workflow Example

```bash
# Check disk usage of projects
devbox status

# Output shows my-old-project using 5GB

# Remove it to free space
devbox rm my-old-project

# Later, if needed again
devbox clone my-old-project
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (DevBox not configured, project not found, removal failed) |

## See Also

- [devbox down](/reference/down) - Stop container (optionally with cleanup)
- [devbox clone](/reference/clone) - Restore project from remote
- [devbox list](/reference/list) - List local projects
- [devbox status](/reference/status) - Check project disk usage
