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

1. **Lock Acquisition** - DevBox acquires a lock on the remote to prevent conflicts
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

  NAME          CONTAINER  SYNC      BRANCH   LOCK                  LAST ACTIVE  SIZE
  backend-api   running    syncing   main     locked (this machine) 2 hours ago  245M
  frontend-app  stopped    paused    develop  unlocked              3 days ago   512M
  shared-lib    stopped    syncing   main     unlocked              1 day ago    48M
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
  Image:      mcr.microsoft.com/devcontainers/javascript-node:20
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

Lock
  Status:     locked (this machine)
  Machine:    macbook-pro
  User:       john
  Timestamp:  2024-01-15T10:30:00Z

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
3. Releases the lock
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

Note: Each project acquires its own lock, so the same project cannot be actively worked on from two machines simultaneously.

## Working with Running Containers

### Attach to a Running Container

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
Lock released

? Remove the container to free up resources? (y/N)
? Pause background sync to save resources? (y/N)
```

### Quick Shutdown

```bash
devbox down my-project --no-prompt
```

Stops container and releases lock without prompts.

### Shutdown with Cleanup

```bash
devbox down my-project --cleanup
```

Removes the container entirely (not just stops it). Useful for freeing disk space.

### Shutdown All Projects

Stop all running containers:

```bash
for project in $(devbox list --quiet); do
  devbox down "$project" --no-prompt
done
```

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

## Lock Management

### Understanding Locks

Locks prevent two machines from editing the same project simultaneously. When you run `devbox up`:

1. DevBox checks for existing lock on remote
2. If unlocked, acquires lock for your machine
3. If locked by another machine, prompts for action

### Lock Conflict Resolution

```
Project locked by 'work-laptop' since 2024-01-15T10:30:00Z
? Take over lock anyway? (y/N)
```

Taking over the lock:
- Releases the other machine's lock
- Acquires lock for your current machine
- The other machine will see "lock lost" on next operation

### Viewing Lock Status

```bash
devbox status my-project
```

Lock section shows:
- Current lock holder
- Machine name
- Username
- Timestamp acquired

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

### Lock Stuck After Crash

If your machine crashed without releasing the lock:

```bash
devbox up my-project
# Choose "Take over lock anyway" when prompted
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

## Next Steps

- [Team Sharing](/guide/workflows/team-sharing) - Collaborate with teammates on shared projects
