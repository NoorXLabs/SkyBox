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
| `-A, --all` | Stop all local projects in batch mode (tallies success/failure counts) |

## Description

The `down` command stops a running development container. It performs the following steps:

1. **Project Resolution** - Determines which project to stop (from argument, current directory, or interactive selection)
2. **Pre-Down Hooks** - Runs any configured `pre-down` hooks (see [Hooks](/reference/hooks))
3. **Sync Flush** - Waits for pending file changes to sync to remote
4. **Container Stop** - Stops the running container
5. **Archive Encryption** - If encryption is enabled, encrypts the project on the remote
6. **Lock Release** - Releases the lock so other machines can work on the project
7. **Post-Down Hooks** - Runs any configured `post-down` hooks (see [Hooks](/reference/hooks))
8. **Optional Cleanup** - Removes container and volumes if requested
9. **Optional Local File Removal** - With cleanup, offers to delete local project files (double confirmation required)
10. **Sync Pause** - If not cleaning up, offers to pause background sync to save resources

### Sync Safety

Before stopping the container, DevBox waits for all pending file changes to sync to the remote server. This prevents data loss when switching between machines. If the sync flush fails, you are warned but the stop continues.

### Archive Encryption

If the project has encryption enabled, after the sync is flushed and the container is stopped, DevBox will:

1. Prompt for your passphrase
2. Create a tar archive of the project on the remote
3. Download the archive, encrypt it locally
4. Upload the encrypted archive back to the remote
5. Delete plaintext files from the remote

If encryption fails, a warning is shown but the shutdown continues. Project files remain unencrypted on the remote in this case. See [`devbox encrypt`](/reference/encryption) for more details.

### Cleanup Options

When using `--cleanup`, DevBox will:

- Remove the Docker container
- Remove associated volumes
- Optionally remove local project files (with **double confirmation**)

The first prompt asks if you want to remove local files. If you say yes, a second prompt confirms by showing the exact path that will be deleted. The remote copy is always preserved.

### Sync Pausing

If you are not cleaning up, DevBox offers to pause the background sync session to save system resources when you are not actively working on the project. Sync is automatically resumed the next time you run `devbox up`.

### Batch Mode

With `-A, --all`, DevBox stops every local project sequentially and reports a summary of how many succeeded and how many failed.

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

# Stop all local projects
devbox down --all
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
