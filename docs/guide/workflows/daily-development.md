---
title: Daily Development Workflow
description: Day-to-day patterns for working with SkyBox. Start containers, switch between projects, manage sync, and shut down cleanly.
---

# Daily Development Workflow

This guide covers the day-to-day patterns for working with SkyBox: starting your work, switching between projects, and shutting down cleanly.

## Starting Your Day

### Quick Start a Project

If you know which project you want to work on:

```bash
skybox up my-project
```

Or navigate to the project directory and run:

```bash
cd ~/.skybox/Projects/my-project
skybox up
```

SkyBox auto-detects the project from your current directory.

::: tip Skip the Manual Start
With [shell integration](/guide/shell-integration), containers start automatically when you `cd` into a project directory — no `skybox up` needed.
:::

### What Happens on Start

1. **Session Check** - SkyBox checks for an existing session and creates one for your machine
2. **Sync Resume** - If sync was paused, it resumes automatically
3. **Container Start** - Starts or creates the dev container
4. **Post-Start** - Prompts for editor/shell options

### Choose Your Entry Point

After the container starts:

<!--@include: ../../snippets/post-start-action-menu.md-->

**Option 1: Open in Editor**

Opens your configured editor (Cursor, VS Code, Zed, etc.) with the Dev Container extension connecting to the running container.

**Option 2: Attach to Shell**

Drops you into an interactive shell inside the container:

```bash
Attaching to shell (Ctrl+D to exit)...
root@container:/workspaces/my-project#
```

**Option 3: Both**

Opens the editor and attaches to a shell.

### Non-Interactive Start

For scripting or quick access:

```bash
# Just start, no prompts
skybox up my-project --no-prompt

# Start and open editor
skybox up my-project --editor

# Start and attach shell
skybox up my-project --attach

# Start, open editor, and attach shell
skybox up my-project --editor --attach
```

## Checking Project Status

### Overview of All Projects

```bash
skybox status
```

Shows a table of all local projects:

```
Projects:

  NAME          CONTAINER  SYNC      BRANCH   SESSION               LAST ACTIVE  SIZE
  backend-api   running    syncing   main     active here           2 hours ago  245M
  frontend-app  stopped    paused    develop  none                  3 days ago   512M
  shared-lib    stopped    syncing   main     none                  1 day ago    48M
```

For a live-updating full-screen view, try [`skybox dashboard`](/reference/dashboard).

### Detailed Project Status

```bash
skybox status my-project
```

Shows comprehensive information:

<!--@include: ../../snippets/status-detailed.md-->

## Switching Between Projects

### Stop Current Project

```bash
skybox down backend-api
```

This:
1. Flushes pending sync changes to remote
2. Stops the container
3. Ends the session
4. Optionally pauses sync to save resources

### Start Another Project

```bash
skybox up frontend-app
```

### Quick Project Selection

Without specifying a project, SkyBox prompts you:

```bash
skybox up
```

```
? Select a project:
  1) backend-api
  2) frontend-app
  3) shared-lib
```

### Multiple Projects Simultaneously

You can run multiple projects at once - each gets its own container:

```bash
# Terminal 1
skybox up backend-api --attach

# Terminal 2
skybox up frontend-app --attach
```

Note: Each project has its own session, so SkyBox will warn you if the same project is active on another machine.

## Working with Running Containers

### Quick Access with `skybox open`

For running containers, use `skybox open` for quick access without the full startup flow:

```bash
# Open action menu (editor/shell/both)
skybox open my-project

# Open editor directly
skybox open my-project --editor

# Attach to shell directly
skybox open my-project --shell
```

This is faster than `skybox up` because it skips session checks and sync checks.

### Using `skybox up` with Running Containers

If a container is already running:

```bash
skybox up my-project
```

```
? Container already running. What would you like to do?
  1) Continue with existing container
  2) Restart container
  3) Rebuild container
```

- **Continue** - Just attach or open editor
- **Restart** - Stop and start fresh
- **Rebuild** - Full rebuild (use after devcontainer.json changes)

### Open Editor for Running Project

```bash
skybox editor my-project
```

Opens your configured editor pointing to the running container.

### Multiple Shell Sessions

Open additional shells for a running container with [`skybox shell`](/reference/shell):

```bash
# Terminal 1: Main work
skybox up my-project --attach

# Terminal 2: Run tests
skybox open my-project --shell

# Terminal 3: Watch logs
skybox open my-project --shell
```

