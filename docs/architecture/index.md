# Architecture Overview

This section describes the internal architecture and design decisions of DevBox.

## High-Level Architecture

DevBox is a local-first development environment tool that syncs code between local machines and a remote server, running containers locally for zero-latency development.

```mermaid
flowchart TB
    subgraph Remote["Remote Server (Hetzner/etc)"]
        RemoteCode["~/code/<br/>project-a/<br/>project-b/"]
        Locks[".devbox-locks/"]
    end

    subgraph Local["Local Machine"]
        subgraph CLI["DevBox CLI"]
            Commands["Commands Layer"]
            Libs["Library Layer"]
        end

        subgraph Projects["~/.devbox/"]
            Config["config.yaml"]
            LocalProjects["projects/<br/>project-a/"]
            Bin["bin/mutagen"]
        end

        subgraph Container["Local Dev Container"]
            Workspace["/workspaces/project-a"]
            Tools["Dev Tools + Claude Code"]
        end
    end

    Commands --> Libs
    Libs -->|"SSH"| Remote
    Libs -->|"Docker API"| Container
    LocalProjects <-->|"Mutagen Sync<br/>(bidirectional)"| RemoteCode
    LocalProjects -->|"bind mount"| Workspace
    Libs -->|"Lock Management"| Locks
```

## Core Components

### Command Layer (`src/commands/`)

Handles user input and orchestrates operations. Each command is a separate module:

| Command | Purpose |
|---------|---------|
| `init` | Interactive setup wizard |
| `clone` | Copy project from remote to local |
| `push` | Push local project to remote |
| `up` | Start container, acquire lock |
| `down` | Stop container, keep lock |
| `status` | Show project status |
| `browse` | List remote projects |
| `list` | List local projects |
| `editor` | Change default editor |
| `rm` | Remove local project |
| `new` | Create new project on remote |
| `config` | View/edit configuration |
| `config-devcontainer` | Manage devcontainer.json from remote templates |
| `remote` | Manage multiple remotes |
| `shell` | Enter container shell |
| `logs` | View container and sync logs |
| `update` | Update Mutagen binary |
| `open` | Open project in editor |
| `doctor` | Diagnose environment issues |

### Library Layer (`src/lib/`)

Shared functionality used by commands:

| Module | Responsibility |
|--------|----------------|
| `config.ts` | Read/write `~/.devbox/config.yaml` |
| `container.ts` | Docker/devcontainer operations |
| `mutagen.ts` | Sync session management |
| `ssh.ts` | SSH connection testing, key setup |
| `lock.ts` | Multi-computer lock management |
| `project.ts` | Project path resolution |
| `download.ts` | Mutagen binary download |
| `templates.ts` | Devcontainer templates |
| `paths.ts` | Path constants |
| `errors.ts` | Error handling utilities |
| `ui.ts` | Terminal output (spinners, colors) |
| `shell.ts` | Shell escaping utilities |
| `constants.ts` | Shared constants (Docker labels, etc.) |
| `remote.ts` | Remote project operations |
| `migration.ts` | Config format migration |
| `startup.ts` | Dependency checks at launch |
| `encryption.ts` | AES-256-GCM encryption for secrets |
| `validation.ts` | Input validation and path safety |
| `projectTemplates.ts` | Built-in + user-defined project templates |

### Type Definitions (`src/types/`)

Centralized TypeScript interfaces for:
- Configuration (`DevboxConfig`, `ProjectConfig`)
- Container status (`ContainerStatus`, `ContainerInfo`)
- Sync status (`SyncStatus`)
- Lock management (`LockInfo`, `LockStatus`)
- Command options (`UpOptions`, `DownOptions`)

## Data Flow: `devbox up`

Here is the complete flow when a user runs `devbox up myproject`:

```mermaid
sequenceDiagram
    participant User
    participant CLI as DevBox CLI
    participant Lock as Lock System
    participant Mutagen as Mutagen Sync
    participant Docker as Docker/Devcontainer
    participant Remote as Remote Server

    User->>CLI: devbox up myproject

    Note over CLI: 1. Validate config exists
    CLI->>CLI: loadConfig()

    Note over CLI: 2. Resolve project
    CLI->>CLI: Check projectExists()

    Note over CLI: 3. Acquire lock
    CLI->>Remote: SSH: check lock file
    Remote-->>CLI: Lock status
    alt Lock conflict
        CLI->>User: "Locked by X. Take over?"
        User-->>CLI: Confirm
        CLI->>Remote: SSH: delete old lock
    end
    CLI->>Remote: SSH: create lock file
    Remote-->>CLI: Lock acquired

    Note over CLI: 4. Check sync status
    CLI->>Mutagen: getSyncStatus()
    Mutagen-->>CLI: Sync status
    alt Sync paused
        CLI->>Mutagen: resumeSync()
    end

    Note over CLI: 5. Check container
    CLI->>Docker: getContainerStatus()
    Docker-->>CLI: Container status
    alt Container running
        CLI->>User: "Restart/Rebuild/Continue?"
    end

    Note over CLI: 6. Check devcontainer.json
    CLI->>CLI: hasLocalDevcontainerConfig()
    alt No config
        CLI->>User: "Create from template?"
        User-->>CLI: Select template
        CLI->>CLI: createDevcontainerConfig()
    end

    Note over CLI: 7. Start container
    CLI->>Docker: devcontainer up
    Docker-->>CLI: Container started

    Note over CLI: 8. Post-start options
    CLI->>User: "Editor/Shell/Both/Neither?"
    User-->>CLI: Selection
    alt Open editor
        CLI->>Docker: openInEditor()
    end
    alt Attach shell
        CLI->>Docker: attachToShell()
    end
```

## File System Layout

```
~/.devbox/
├── config.yaml          # Main configuration
├── bin/
│   └── mutagen          # Bundled sync binary
├── projects/
│   ├── project-a/       # Synced project copy
│   │   ├── .git/        # Full git history (synced)
│   │   ├── .devcontainer/
│   │   └── src/
│   └── project-b/
└── logs/                # Log files

~/code/ (on remote)
├── project-a/           # Canonical source
├── project-b/
└── .devbox-locks/       # Lock files
    └── project-a.lock
```

## External Dependencies

| Tool | Purpose | How Used |
|------|---------|----------|
| Docker | Container runtime | Required for devcontainers |
| devcontainer CLI | Container lifecycle | Bundled via npm |
| Mutagen | File sync | Auto-downloaded to `~/.devbox/bin/` |
| SSH | Remote access | System SSH client |

## Key Libraries

| Package | Purpose |
|---------|---------|
| commander | CLI argument parsing |
| inquirer | Interactive prompts |
| chalk | Colored output |
| ora | Spinners |
| execa | Running external commands |
| yaml | Config file parsing |
