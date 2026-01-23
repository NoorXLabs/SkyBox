# Command Reference

DevBox provides a set of commands for managing your local-first development environments with remote sync.

## Commands Overview

| Command | Description |
|---------|-------------|
| [`devbox init`](/reference/init) | Interactive setup wizard |
| [`devbox up`](/reference/up) | Start a development container |
| [`devbox down`](/reference/down) | Stop a development container |
| [`devbox clone`](/reference/clone) | Clone remote project locally |
| [`devbox push`](/reference/push) | Push local project to remote |
| [`devbox browse`](/reference/browse) | List projects on remote server |
| [`devbox list`](/reference/list) | List local projects |
| [`devbox status`](/reference/status) | Show project status |
| [`devbox editor`](/reference/editor) | Change default editor |
| [`devbox rm`](/reference/rm) | Remove project locally (keeps remote) |

## Global Options

All commands support these global options:

```bash
-h, --help     Show help for a command
-v, --version  Show DevBox version
```

## Quick Reference

### Setup and Configuration

```bash
# Initial setup
devbox init

# Change default editor
devbox editor
```

### Working with Projects

```bash
# Start working on a project
devbox up my-project

# Stop a project
devbox down my-project

# Check project status
devbox status my-project
```

### Syncing with Remote

```bash
# See what's on the remote server
devbox browse

# Clone a project from remote
devbox clone my-project

# Push a local project to remote
devbox push ./my-project
```

### Cleanup

```bash
# Remove a project locally (remote copy preserved)
devbox rm my-project
```
