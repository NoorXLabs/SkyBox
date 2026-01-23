# devbox down

Stop a development container.

## Usage

```bash
devbox down [project] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[project]` | Name of the project to stop. If omitted, DevBox will try to detect the project from the current directory or prompt for selection. |

## Options

| Option | Description |
|--------|-------------|
| `-c, --cleanup` | Remove container and volumes after stopping |
| `-f, --force` | Force stop even on errors |
| `--no-prompt` | Non-interactive mode (fails if input would be required) |

## Description

The `down` command stops a running development container. It performs the following steps:

1. **Project Resolution** - Determines which project to stop
2. **Sync Flush** - Waits for pending file changes to sync to remote
3. **Container Stop** - Stops the running container
4. **Lock Release** - Releases the lock so other machines can work on the project
5. **Optional Cleanup** - Removes container and volumes if requested

### Sync Safety

Before stopping the container, DevBox ensures all pending file changes are synced to the remote server. This prevents data loss when switching between machines.

### Cleanup Options

When using `--cleanup`, DevBox will:

- Remove the Docker container
- Remove associated volumes
- Optionally remove local project files (with confirmation)

If you choose to remove local files, the remote copy is preserved, and you can restore with `devbox clone`.

### Sync Pausing

If you're not cleaning up, DevBox offers to pause the background sync session to save system resources when you're not actively working on the project.

## Examples

```bash
# Stop a specific project
devbox down my-project

# Stop and clean up container
devbox down my-project --cleanup

# Force stop (ignore errors)
devbox down my-project --force

# Stop from within project directory
cd ~/.devbox/Projects/my-project
devbox down

# Non-interactive stop (for scripts)
devbox down my-project --no-prompt
```

### Workflow Example

```bash
# Done working for the day
devbox down my-project

# Switching to different machine - clean up local resources
devbox down my-project --cleanup
# Keep remote copy, remove local files when prompted

# Later, on another machine
devbox clone my-project
devbox up my-project
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (project not found, failed to stop container without --force) |

## See Also

- [devbox up](/reference/up) - Start the container
- [devbox status](/reference/status) - Check container status
- [devbox rm](/reference/rm) - Remove project locally
