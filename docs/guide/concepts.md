# Core Concepts

This page explains the key concepts behind DevBox: how projects, containers, sync, and the remote server work together.

## Projects

A **project** in DevBox is a directory containing your source code, managed as a unit. Projects are:

- Stored locally in `~/.devbox/Projects/<project-name>/`
- Synced to your remote server at `<base_path>/<project-name>/`
- Registered in the DevBox configuration

### Project Structure

```
~/.devbox/Projects/my-app/
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
~/.devbox/Projects/my-app/      ~/code/my-app/
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

### Selective Sync

For large monorepos or projects where you only need a subset of directories, DevBox supports **selective sync**. Instead of syncing the entire project, you specify which subdirectories to sync, and DevBox creates a separate Mutagen session for each path.

This is useful when:
- Your repository is too large to sync entirely
- You only work on specific packages in a monorepo
- You want to reduce bandwidth and disk usage

Configure selective sync per project:

```bash
devbox config sync-paths my-app packages/frontend,packages/shared,configs
```

Each listed path gets its own independent Mutagen session (e.g., `devbox-my-app-packages-frontend`), syncing only that subdirectory between local and remote. All sessions use the same sync mode and ignore patterns as full sync.

## Templates

DevBox uses a **unified template selector** whenever a devcontainer configuration is needed — during `devbox up`, `devbox new`, or `devbox config devcontainer reset`. The selector shows three categories:

- **Built-in templates** — pre-configured environments for common languages
- **Your custom templates** — local devcontainer.json files you create and manage
- **Git URLs** — clone a repository as a project template

### Built-in Templates

| Template | Base Image | Post-Create Command | Editor Extensions |
|----------|-----------|---------------------|-------------------|
| **Node.js** | `devcontainers/javascript-node:20` | `npm install` (if `package.json` exists) | ESLint |
| **Python** | `devcontainers/python:3.12` | `pip install -r requirements.txt` (if exists) | Python |
| **Go** | `devcontainers/go:1.22` | `go mod download` (if `go.mod` exists) | Go |
| **Generic** | `devcontainers/base:debian` | None | None |

All templates include these common features:
- **Docker-outside-of-Docker (DooD)** -- access the host Docker daemon from inside the container
- **Git** -- pre-installed for version control
- **SSH passthrough** -- your host `~/.ssh` directory is bind-mounted read-only, so container Git operations use your existing SSH keys
- **Zsh** -- configured as the default shell

### Custom Local Templates

You can store reusable devcontainer configurations as `.json` files in `~/.devbox/templates/`. The filename (minus `.json`) becomes the display name in the template selector.

```
~/.devbox/templates/
├── bun.json          # Appears as "bun"
├── rust.json         # Appears as "rust"
└── company-stack.json # Appears as "company-stack"
```

Each file is a complete `devcontainer.json`. You can create templates through the CLI (select "Create new template" in the selector) or by manually placing files in the directory.

For full details on creating, validating, and managing custom templates, see [Custom Templates Reference](/reference/custom-templates).

## Encryption

DevBox supports **per-project encryption at rest** using **AES-256-GCM** authenticated encryption with **Argon2id** key derivation (64 MiB memory, 2 passes).

### How It Works

When encryption is enabled for a project, its files are stored as an encrypted `.tar.enc` archive on the remote server when not in use. This protects your code at rest on the remote.

The encrypted payload uses an initialization vector (16 bytes), authentication tag (16 bytes), and the encrypted data, all concatenated and base64-encoded.

### Enabling Encryption

```bash
devbox encrypt enable <project>
```

You will be prompted to set a passphrase. This passphrase is used to derive the encryption key via Argon2id.

::: warning
**Your passphrase cannot be recovered if forgotten.** There is no reset mechanism. If you lose your passphrase, your encrypted project data CANNOT be recovered.
:::

### What Is Protected

Encryption protects your project files at rest on the remote server. It does not encrypt sync traffic (sync traffic is protected by SSH) or your local `config.yaml`.

## Remote Server

The **remote server** stores your project backups and enables multi-machine workflows. DevBox supports **multiple remotes**, allowing you to organize projects across different servers (e.g., work server, personal server).

### Server Setup

During `devbox init`, you configure your first remote. You can add more remotes later with `devbox remote add`.

For each remote, you specify:

- **Name** - A friendly identifier (e.g., "production", "personal")
- **SSH Host** - The server to connect to
- **SSH User** - Username for SSH connection
- **Base Path** - Directory where projects are stored (e.g., `~/code`)
- **SSH Key** - Optional path to SSH private key

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
  "timestamp": "2026-02-03T10:30:00Z",
  "pid": 12345
}
```

### Lock States

| State | Description |
|-------|-------------|
| Unlocked | No machine currently holds the lock |
| Locked (this machine) | Your current machine holds the lock |
| Locked (other) | Another machine holds the lock |

### Atomic Lock Acquisition

Lock acquisition uses an atomic test-and-set approach via the shell's `noclobber` mode (`set -C`). This prevents race conditions where two machines try to acquire the same lock simultaneously -- only one will succeed in creating the file.

If the atomic creation fails (file already exists), DevBox checks ownership:
- If the current machine owns the lock, the timestamp is updated
- If another machine owns it, the user is prompted to take over

### Taking Over a Lock

If another machine holds the lock:

```
Project locked by 'work-laptop' since 2026-02-03T08:00:00Z
Take over lock anyway? (y/N)
```

Taking over is safe when:
- You know the other machine isn't actively working
- The other machine is unreachable
- You want to force work on this machine

### Force Bypass

You can bypass the lock check entirely when opening a shell:

```bash
devbox shell --force my-app
```

This skips lock verification and opens the container shell directly, without acquiring or checking the lock.

## Non-interactive Mode

For scripting and CI pipelines, DevBox supports a `--no-prompt` flag on commands that would normally prompt for user input:

```bash
devbox up --no-prompt my-app
devbox down --no-prompt my-app
devbox open --no-prompt my-app
```

When `--no-prompt` is set, DevBox will **error instead of prompting**. For example, if a lock is held by another machine, the command will exit with an error rather than asking whether to take over. This makes DevBox safe to use in automated workflows where no human is available to respond to prompts.

## Configuration

DevBox stores its configuration in `~/.devbox/config.yaml`:

```yaml
editor: cursor             # Default editor

defaults:
  sync_mode: two-way-resolved
  ignore:
    - node_modules
    - .git/*.lock
    # ... more patterns

remotes:                   # Multiple remote servers
  production:
    host: prod.example.com
    user: deploy
    path: ~/code
    key: ~/.ssh/id_ed25519
  personal:
    host: home-server
    user: null             # Uses SSH config
    path: ~/projects
    key: null

projects:
  my-app:
    remote: production     # Which remote this project belongs to
  other-project:
    remote: personal
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
- Explore [Workflow Tutorials](/guide/workflows/new-project) for step-by-step guides
