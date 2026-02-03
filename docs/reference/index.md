# Command Reference

DevBox provides a set of commands for managing your local-first development environments with remote sync.

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

# Set up shell integration (auto-start containers on cd)
eval "$(devbox hook bash)"  # Add to ~/.bashrc
eval "$(devbox hook zsh)"   # Or add to ~/.zshrc
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
