# DevBox

Local-first development containers with remote sync and multi-machine support.

## The Problem

- **Disk bloat**: `node_modules`, virtual envs, and build artifacts consume gigabytes of local storage
- **Latency**: Remote dev containers introduce network lag that makes tools like Claude Code frustrating
- **Multi-machine chaos**: Switching between machines means manual syncing or risking conflicts

## The Solution

DevBox stores your code on a remote server while running containers locally. You get:

- **Zero latency** - Containers run on your machine
- **Minimal disk usage** - Code lives on the server, synced on-demand
- **Safe multi-machine workflow** - Lock system prevents conflicts when switching computers
- **Offline capable** - Work locally, changes sync when you're back online

## How It Works

```
┌──────────────────┐        ┌──────────────────┐
│  Your Machine    │        │  Remote Server   │
│                  │ Mutagen│                  │
│  ~/.devbox/      │◄──────►│  ~/code/         │
│   projects/      │  sync  │   myproject/     │
│    myproject/    │        │                  │
│                  │        │  Lock files:     │
│  Docker          │        │  .devbox-locks/  │
│   Container      │        │                  │
└──────────────────┘        └──────────────────┘
```

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/devbox.git
cd devbox

# Install dependencies
npm install

# Link globally
npm link
```

### Requirements

- Node.js 20+
- Docker
- SSH access to a remote server

Mutagen is downloaded automatically during setup.

## Quick Start

```bash
# 1. Run the setup wizard
devbox init

# 2. Push an existing project to remote
devbox push ./my-project

# 3. Or clone a project from remote
devbox clone my-project

# 4. Start working
devbox up my-project --editor

# 5. When done, stop the container
devbox down my-project
```

## Commands

| Command | Description |
|---------|-------------|
| `devbox init` | Interactive setup wizard |
| `devbox push <path> [name]` | Upload local project to remote |
| `devbox clone <project>` | Download project from remote |
| `devbox browse` | List projects on remote server |
| `devbox list` | List local projects |
| `devbox up [project]` | Start container and acquire lock |
| `devbox down [project]` | Stop container |
| `devbox status [project]` | Show project status |
| `devbox editor` | Configure default editor |
| `devbox rm <project>` | Remove local project |

### Options

```bash
devbox up myproject --editor    # Open in configured editor
devbox up myproject --attach    # Attach to container shell
devbox up myproject --rebuild   # Rebuild the container
devbox down myproject --cleanup # Remove container and volumes
```

## Configuration

Config is stored at `~/.devbox/config.yaml`:

```yaml
remote:
  host: myserver          # SSH host from ~/.ssh/config
  base_path: ~/code       # Remote storage path

editor: cursor            # cursor | code | vim | nvim | zed

defaults:
  sync_mode: two-way-resolved
  ignore:
    - node_modules
    - venv
    - __pycache__
    - dist
    - build
    - .next
```

## Multi-Machine Workflow

DevBox uses lock files to prevent conflicts:

```bash
# On Machine A
devbox up myproject    # Acquires lock

# On Machine B
devbox up myproject    # Shows lock warning, offers takeover

# When switching machines intentionally
devbox handoff myproject  # Flushes sync, releases lock
```

## Editor Support

- Cursor
- VS Code
- Vim / Neovim
- Zed
- Custom commands

Configure with `devbox editor` or set in config.

## Devcontainer Templates

When pushing a project without a `.devcontainer`, DevBox offers templates:

- **Node.js 20** - With npm install hook
- **Python 3.12** - With pip install hook
- **Go 1.22** - Standard Go setup

All templates include Docker-outside-of-Docker, SSH passthrough, and Zsh.

## License

Apache License 2.0
