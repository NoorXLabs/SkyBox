# devbox rm

Remove a project from your local machine while preserving the remote copy.

## Usage

```bash
devbox rm <project> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `<project>` | Name of the project to remove (required) |

## Options

| Option | Description |
|--------|-------------|
| `-f, --force` | Skip confirmation prompt |

## Description

The `rm` command removes a project from your local machine. This is useful for freeing up disk space or cleaning up after switching to a different machine. The remote copy on your server is preserved.

The command performs the following steps:

1. **Confirmation** - Prompts for confirmation (unless `--force` is used)
2. **Lock Release** - Releases any lock held by this machine
3. **Container Cleanup** - Stops and removes the container and volumes
4. **Sync Termination** - Terminates the Mutagen sync session
5. **File Removal** - Deletes local project files
6. **Deregistration** - Removes project from DevBox configuration

### Data Safety

- Remote files are **never deleted** by this command
- You can always restore the project with `devbox clone`
- Running containers are stopped before removal

### Lock Handling

If you hold the lock for this project, it will be released. If another machine holds the lock, the command will notify you but continue with the removal.

## Examples

```bash
# Remove a project (with confirmation)
devbox rm my-project

# Remove without confirmation
devbox rm my-project --force
```

### Interactive Session

```bash
devbox rm my-project

# Output:
# ? Remove project 'my-project' locally? This will NOT delete remote files. (y/N) y
#
# Removing 'my-project'...
#   Lock released
#   Container stopped
#   Container removed
#   Sync session terminated
#   Local files removed
#
#   Project 'my-project' removed locally. Remote copy preserved.
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
