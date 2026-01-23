# Core Concepts

This page explains the key concepts behind DevBox: how projects, containers, sync, and the remote server work together.

## Projects

A **project** in DevBox is a directory containing your source code, managed as a unit. Projects are:

- Stored locally in `~/.devbox/projects/<project-name>/`
- Synced to your remote server at `<base_path>/<project-name>/`
- Registered in the DevBox configuration

### Project Structure

```
~/.devbox/projects/my-app/
├── .devcontainer/
│   └── devcontainer.json    # Container configuration
├── .git/                     # Git repository
├── src/                      # Your source code
├── package.json
└── ...
```

### Project Lifecycle

```
push/clone          up              down              rm
    │               │                │                │
    ▼               ▼                ▼                ▼
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│Registered│───►│ Running │───►│ Stopped │───►│ Removed │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
```

1. **Registered** - Project exists locally with sync configured
2. **Running** - Container is active, ready for development
3. **Stopped** - Container stopped, project still registered
4. **Removed** - Local files deleted (remote copy preserved)

## Containers

DevBox uses **devcontainers** - Docker containers configured for development. They provide:

- Isolated development environment
- Pre-installed tools and dependencies
- Consistent setup across machines
- Editor integration (VS Code, Cursor)

### Devcontainer Configuration

Each project can have a `.devcontainer/devcontainer.json` file:

```json
{
  "name": "My App",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:18",
  "features": {
    "ghcr.io/devcontainers/features/git:1": {}
  },
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint"]
    }
  },
  "postCreateCommand": "npm install"
}
```

If no devcontainer configuration exists, DevBox offers templates during `devbox up`.

### Container States

| State | Description |
|-------|-------------|
| Running | Container is active and accepting connections |
| Stopped | Container exists but is not running |
| Not Found | No container exists for this project |

### Container vs Project

It's important to understand the distinction:

- **Project** = Your code files and configuration
- **Container** = The running Docker environment

You can:
- Stop a container while keeping the project
- Remove and recreate a container without losing code
- Have a project without ever starting a container

## Sync

DevBox uses **Mutagen** for bidirectional file synchronization between your local machine and remote server.

### How Sync Works

```
Local Machine                    Remote Server
~/.devbox/projects/my-app/      ~/code/my-app/
├── src/index.js         ◄────► ├── src/index.js
├── package.json         ◄────► ├── package.json
└── ...                         └── ...
```

- Changes on either side are synced to the other
- Sync happens continuously in the background
- Conflicts are resolved automatically (local changes win)

### Sync Modes

DevBox uses `two-way-resolved` sync mode:

- Both local and remote can be modified
- If both sides change the same file, local wins
- Ensures you never lose local work

### Ignored Files

By default, DevBox excludes certain files from sync:

```yaml
# Default ignore patterns
- .git/index.lock
- .git/*.lock
- .git/hooks/*
- node_modules
- venv
- .venv
- __pycache__
- *.pyc
- .devbox-local
- dist
- build
- .next
- target
- vendor
```

These patterns prevent syncing:
- Lock files that cause conflicts
- Large dependency directories
- Build artifacts

### Sync States

| State | Description |
|-------|-------------|
| Syncing | Active, transferring changes |
| Paused | Sync session exists but is paused |
| No Session | No sync configured for this project |
| Error | Sync encountered a problem |

### Managing Sync

Sync is managed automatically by DevBox:

- **Created** when you `push` or `clone` a project
- **Resumed** when you run `devbox up`
- **Paused** when you run `devbox down`
- **Terminated** when you run `devbox rm`

## Remote Server

The **remote server** stores your project backups and enables multi-machine workflows.

### Server Setup

During `devbox init`, you configure:

- **SSH Host** - The server to connect to
- **Base Path** - Directory where projects are stored (e.g., `~/code`)

### Remote Directory Structure

```
~/code/                          # Base path
├── .devbox-locks/               # Lock files
│   ├── my-app.lock
│   └── other-project.lock
├── my-app/                      # Project directories
│   ├── src/
│   └── ...
└── other-project/
    └── ...
```

### Lock System

DevBox uses a **lock system** to prevent conflicts when working from multiple machines.

When you run `devbox up`:

1. DevBox checks for an existing lock on the remote
2. If unlocked, creates a lock file with your machine info
3. If locked by you, updates the timestamp
4. If locked by another machine, warns and offers to take over

Lock file format (stored as JSON):

```json
{
  "machine": "my-laptop",
  "user": "developer",
  "timestamp": "2024-01-15T10:30:00Z",
  "pid": 12345
}
```

### Lock States

| State | Description |
|-------|-------------|
| Unlocked | No machine currently holds the lock |
| Locked (this machine) | Your current machine holds the lock |
| Locked (other) | Another machine holds the lock |

### Taking Over a Lock

If another machine holds the lock:

```
Project locked by 'work-laptop' since 2024-01-15T08:00:00Z
Take over lock anyway? (y/N)
```

Taking over is safe when:
- You know the other machine isn't actively working
- The other machine is unreachable
- You want to force work on this machine

## Configuration

DevBox stores its configuration in `~/.devbox/config.yaml`:

```yaml
remote:
  host: my-server          # SSH host name
  base_path: ~/code        # Remote directory

editor: cursor             # Default editor

defaults:
  sync_mode: two-way-resolved
  ignore:
    - node_modules
    - .git/*.lock
    # ... more patterns

projects:
  my-app: {}               # Registered projects
  other-project:
    editor: code           # Per-project overrides
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEVBOX_HOME` | DevBox directory | `~/.devbox` |

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Machine                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ~/.devbox/                                           │   │
│  │  ├── config.yaml        Configuration                │   │
│  │  ├── bin/mutagen        Sync tool                    │   │
│  │  └── projects/                                        │   │
│  │      └── my-app/        Your code ◄───────────┐      │   │
│  └──────────────────────────────────────────────│───────┘   │
│                                                  │           │
│  ┌────────────────────┐                         │           │
│  │  Docker Container  │◄── Mounts project ──────┘           │
│  │  (devcontainer)    │                                     │
│  └────────────────────┘                                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              │ Mutagen Sync (SSH)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Remote Server                          │
│                                                              │
│  ~/code/                                                     │
│  ├── .devbox-locks/        Lock files                       │
│  │   └── my-app.lock                                        │
│  └── my-app/               Synced project files             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

- See the [Command Reference](/reference/) for detailed command documentation
- Learn about [Container Configuration](/guide/containers) for customizing your dev environment