### List Local Projects

```bash
skybox list
```

```
Local projects:

  backend-api
    Branch: main
    Path: /Users/john/.skybox/Projects/backend-api

  frontend-app
    Branch: develop
    Path: /Users/john/.skybox/Projects/frontend-app
```

## Ending Your Day

### Clean Shutdown

```bash
skybox down my-project
```

Interactive prompts:

```
Syncing pending changes... done
Stopping container... done
Session ended

? Remove the container to free up resources? (y/N)
? Pause background sync to save resources? (y/N)
```

### Quick Shutdown

```bash
skybox down my-project --no-prompt
```

Stops container and ends session without prompts.

### Shutdown with Cleanup

```bash
skybox down my-project --cleanup
```

Removes the container entirely (not just stops it). Useful for freeing disk space.

### Shutdown All Projects

Stop all running containers at once using the `--all` flag:

```bash
skybox down --all
```

This stops all running containers and ends all sessions. If some projects fail to shut down, the command continues with the remaining projects and reports failures at the end.

## Managing Sync

### Background Sync Behavior

- Sync runs continuously in the background via Mutagen
- Changes sync bidirectionally (local <-> remote)
- Default mode: `two-way-resolved` (conflicts resolved automatically)

### Check Sync Status

```bash
skybox status my-project
```

Look at the Sync section:
- **syncing** - Active and healthy
- **paused** - Manually paused or auto-paused
- **error** - Sync problem (check mutagen logs)

### Pause Sync Manually

During `skybox down`, you can choose to pause sync. This saves resources when you are not actively working.

### Resume Paused Sync

Running `skybox up` automatically resumes paused sync sessions.

## Session Management

### Understanding Sessions

Sessions track which machine is actively working on a project. When you run `skybox up`:

1. SkyBox checks for an existing session file in the project
2. If no session exists, creates one for your machine
3. If a session exists from the same machine, updates the timestamp
4. If a session exists from a different machine, warns and asks to continue

### Session Conflict Resolution

```
This project is running on work-laptop (started 3 days ago)
? Continue anyway? (y/N)
```

Continuing anyway:
- Creates a new session for your current machine
- The session file syncs to the other machine via Mutagen
- Safe as long as you are not actively editing on both machines simultaneously

### Viewing Session Status

```bash
skybox status my-project
```

Session section shows:
- Current status (active here / active on another machine / none)
- Machine name
- Username
- When the session started

## Debugging with Logs

View container logs for a running project:

```bash
skybox logs my-project
```

Follow logs in real time (useful for debugging server processes):

```bash
skybox logs my-project -f
```

This streams container output continuously until you press `Ctrl+C`. See [`skybox logs`](/reference/logs) for all available options.

## Diagnosing Issues with Doctor

If something is not working as expected, run the built-in diagnostic tool:

```bash
skybox doctor
```

This checks Docker, Mutagen, SSH connectivity, and configuration in one command and suggests fixes for any problems found. Run this before diving into manual troubleshooting.

## Batch Operations

For multi-project workflows, use the `--all` flag to operate on all projects at once:

```bash
# Start all projects
skybox up --all

# Stop all projects
skybox down --all
```

If individual projects fail during batch operations, the command continues with the remaining projects and reports failures at the end.

## Troubleshooting

For solutions to common issues with containers, sync, and sessions, see the [Troubleshooting Guide](/guide/troubleshooting).

## Related Commands

| Command | Usage in this workflow |
|---------|----------------------|
| [`skybox up`](/reference/up) | Start a project container |
| [`skybox down`](/reference/down) | Stop a project container |
| [`skybox open`](/reference/open) | Quick access to running containers |
| [`skybox shell`](/reference/shell) | Open additional shell sessions |
| [`skybox status`](/reference/status) | Check project and sync status |
| [`skybox dashboard`](/reference/dashboard) | Live-updating full-screen view |
| [`skybox logs`](/reference/logs) | View container or sync logs |
| [`skybox doctor`](/reference/doctor) | Diagnose common issues |
| [`skybox list`](/reference/list) | List local projects |

## See Also

- [Multi-Machine Workflow](/guide/workflows/multi-machine) - Working across multiple machines
- [Shell Integration](/guide/shell-integration) - Auto-start containers on `cd`
- [Troubleshooting](/guide/troubleshooting) - Common issues and solutions

