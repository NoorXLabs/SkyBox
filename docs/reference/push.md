---
title: skybox push
description: Push a local project to the remote server with skybox push. Upload project files via SCP to your configured remote.
---

# skybox push

Push a local project to the remote server.

<!-- COMMAND-SPEC:START -->
## Usage

```bash
skybox push [options] <path> [name]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `<path>` | Path to local project directory to push. |
| `[name]` | Optional remote project name. If omitted, the local directory name is used. |

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

The `push` command uploads a local project to your configured remote server and sets up bidirectional sync. It performs the following steps:

1. **Path Resolution** - Resolves the provided path to an absolute path
2. **Remote Selection** - If multiple remotes are configured, prompts you to select which remote to push to
3. **Git Check** - Verifies project is a git repository (offers to initialize if not)
4. **Remote Check** - Checks if project already exists on remote (prompts to overwrite)
5. **Ownership Check** - If the project exists on remote, verifies you are the owner before allowing overwrite
6. **Remote Setup** - Creates the project directory on the remote server
7. **Local Copy** - Copies project to SkyBox projects directory
8. **Sync Setup** - Creates a Mutagen sync session for bidirectional synchronization (uses selective sync if project has `sync_paths` configured)
9. **Initial Sync** - Uploads all files to the remote
10. **Set Ownership** - Records you as the project owner on the remote
11. **Registration** - Registers the project in SkyBox configuration
12. **Container Prompt** - Offers to start the development container immediately

### Git Repository

SkyBox works best with git repositories. If the project isn't a git repo, you'll be prompted to initialize one. This enables:

- Branch tracking in status output
- Change detection
- Better conflict resolution

### Project Naming

If you don't specify a name, the directory name is used:

```bash
skybox push ./my-awesome-project
# Creates project named "my-awesome-project"

skybox push ./my-awesome-project cool-api
# Creates project named "cool-api"
```

### Local Storage

After pushing, the project is copied to `~/.skybox/Projects/<project-name>` and sync is established between this location and the remote.

## Examples

```bash
# Push current project with directory name
skybox push ./my-project

# Push with a custom name
skybox push ./my-project my-api

# Push project from anywhere
skybox push /path/to/my-project
```

### Container Auto-Start

After pushing, you'll be prompted to start the development container:

```bash
? Start dev container now? (y/N)
```

Choosing **yes** runs the full [`skybox up`](/reference/up) flow:
- Creates a session for your machine
- Prompts for devcontainer template (if none exists)
- Starts the container
- Offers to open in your editor or attach to shell

Choosing **no** displays the project location and you can start later with `skybox up`.

### Workflow Example

```bash
# Start with an existing local project
cd ~/code/my-new-app

# Push it to remote and start container immediately
skybox push .
# ? Start dev container now? Yes
# ─── Starting 'my-new-app'... ───
# ℹ Session started
# ✔ Sync is active
# ...
```

### Project Ownership

When you push a project, SkyBox automatically records you as the owner on the remote server (via a `.skybox-owner` file). This prevents other users from accidentally overwriting or deleting your projects.

If someone else owns the project, the push is blocked:

```
Cannot overwrite: Project owned by 'alice' (created on alice-macbook)
Contact the project owner to transfer ownership or use a different project name.
```

Projects without an ownership file (e.g., those created before this feature) can be pushed to by anyone, and ownership will be set on the next successful push.

### Overwrite Behavior

If the project already exists on remote:

```bash
skybox push ./my-project

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

- [skybox clone](/reference/clone) - Clone project from remote
- [skybox browse](/reference/browse) - List projects on remote
- [skybox up](/reference/up) - Start the container
- [skybox list](/reference/list) - List local projects
