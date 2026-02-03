# Quick Start

This guide walks you through the typical DevBox workflow: from setting up your first project to developing inside a container.

## Workflow Overview

```
devbox init          Set up DevBox (one-time)
      │
      ├── devbox push ./project    Push existing project to remote
      │         OR
      └── devbox clone project     Clone project from remote
              │
              ▼
         devbox up           Start the dev container
              │
              ▼
         Open in Editor      Code inside the container
              │
              ▼
         devbox down         Stop when done
```

## Step 1: Initialize DevBox

If you haven't already, run the setup wizard:

```bash
devbox init
```

This configures your remote server connection and preferred editor. See [Installation](/guide/installation) for details.

## Step 2: Add Your First Project

You have two options for adding projects to DevBox:

### Option A: Push an Existing Local Project

If you have a project on your machine, push it to DevBox:

```bash
devbox push ./my-project
```

This will:
1. Copy the project to `~/.devbox/Projects/my-project/`
2. Create the project directory on your remote server
3. Set up bidirectional sync between local and remote
4. Register the project in DevBox

Example output:
```
Pushing 'my-project' to my-server:~/code/my-project...
  Remote path available
  Created remote directory
  Starting sync...
  Initial sync complete

Start dev container now? (Y/n)
```

### Option B: Clone from Remote

If the project already exists on your remote server:

```bash
# First, see what's available
devbox browse

# Clone the project
devbox clone my-project
```

Example output:
```
Cloning 'my-project' from my-server:~/code/my-project...
  Project found on remote
  Created /Users/you/.devbox/Projects/my-project
  Setting up sync...
  Syncing files from remote...
  Initial sync complete

Start dev container now? (Y/n)
```

## Step 3: Start the Dev Container

Start the development container:

```bash
devbox up my-project
```

Or, if you're inside the project directory:

```bash
cd ~/.devbox/Projects/my-project
devbox up
```

### First-Time Container Setup

If your project doesn't have a `devcontainer.json`, DevBox will offer to create one:

```
Starting 'my-project'...
  Lock acquired
  Sync is active
  No devcontainer.json found

Would you like to create a devcontainer.json from a template? (Y/n)

Select a template:
  1) Node.js - Node.js development environment
  2) Python - Python development environment
  3) Go - Go development environment
  4) Rust - Rust development environment
  5) Generic - Basic development container
```

### Container Startup

Once the devcontainer is configured:

```
  Container started

What would you like to do?
  1) Open in editor
  2) Attach to shell
  3) Both
  4) Neither (just exit)
```

## Step 4: Develop in Your Editor

When you choose "Open in editor", DevBox opens your project in your configured editor with full devcontainer support:

- **Cursor/VS Code**: Opens with Dev Containers extension, running inside the container
- **Other editors**: Opens the project folder

Your editor connects to the running container, giving you:
- Container's file system and tools
- Installed extensions running in-container
- Integrated terminal inside the container

## Step 5: Check Project Status

See the status of all your projects:

```bash
devbox status
```

Output:
```
Projects:

  NAME         CONTAINER  SYNC     BRANCH  LOCK           LAST ACTIVE  SIZE
  my-project   running    syncing  main    locked (this)  2 hours ago  45M
  other-proj   stopped    paused   dev     unlocked       3 days ago   120M
```

Get detailed info about a specific project:

```bash
devbox status my-project
```

Output:
```
Project: my-project
──────────────────────────────────────────────────

Container
  Status:     running
  Image:      mcr.microsoft.com/devcontainers/base:debian
  Uptime:     2 hours
  CPU:        0.5%
  Memory:     256M / 4G

Sync
  Status:     syncing
  Session:    devbox-my-project
  Pending:    0 files
  Last sync:  -

Git
  Branch:     main
  Status:     clean
  Ahead:      0 commits
  Behind:     0 commits

Lock
  Status:     locked (this machine)
  Machine:    my-laptop
  User:       me
  Timestamp:  2026-02-03T10:30:00Z
  PID:        12345

Disk Usage
  Local:      45M
  Remote:     44M
```

## Step 6: Stop When Done

When you're finished working:

```bash
devbox down my-project
```

Or with cleanup to remove the container:

```bash
devbox down my-project --cleanup
```

## Common Workflows

### Switching Machines

When moving from one machine to another:

1. On the old machine, stop the container:
   ```bash
   devbox down my-project
   ```

2. On the new machine, clone and start:
   ```bash
   devbox clone my-project
   devbox up my-project
   ```

DevBox's lock system will warn you if you try to start on a new machine while another machine still holds the lock.

### Quick Container Access

Start and immediately attach to shell:

```bash
devbox up my-project --attach
```

Start and open in editor:

```bash
devbox up my-project --editor
```

### Non-Interactive Mode

For scripts and automation:

```bash
devbox up my-project --no-prompt
devbox down my-project --no-prompt
```

### Force Rebuild Container

If you need to rebuild the container from scratch:

```bash
devbox up my-project --rebuild
```

## Command Reference

| Command | Description |
|---------|-------------|
| `devbox init` | Set up DevBox |
| `devbox browse` | List projects on remote |
| `devbox list` | List local projects |
| `devbox push <path>` | Push local project to remote |
| `devbox clone <project>` | Clone remote project locally |
| `devbox new` | Create new project on remote |
| `devbox up [project]` | Start development container |
| `devbox down [project]` | Stop development container |
| `devbox shell <project>` | Access shell inside container |
| `devbox status [project]` | Show project status |
| `devbox remote <subcommand>` | Manage remote servers |
| `devbox config` | View/modify configuration |
| `devbox editor` | Change default editor |
| `devbox rm <project>` | Remove local project |

## Next Steps

- Learn about [Core Concepts](/guide/concepts) to understand projects, containers, and sync
- See the [Command Reference](/reference/) for detailed command documentation
