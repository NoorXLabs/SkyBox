# Command Reference

DevBox provides a set of commands for managing your local-first development environments with remote sync.

## Commands Overview

| Command | Description |
|---------|-------------|
| [`devbox init`](/reference/init) | Interactive setup wizard |
| [`devbox up`](/reference/up) | Start a development container |
| [`devbox down`](/reference/down) | Stop a development container |
| [`devbox open`](/reference/open) | Open editor/shell for running container |
| [`devbox shell`](/reference/shell) | Access shell inside container |
| [`devbox clone`](/reference/clone) | Clone remote project locally |
| [`devbox push`](/reference/push) | Push local project to remote |
| [`devbox new`](/reference/new) | Create new project on remote |
| [`devbox browse`](/reference/browse) | List projects on remote server |
| [`devbox list`](/reference/list) | List local projects |
| [`devbox status`](/reference/status) | Show project status |
| [`devbox remote`](/reference/remote) | Manage remote servers |
| [`devbox config`](/reference/config) | View/modify configuration |
| [`devbox encrypt`](/reference/encryption) | Manage project encryption |
| [`devbox editor`](/reference/editor) | Change default editor |
| [`devbox rm`](/reference/rm) | Remove project locally (keeps remote) |
| [`devbox doctor`](/reference/doctor) | Diagnose common issues |
| [`devbox logs`](/reference/logs) | Show container or sync logs |
| [`devbox update`](/reference/update) | Update Mutagen binary |

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

# Diagnose common issues
devbox doctor

# View configuration
devbox config

# Test remote connections
devbox config --validate

# Change default editor
devbox editor

# Or via config
devbox config set editor vim

# Enable project encryption
devbox encrypt enable my-app

# Disable project encryption
devbox encrypt disable my-app
```

### Managing Remote Servers

```bash
# Add a new remote
devbox remote add myserver user@host:~/code

# List configured remotes
devbox remote list

# Remove a remote
devbox remote remove myserver

# Rename a remote
devbox remote rename myserver production
```

### Working with Projects

```bash
# Start working on a project
devbox up my-project

# Stop a project
devbox down my-project

# Open editor/shell for running container
devbox open my-project

# Access shell inside container
devbox shell my-project

# Run a command in container
devbox shell my-project -c "npm test"

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

# Create a new project on remote
devbox new
```

### Diagnostics & Maintenance

```bash
# Show container logs
devbox logs my-project -f

# Show sync logs
devbox logs my-project --sync

# Diagnose common issues
devbox doctor

# Update Mutagen binary
devbox update
```

### Batch Operations

```bash
# Start all projects
devbox up --all

# Stop all projects
devbox down --all

# Remove multiple projects (interactive multi-select)
devbox rm
```

### Cleanup

```bash
# Remove a project locally (remote copy preserved)
devbox rm my-project
```
