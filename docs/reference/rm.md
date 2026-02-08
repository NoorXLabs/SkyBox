# skybox rm

Remove a project from your local machine, with optional remote deletion.

## Usage

```bash
skybox rm [project] [options]
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
| `--dry-run` | Show what would happen without making changes |

## Description

The `rm` command removes a project from your local machine. This is useful for freeing up disk space or cleaning up after switching to a different machine.

The command performs the following steps:

1. **Confirmation** - Prompts for confirmation (unless `--force` is used)
2. **Session Cleanup** - Removes any active session for this project
3. **Container Cleanup** - Stops and removes the container and volumes
4. **Sync Termination** - Terminates the Mutagen sync session
5. **File Removal** - Deletes local project files
6. **Deregistration** - Removes project from SkyBox configuration

### Interactive Multi-Select

When run without a project argument, `skybox rm` displays a checkbox list of all local projects. You can select multiple projects for batch removal using the spacebar and confirm with enter.

### Remote Interactive Multi-Select

When run with `--remote` but **no project argument** (`skybox rm --remote`), the command enters an interactive flow for bulk-deleting projects from a remote server:

1. **Remote selection** - If multiple remotes are configured, prompts you to select which remote to delete from
2. **Project list** - Fetches all projects from the remote and displays them as a checkbox list (with branch names if available)
3. **Selection** - Select one or more projects using the spacebar, then press enter
4. **Double confirmation** - Lists the selected projects and requires two confirmations before proceeding
5. **Deletion** - Deletes each selected project from the remote. If a deletion fails, the remaining projects are still processed
6. **Local cleanup offer** - For each deleted remote project that also exists locally, prompts whether to remove the local copy too

With `--force`, all confirmation prompts are skipped and local copies are kept by default (since the user did not explicitly opt in to local removal).

### Remote Deletion

When using `--remote`, the command also deletes the project from the remote server. Because this is an irreversible action, it requires **double confirmation**:

1. First prompt: confirms you want to permanently delete from the remote
2. Second prompt: asks "Are you absolutely sure?"

Both confirmations are skipped when `--force` is used.

If the project does not exist locally but `--remote` is passed, the command skips local cleanup and proceeds directly to remote deletion.

#### Ownership Check

Remote deletion requires project ownership. If the project on the remote is owned by a different user, the deletion is blocked:

```
Only the project owner can delete remote projects.
Project owned by 'alice' (created on alice-macbook)
```

Projects without an ownership file (created before this feature) can be deleted by anyone.

### Data Safety

- Without `--remote`, remote files are **never deleted**
- You can always restore a locally-removed project with `skybox clone`
- Running containers are stopped before removal

### Session Handling

If a session exists for this project, it will be removed as part of the cleanup. If another machine has an active session, the command continues with the removal since the project is being deleted locally.

## Examples

```bash
# Remove a project (with confirmation)
skybox rm my-project

# Remove without confirmation
skybox rm my-project --force

# Remove locally and from remote (double confirmation)
skybox rm my-project --remote

# Force remove locally and from remote (no prompts)
skybox rm my-project --remote --force

# Interactive multi-select (no argument)
skybox rm
# Shows checkbox list: select projects with spacebar, confirm with enter

# Interactive remote multi-select (no argument, --remote)
skybox rm --remote
# Prompts for remote, shows checkbox list of remote projects, double confirms

# Force delete all selected remote projects (no prompts)
skybox rm --remote --force
```

### Interactive Session

```bash
skybox rm my-project

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
skybox rm my-project --remote

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

### Remote Multi-Select Session

```bash
skybox rm --remote

# Output:
# ? Select a remote: work
# ⠋ Fetching projects from work...
# ? Select remote projects to delete:
#   ◻ old-api (main)
#   ◻ prototype (dev)
#   ◻ archived-site
# (select with spacebar, confirm with enter)
#
# ⚠ The following projects will be permanently deleted from remote:
#     old-api
#     prototype
#
# ? Delete 2 project(s) from work? (y/N) y
# ? Are you absolutely sure? This action cannot be undone. (y/N) y
#   Deleted 'old-api' from remote
# ? 'old-api' also exists locally. Remove local copy too? (y/N) n
#   Deleted 'prototype' from remote
#
#   Done. 2 of 2 project(s) deleted from work.
```

### Workflow Example

```bash
# Check disk usage of projects
skybox status

# Output shows my-old-project using 5GB

# Remove it to free space
skybox rm my-old-project

# Later, if needed again
skybox clone my-old-project
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (SkyBox not configured, project not found, removal failed) |

## See Also

- [skybox down](/reference/down) - Stop container (optionally with cleanup)
- [skybox clone](/reference/clone) - Restore project from remote
- [skybox list](/reference/list) - List local projects
- [skybox status](/reference/status) - Check project disk usage
