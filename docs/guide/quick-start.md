---
title: Quick Start
description: Get started with SkyBox in minutes. Walk through initializing, pushing a project, starting a container, and syncing code to your remote server.
---

# Quick Start

This guide walks you through the typical SkyBox workflow: from setting up your first project to developing inside a container.

## Workflow Overview

```text
skybox init          Set up SkyBox (one-time)
      │
      ├── skybox push ./project    Push existing project to remote
      │         OR
      └── skybox clone project     Clone project from remote
              │
              ▼
         skybox up           Start the dev container
              │
              ▼
         Open in Editor      Code inside the container
              │
              ▼
         skybox down         Stop when done
```

## Step 1: Initialize SkyBox

If you haven't already, run the setup wizard:

```bash
skybox init
```

This configures your remote server connection and preferred editor. See [Installation](/guide/installation) for details.

## Step 2: Add Your First Project

You have two options for adding projects to SkyBox:

### Option A: Push an Existing Local Project

If you have a project on your machine, push it to SkyBox:

```bash
skybox push ./my-project
```

This will:
1. Copy the project to `~/.skybox/Projects/my-project/`
2. Create the project directory on your remote server
3. Set up bidirectional sync between local and remote
4. Register the project in SkyBox

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
skybox browse

# Clone the project
skybox clone my-project
```

Example output:
```
Cloning 'my-project' from my-server:~/code/my-project...
  Project found on remote
  Created /Users/you/.skybox/Projects/my-project
  Setting up sync...
  Syncing files from remote...
  Initial sync complete

Start dev container now? (Y/n)
```

## Step 3: Start the Dev Container

Start the development container:

```bash
skybox up my-project
```

Or, if you're inside the project directory:

```bash
cd ~/.skybox/Projects/my-project
skybox up
```

### First-Time Container Setup

If your project doesn't have a `devcontainer.json`, SkyBox will offer to create one:

```
Starting 'my-project'...
  Session started
  Sync is active
  No devcontainer.json found

? Would you like to create a devcontainer.json from a template? (Y/n)
```

<!--@include: ../snippets/template-selector-up.md-->

### Container Startup

Once the devcontainer is configured:

```
  Container started
```

<!--@include: ../snippets/post-start-action-menu.md-->

## Step 4: Develop in Your Editor

When you choose "Open in editor", SkyBox opens your project in your configured editor with full devcontainer support:

- **Cursor/VS Code**: Opens with Dev Containers extension, running inside the container
- **Other editors**: Opens the project folder

Your editor connects to the running container, giving you:
- Container's file system and tools
- Installed extensions running in-container
- Integrated terminal inside the container

## Step 5: Check Project Status

See the status of all your projects:

```bash
skybox status
```

Output:
```
Projects:

  NAME         CONTAINER  SYNC     BRANCH  SESSION       LAST ACTIVE  SIZE
  my-project   running    syncing  main    active here   2 hours ago  45M
  other-proj   stopped    paused   dev     none          3 days ago   120M
```

Get detailed info about a specific project:

```bash
skybox status my-project
```

Output:

<!--@include: ../snippets/status-detailed.md-->

## Step 6: Stop When Done

When you're finished working:

```bash
skybox down my-project
```

Or with cleanup to remove the container:

```bash
skybox down my-project --cleanup
```

## Need Help?

If you hit issues during setup or first run:

```bash
skybox doctor
```

- See [Troubleshooting](/guide/troubleshooting) for common fixes and recovery steps
- Use [`skybox logs`](/reference/logs) to inspect container or sync output while debugging

## Common Workflows

### Switching Machines

When moving from one machine to another:

1. On the old machine, stop the container:
   ```bash
   skybox down my-project
   ```

2. On the new machine, clone and start:
   ```bash
   skybox clone my-project
   skybox up my-project
   ```

SkyBox's [session system](/guide/concepts#session-system) will warn you if you try to start on a new machine while another machine has an active session.

### Quick Container Access

Start and immediately attach to shell:

```bash
skybox up my-project --attach
```

Start and open in editor:

```bash
skybox up my-project --editor
```

### Non-Interactive Mode

For scripts and automation:

```bash
skybox up my-project --no-prompt
skybox down my-project --no-prompt
```

### Force Rebuild Container

If you need to rebuild the container from scratch:

```bash
skybox up my-project --rebuild
```

## Next Steps

- Learn about [Core Concepts](/guide/concepts) to understand projects, containers, and sync
- See the [Command Reference](/reference/) for the full list of commands

### Workflows

- [Daily Development](/guide/workflows/daily-development) - Day-to-day patterns for starting, switching, and stopping projects
- [New Project Setup](/guide/workflows/new-project) - Creating and pushing projects to SkyBox
- [Multi-Machine Workflow](/guide/workflows/multi-machine) - Working across multiple computers
