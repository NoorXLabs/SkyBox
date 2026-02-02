# devbox clone

Clone a remote project to your local machine.

## Usage

```bash
devbox clone [project]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[project]` | Name of the project to clone from the remote server. If omitted, shows an interactive multi-select of remote projects. |

## Options

This command has no additional options.

## Description

The `clone` command downloads a project from your configured remote server to your local machine. It performs the following steps:

1. **Remote Selection** - If multiple remotes are configured, prompts you to select which remote to clone from
2. **Remote Check** - Verifies the project exists on the remote server
3. **Local Check** - Checks if project already exists locally (prompts to overwrite)
4. **Directory Creation** - Creates the local project directory
5. **Sync Setup** - Creates a Mutagen sync session for bidirectional file synchronization (uses selective sync if project has `sync_paths` configured)
6. **Initial Sync** - Downloads all files from remote to local
7. **Registration** - Registers the project in DevBox configuration
8. **Container Prompt** - Offers to start the development container

### Interactive Multi-Clone

When run without a project argument, `devbox clone` enters an interactive flow:

1. **Remote Selection** - Select which remote to clone from
2. **Project List** - Fetches all projects from the remote
3. **Multi-Select** - Shows a checkbox list of available projects (already-local projects are filtered out)
4. **Batch Clone** - Clones each selected project sequentially
5. **Summary** - Reports how many projects succeeded and failed

### Local Storage

Projects are cloned to `~/.devbox/Projects/<project-name>`.

### Sync Behavior

The sync session uses "two-way-resolved" mode, meaning:

- Changes on either side are synced to the other
- Conflicts are automatically resolved (favoring the most recent change)
- Default ignore patterns exclude node_modules, .git, build artifacts, etc.

### Encrypted Projects

If the project is encrypted on the remote (has a `.tar.enc` archive), DevBox will notify you after cloning. You'll need to provide the passphrase when running `devbox up` to decrypt the project before working on it.

### Overwrite Behavior

If a project already exists locally, you'll be prompted twice:

1. First confirmation to overwrite
2. Second confirmation warning that local changes will be lost

This prevents accidental data loss.

## Examples

```bash
# Clone a project from remote
devbox clone my-api

# Interactive multi-clone
devbox clone
# Shows checkbox list of remote projects to select

# After cloning, start working
devbox up my-api --editor
```

### Workflow Example

```bash
# See available projects on remote
devbox browse

# Output:
# Remote projects (my-server:~/code):
#
#   my-api
#     Branch: main
#
#   frontend-app
#     Branch: feature/new-ui

# Clone one of them
devbox clone my-api

# Start the container when prompted, or manually:
devbox up my-api
```

### Switching Machines

```bash
# On Machine A - stop and clean up
devbox down my-project --cleanup
# Choose to remove local files

# On Machine B - clone and continue
devbox clone my-project
devbox up my-project
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (project not found on remote, sync failed) |

## See Also

- [devbox browse](/reference/browse) - List projects on remote server
- [devbox push](/reference/push) - Push local project to remote
- [devbox up](/reference/up) - Start the container after cloning
- [devbox rm](/reference/rm) - Remove project locally
