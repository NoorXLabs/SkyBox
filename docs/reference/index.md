# Command Reference

SkyBox provides a set of commands for managing your local-first development environments with remote sync.

## Commands Overview

<script setup>
import { data } from './index.data'
</script>

<table>
<thead><tr><th>Command</th><th>Description</th></tr></thead>
<tbody>
<tr v-for="cmd in data.commands" :key="cmd.link">
  <td><a :href="cmd.link"><code>{{ cmd.text }}</code></a></td>
  <td>{{ cmd.description }}</td>
</tr>
</tbody>
</table>

## Global Options

All commands support these global options:

```bash
-h, --help     Show help for a command
-v, --version  Show SkyBox version
--dry-run      Preview commands without executing them
```

### Dry-Run Mode

The `--dry-run` flag previews what a command would do without executing any side effects (no SSH, Docker, filesystem writes, or sync operations). Each skipped action is printed with a `[dry-run]` prefix.

```bash
# Preview starting a project
skybox up my-project --dry-run

# Preview removing a project and its remote copy
skybox rm my-project --remote --dry-run

# Preview cloning from remote
skybox clone my-project --dry-run
```

Supported commands: `up`, `down`, `clone`, `push`, `rm`, `init`, `new`, `editor`, `config`, `config-devcontainer`, `remote`, `update`, `encrypt`, `open`, `shell`, `hook`.

Read-only commands (`status`, `list`, `browse`, `logs`, `dashboard`, `doctor`) are unaffected since they have no side effects.

## Quick Reference

### Setup and Configuration

```bash
# Initial setup
skybox init

# Diagnose common issues
skybox doctor

# View configuration
skybox config

# Test remote connections
skybox config --validate

# Change default editor
skybox editor

# Or via config
skybox config set editor vim

# Enable project encryption
skybox encrypt enable my-app

# Disable project encryption
skybox encrypt disable my-app

# Set up shell integration (auto-start containers on cd)
eval "$(skybox hook bash)"  # Add to ~/.bashrc
eval "$(skybox hook zsh)"   # Or add to ~/.zshrc
```

### Managing Remote Servers

```bash
# Add a new remote
skybox remote add myserver user@host:~/code

# List configured remotes
skybox remote list

# Remove a remote
skybox remote remove myserver

# Rename a remote
skybox remote rename myserver production
```

### Working with Projects

```bash
# Start working on a project
skybox up my-project

# Stop a project
skybox down my-project

# Open editor/shell for running container
skybox open my-project

# Access shell inside container
skybox shell my-project

# Run a command in container
skybox shell my-project -c "npm test"

# Check project status
skybox status my-project
```

### Syncing with Remote

```bash
# See what's on the remote server
skybox browse

# Clone a project from remote
skybox clone my-project

# Push a local project to remote
skybox push ./my-project

# Create a new project on remote
skybox new
```

### Diagnostics & Maintenance

```bash
# Show container logs
skybox logs my-project -f

# Show sync logs
skybox logs my-project --sync

# Diagnose common issues
skybox doctor

# Update Mutagen binary
skybox update
```

### Batch Operations

```bash
# Start all projects
skybox up --all

# Stop all projects
skybox down --all

# Remove multiple projects (interactive multi-select)
skybox rm
```

### Cleanup

```bash
# Remove a project locally (remote copy preserved)
skybox rm my-project
```
