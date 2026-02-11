---
title: skybox down
description: Stop a development container with skybox down. Shut down running containers and release local session locks.
---

# skybox down

Stop a development container.

## Usage

```bash
skybox down [project] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[project]` | Name of the project to stop. If omitted, SkyBox resolves from the current directory or prompts with a checkbox to select one or more projects. |

## Options

| Option | Description |
|--------|-------------|
| `-c, --cleanup` | Remove container and volumes after stopping |
| `-f, --force` | Force stop even on errors |
| `--no-prompt` | Non-interactive mode (fails if input would be required) |
| `-A, --all` | Stop all local projects in batch mode (tallies success/failure counts) |
| `--dry-run` | Show what would happen without making changes |

## Description

The `down` command stops a running development container. It performs the following steps:

1. **Project Resolution** - Determines which project to stop (from argument, current directory, or interactive selection)
2. **Pre-Down Hooks** - Runs any configured `pre-down` hooks, e.g. `npm run db:dump` (see [Hooks](/reference/hooks))
3. **Sync Flush** - Waits for pending file changes to sync to remote
4. **Container Stop** - Stops the running container
5. **Archive Encryption** - If encryption is enabled, encrypts the project on the remote
6. **Session End** - Removes the session file so other machines can start without warnings
7. **Post-Down Hooks** - Runs any configured `post-down` hooks, e.g. `slack-notify "stopped project"` (see [Hooks](/reference/hooks))
8. **Optional Cleanup** - Removes container and volumes if requested
9. **Optional Local File Removal** - With cleanup, offers to delete local project files (double confirmation required)
10. **Sync Pause** - If not cleaning up, offers to pause background sync to save resources

### Multi-Select Workflow

When you run `skybox down` without a project name:

1. SkyBox first checks whether your current directory maps to a known project.
2. If not, it shows a checkbox list so you can select one or more local projects to stop.
3. Selected projects are stopped sequentially, with a final success/failure summary.
4. After all selected projects are stopped, if any had containers running, SkyBox prompts whether to also clean up (remove containers and volumes) for the batch. This is the same as passing `--cleanup` but applied after the fact.

If `--no-prompt` is set and no project can be resolved from the current directory, the command exits with an error.

Use `--all` if you want to stop every local project without selecting from the checkbox list.

### Sync Safety

Before stopping the container, SkyBox waits for all pending file changes to sync to the remote server. This prevents data loss when switching between machines. If the sync flush fails, you are warned but the stop continues.

### Archive Encryption

If the project has encryption enabled, after the sync is flushed and the container is stopped, SkyBox will:

1. Prompt for your passphrase
2. Create a tar archive of the project on the remote
3. Download the archive, encrypt it locally
4. Upload the encrypted archive back to the remote
5. Delete plaintext files from the remote

If encryption fails, a warning is shown but the shutdown continues. Project files remain unencrypted on the remote in this case. See [`skybox encrypt`](/reference/encryption) for more details.

### Cleanup Options

When using `--cleanup`, SkyBox will:

- Remove the Docker container
- Remove associated volumes
- Optionally remove local project files (with **double confirmation**)

The first prompt asks if you want to remove local files. If you say yes, a second prompt confirms by showing the exact path that will be deleted. The remote copy is always preserved.

### Sync Pausing

If you are not cleaning up, SkyBox offers to pause the background sync session to save system resources when you are not actively working on the project. Sync is automatically resumed the next time you run `skybox up`.

### Batch Mode

With `-A, --all`, SkyBox stops every local project sequentially and reports a summary of how many succeeded and how many failed.

## Examples

```bash
# Stop a specific project
skybox down my-project

# Stop and clean up container
skybox down my-project --cleanup

# Force stop (ignore errors)
skybox down my-project --force

# Stop from within project directory
cd ~/.skybox/Projects/my-project
skybox down

# Non-interactive stop (for scripts)
skybox down my-project --no-prompt

# Stop all local projects
skybox down --all
```

### Workflow Example

```bash
# Done working for the day
skybox down my-project

# Switching to different machine - clean up local resources
skybox down my-project --cleanup
# Keep remote copy, remove local files when prompted

# Later, on another machine
skybox clone my-project
skybox up my-project
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (project not found, failed to stop container without --force) |

## See Also

- [skybox up](/reference/up) - Start the container
- [skybox status](/reference/status) - Check container status
- [skybox rm](/reference/rm) - Remove project locally
