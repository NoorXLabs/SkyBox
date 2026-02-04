# Daily Development Workflow

This guide covers the day-to-day patterns for working with DevBox: starting your work, switching between projects, and shutting down cleanly.

## Starting Your Day

### Quick Start a Project

If you know which project you want to work on:

```bash
devbox up my-project
```

Or navigate to the project directory and run:

```bash
cd ~/.devbox/Projects/my-project
devbox up
```

DevBox auto-detects the project from your current directory.

### What Happens on Start

1. **Session Check** - DevBox checks for an existing session and creates one for your machine
2. **Sync Resume** - If sync was paused, it resumes automatically
3. **Container Start** - Starts or creates the dev container
4. **Post-Start** - Prompts for editor/shell options

### Choose Your Entry Point

After the container starts:

```
? What would you like to do?
  1) Open in editor
  2) Attach to shell
  3) Both
  4) Neither (just exit)
```

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
devbox up my-project --no-prompt

# Start and open editor
devbox up my-project --editor

# Start and attach shell
devbox up my-project --attach

# Start, open editor, and attach shell
devbox up my-project --editor --attach
```

## Checking Project Status

### Overview of All Projects

```bash
devbox status
```

Shows a table of all local projects:

```
Projects:

  NAME          CONTAINER  SYNC      BRANCH   SESSION               LAST ACTIVE  SIZE
  backend-api   running    syncing   main     active here           2 hours ago  245M
  frontend-app  stopped    paused    develop  none                  3 days ago   512M
  shared-lib    stopped    syncing   main     none                  1 day ago    48M
```

### Detailed Project Status

```bash
devbox status my-project
```

Shows comprehensive information:

```
Project: my-project
--------------------------------------------------

Container
  Status:     running
  Image:      mcr.microsoft.com/devcontainers/base:debian
  Uptime:     2 hours
  CPU:        0.5%
  Memory:     256MiB / 8GiB

Sync
  Status:     syncing
  Session:    devbox-my-project
  Pending:    0 files
  Last sync:  -

Git
  Branch:     feature/auth
  Status:     dirty
  Ahead:      3 commits
  Behind:     0 commits

Session
  Status:     active here
  Machine:    macbook-pro
  User:       john
  Started:    2026-02-03T10:30:00Z

Disk Usage
  Local:      245M
  Remote:     245M
```

## Switching Between Projects

### Stop Current Project

```bash
devbox down backend-api
```

This:
1. Flushes pending sync changes to remote
2. Stops the container
3. Ends the session
4. Optionally pauses sync to save resources

### Start Another Project

```bash
devbox up frontend-app
```

### Quick Project Selection

Without specifying a project, DevBox prompts you:

```bash
devbox up
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
devbox up backend-api --attach

# Terminal 2
devbox up frontend-app --attach
```

Note: Each project has its own session, so DevBox will warn you if the same project is active on another machine.

## Working with Running Containers

### Quick Access with `devbox open`

For running containers, use `devbox open` for quick access without the full startup flow:

```bash
# Open action menu (editor/shell/both)
devbox open my-project

# Open editor directly
devbox open my-project --editor

# Attach to shell directly
devbox open my-project --shell
```

This is faster than `devbox up` because it skips session checks and sync checks.

### Using `devbox up` with Running Containers

If a container is already running:

```bash
devbox up my-project
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
devbox editor my-project
```

Opens your configured editor pointing to the running container.

### Multiple Shell Sessions

Open additional shells for a running container:

```bash
# Terminal 1: Main work
devbox up my-project --attach

# Terminal 2: Run tests
devbox open my-project --shell

# Terminal 3: Watch logs
devbox open my-project --shell
```

### List Local Projects

```bash
devbox list
```

```
Local projects:

  backend-api
    Branch: main
    Path: /Users/john/.devbox/Projects/backend-api

  frontend-app
    Branch: develop
    Path: /Users/john/.devbox/Projects/frontend-app
```

## Ending Your Day

### Clean Shutdown

```bash
devbox down my-project
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
devbox down my-project --no-prompt
```

Stops container and ends session without prompts.

### Shutdown with Cleanup

```bash
devbox down my-project --cleanup
```

Removes the container entirely (not just stops it). Useful for freeing disk space.

### Shutdown All Projects

Stop all running containers at once using the `--all` flag:

```bash
devbox down --all
```

This stops all running containers and ends all sessions. If some projects fail to shut down, the command continues with the remaining projects and reports failures at the end.

## Managing Sync

### Background Sync Behavior

- Sync runs continuously in the background via Mutagen
- Changes sync bidirectionally (local <-> remote)
- Default mode: `two-way-resolved` (conflicts resolved automatically)

### Check Sync Status

```bash
devbox status my-project
```

Look at the Sync section:
- **syncing** - Active and healthy
- **paused** - Manually paused or auto-paused
- **error** - Sync problem (check mutagen logs)

### Pause Sync Manually

During `devbox down`, you can choose to pause sync. This saves resources when you are not actively working.

### Resume Paused Sync

Running `devbox up` automatically resumes paused sync sessions.

## Session Management

### Understanding Sessions

Sessions track which machine is actively working on a project. When you run `devbox up`:

1. DevBox checks for an existing session file in the project
2. If no session exists, creates one for your machine
3. If a session exists from the same machine, updates the timestamp
4. If a session exists from a different machine, warns and asks to continue

### Session Conflict Resolution

```
This project is running on work-laptop (since 2026-02-03T10:30:00Z)
? Continue anyway? (y/N)
```

Continuing anyway:
- Creates a new session for your current machine
- The session file syncs to the other machine via Mutagen
- Safe as long as you are not actively editing on both machines simultaneously

### Viewing Session Status

```bash
devbox status my-project
```

Session section shows:
- Current status (active here / active on another machine / none)
- Machine name
- Username
- When the session started

## Debugging with Logs

View container logs for a running project:

```bash
devbox logs my-project
```

Follow logs in real time (useful for debugging server processes):

```bash
devbox logs my-project -f
```

This streams container output continuously until you press `Ctrl+C`.

## Diagnosing Issues with Doctor

If something is not working as expected, run the built-in diagnostic tool:

```bash
devbox doctor
```

This checks Docker, Mutagen, SSH connectivity, and configuration in one command and suggests fixes for any problems found. Run this before diving into manual troubleshooting.

## Batch Operations

For multi-project workflows, use the `--all` flag to operate on all projects at once:

```bash
# Start all projects
devbox up --all

# Stop all projects
devbox down --all
```

If individual projects fail during batch operations, the command continues with the remaining projects and reports failures at the end.

## Troubleshooting Common Issues

### Container Won't Start

```bash
# Try rebuilding
devbox up my-project --rebuild
```

### Sync Stuck

Check Mutagen status directly:

```bash
~/.devbox/bin/mutagen sync list
```

### Stale Session After Crash

If your machine crashed without ending the session, the session automatically expires after 24 hours. You can also start the project immediately:

```bash
devbox up my-project
# Choose "Continue anyway" if warned about the stale session
```

### Free Up Disk Space

Remove old containers:

```bash
devbox down my-project --cleanup
```

Remove project entirely (keeps remote):

```bash
devbox rm my-project
```

