# devbox push

Push a local project to the remote server.

## Usage

```bash
devbox push <path> [name]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `<path>` | Path to the local project directory (required) |
| `[name]` | Name for the project on remote. Defaults to the directory name if not specified. |

## Options

This command has no additional options.

## Description

The `push` command uploads a local project to your configured remote server and sets up bidirectional sync. It performs the following steps:

1. **Path Resolution** - Resolves the provided path to an absolute path
2. **Git Check** - Verifies project is a git repository (offers to initialize if not)
3. **Remote Check** - Checks if project already exists on remote (prompts to overwrite)
4. **Remote Setup** - Creates the project directory on the remote server
5. **Local Copy** - Copies project to DevBox projects directory
6. **Sync Setup** - Creates a Mutagen sync session for bidirectional synchronization
7. **Initial Sync** - Uploads all files to the remote
8. **Registration** - Registers the project in DevBox configuration
9. **Container Prompt** - Offers to start the development container immediately

### Git Repository

DevBox works best with git repositories. If the project isn't a git repo, you'll be prompted to initialize one. This enables:

- Branch tracking in status output
- Change detection
- Better conflict resolution

### Project Naming

If you don't specify a name, the directory name is used:

```bash
devbox push ./my-awesome-project
# Creates project named "my-awesome-project"

devbox push ./my-awesome-project cool-api
# Creates project named "cool-api"
```

### Local Storage

After pushing, the project is copied to `~/.devbox/projects/<project-name>` and sync is established between this location and the remote.

## Examples

```bash
# Push current project with directory name
devbox push ./my-project

# Push with a custom name
devbox push ./my-project my-api

# Push project from anywhere
devbox push /path/to/my-project
```

### Container Auto-Start

After pushing, you'll be prompted to start the development container:

```bash
? Start dev container now? (y/N)
```

Choosing **yes** runs the full [`devbox up`](/reference/up) flow:
- Acquires project lock
- Prompts for devcontainer template (if none exists)
- Starts the container
- Offers to open in your editor or attach to shell

Choosing **no** displays the project location and you can start later with `devbox up`.

### Workflow Example

```bash
# Start with an existing local project
cd ~/code/my-new-app

# Push it to remote and start container immediately
devbox push .
# ? Start dev container now? Yes
# ─── Starting 'my-new-app'... ───
# ℹ Lock acquired
# ✔ Sync is active
# ...
```

### Overwrite Behavior

If the project already exists on remote:

```bash
devbox push ./my-project

# Output:
# Pushing 'my-project' to server:~/code/my-project...
#   Project already exists on remote
# ? Project already exists on remote. Overwrite? (y/N)
```

You'll be prompted twice for confirmation to prevent accidental data loss.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (path not found, git init failed, sync failed) |

## See Also

- [devbox clone](/reference/clone) - Clone project from remote
- [devbox browse](/reference/browse) - List projects on remote
- [devbox up](/reference/up) - Start the container
- [devbox list](/reference/list) - List local projects
