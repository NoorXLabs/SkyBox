# devbox - Feature Specification

> Local-first dev containers with remote sync

## Problem Statement

1. Code folders take up significant space on local machines
2. Dev tools (node_modules, venvs, build artifacts) pollute local filesystems
3. Remote dev containers introduce latency that makes tools like Claude Code frustrating
4. Need ability to work offline and sync when back online
5. Want code accessible from multiple machines with server as source of truth
6. Need to push new local projects to remote server (not just clone existing)
7. Need safe multi-computer workflow with explicit handoff

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Remote Server (Hetzner/etc)                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ~/code/                                                  │  │
│  │    ├── project-a/    ← canonical source of truth         │  │
│  │    ├── project-b/    ← full git history included         │  │
│  │    └── .devbox-locks/← lock files for multi-computer     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ mutagen sync (bundled binary)
                              │ (bidirectional, background, over SSH)
                              │ (includes .git for full history)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Local Machine                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ~/.devbox/Projects/                                      │  │
│  │    └── project-a/    ← synced working copy with git       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │ bind mount                       │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Local Dev Container                                      │  │
│  │    /workspace/          ← isolated environment            │  │
│  │      - all dev tools                                      │  │
│  │      - claude code (run directly)                         │  │
│  │      - zero network latency                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI Language | TypeScript | Familiar, good CLI libs, async-friendly, sharable with future GUI |
| Sync Engine | Mutagen (bundled) | Auto-download binary during init, no manual install needed |
| Container Mgmt | devcontainer CLI | Standard, well-maintained, VS Code compatible |
| Git Handling | Sync .git directory | Full history on all machines, proper branch support |
| Multi-computer | Lock-based with handoff | Prevents conflicts, explicit ownership transfer |

---

## Core Features

### 1. Interactive Setup Wizard (`devbox init`)

**What it does:**
- Checks for required dependencies (docker, devcontainer-cli)
- **Auto-downloads mutagen binary** to `~/.devbox/bin/mutagen` if not present
  - Detects OS/arch, downloads correct release from GitHub
  - Verifies checksum
  - No manual mutagen installation needed
- Walks user through remote server configuration
- Detects existing SSH hosts from `~/.ssh/config` and offers to reuse
- Collects new server details: hostname/IP, username, friendly name
- Handles SSH key setup:
  - Finds existing keys (~/.ssh/id_ed25519, id_rsa, id_ecdsa)
  - Generates new key if needed
  - Checks if passwordless auth already works
  - Uses `ssh-copy-id` to install key on server (handles password auth)
  - Falls back to manual instructions if ssh-copy-id fails
- Adds new host to `~/.ssh/config` automatically
- Tests passwordless SSH connection
- Configures remote code directory path
- Shows existing projects on remote server
- Creates `~/.devbox/config.yaml` with all settings
- Creates `~/.devbox/Projects/` directory for local synced copies
- **Configures preferred editor** (cursor, code, vim, etc.)

**Config file structure:**
```yaml
remote:
  host: <ssh-host-name>
  base_path: ~/code

editor: cursor  # or "code", "vim", "zed", etc.

defaults:
  sync_mode: two-way-resolved
  ignore:
    # Don't ignore .git - we want full history synced
    # But ignore git lock files to prevent corruption
    - ".git/index.lock"
    - ".git/*.lock"  
    - ".git/hooks/*"
    - node_modules
    - venv
    - .venv
    - __pycache__
    - "*.pyc"
    - .devbox-local
    - dist
    - build
    - .next
    - target
    - vendor

projects: {}  # per-project overrides
```

### 2. Push Local Project to Remote (`devbox push <path> [name]`)

**What it does:**
- Takes a local project directory and pushes it to remote server
- Essential for first-time setup when remote is empty
- Creates directory on remote at `<base_path>/<name>`
- Performs initial sync local → remote
- Sets up bidirectional sync going forward
- Optionally initializes git if not present

```bash
# Push current directory
devbox push .

# Push specific directory with custom name
devbox push ./my-local-project my-project

# Push and initialize git
devbox push . --git-init
```

### 3. Clone Remote Project (`devbox clone <project>`)

**What it does:**
- Creates local directory at `~/.devbox/Projects/<project>`
- Creates mutagen sync session named `devbox-<project>`
- **Syncs .git directory** for full history and branches
- Configures sync with:
  - Mode: two-way-resolved (remote wins conflicts)
  - Ignores: git lock files, node_modules, etc.
- Waits for initial sync to complete
- Reports success with local path

### 4. Browse Remote Projects (`devbox browse`)

**What it does:**
- Connects to remote server via SSH
- Lists all projects in remote code directory
- Shows metadata for each project:
  - Directory size
  - Git repository status (yes/no)
  - Current git branch
  - Devcontainer config present (yes/no)
  - **Lock status** (locked by which machine, if any)
- Provides clone command hint

### 5. List Local Projects (`devbox list`)

**What it does:**
- Lists all projects in `~/.devbox/Projects/`
- Shows for each project:
  - Container status (running/stopped)
  - Sync status (syncing/paused/unknown)
  - Current git branch
  - **Lock status** (owned by this machine, another machine, or unlocked)
  - Last sync time
- Color-coded output

### 6. Start Working (`devbox up <project>`)

**What it does:**
- Verifies project exists locally (suggests clone/push if not)
- **Acquires lock on remote server**
  - Checks if project is locked by another machine
  - If locked: shows warning with machine name and timestamp
  - Prompts user to confirm taking over (or abort)
  - Writes lock file: `~/code/.devbox-locks/<project>.lock`
  - Lock contains: machine name, timestamp, user
- Ensures mutagen sync session exists (recreates if missing)
- Resumes sync if paused
- Flushes pending sync changes
- Detects devcontainer config:
  - Checks for `.devcontainer/` directory
  - Checks for `.devcontainer.json` file
  - Creates default devcontainer if none found
- Builds and starts dev container using `devcontainer up`
- Removes existing container if present (fresh start)
- Shows current sync status
- Drops user into bash shell inside container
- **Claude Code is available directly** - just run `claude` in the shell

**Lock file format:**
```json
{
  "machine": "macbook-pro",
  "user": "noor",
  "timestamp": "2024-01-15T10:30:00Z",
  "pid": 12345
}
```

### 7. Stop Working (`devbox down <project>`)

**What it does:**
- Finds running container by devcontainer label
- Stops the container
- Pauses mutagen sync session (saves resources)
- **Does NOT release lock** - you still own it
- Does NOT delete local files or sync session

### 8. Handoff to Another Machine (`devbox handoff <project>`)

**What it does:**
- **Flushes all pending sync changes first**
  - Shows progress: "Syncing 23 pending changes..."
  - Waits for sync to complete fully
  - If sync fails, aborts handoff with error
- Stops container if running
- Pauses sync session
- **Releases lock on remote server**
  - Deletes lock file
  - Project is now available for another machine
- Shows confirmation: "Project handed off. Safe to pick up on another machine."

```bash
devbox handoff myproject
# Output:
# [devbox] Syncing pending changes...
# [devbox] Synced 23 files (142KB)
# [devbox] Stopping container...
# [devbox] Releasing lock...
# [devbox] ✓ Project 'myproject' handed off successfully
# [devbox] You can now run 'devbox up myproject' on another machine
```

### 9. Open in Editor (`devbox open <project>`)

**What it does:**
- Ensures sync is running (resumes if paused)
- Opens project in configured editor
- Supports multiple editor types:
  - `cursor` - Cursor editor
  - `code` - VS Code
  - `vim`/`nvim` - Terminal editors
  - `zed` - Zed editor
  - Custom command via config
- For VS Code/Cursor: can attach to running container

```bash
# Uses configured editor
devbox open myproject

# Override editor for this invocation
devbox open myproject --editor code

# Open in container (VS Code/Cursor)
devbox open myproject --container
```

**Editor config:**
```yaml
editor: cursor

# Or more detailed:
editor:
  command: cursor
  attach_container: true  # for VS Code/Cursor, attach to devcontainer
```

### 10. Shell Access (`devbox shell <project>`)

**What it does:**
- Verifies container is running
- Executes bash/zsh shell inside container via `devcontainer exec`
- Errors if container not running (suggests `devbox up`)
- **Claude Code available directly** - just run `claude` in the shell

### 11. Sync Management (`devbox sync <project> <action>`)

**Actions:**
- `status` (default): Shows mutagen sync status for project
- `flush`: Forces immediate sync of all pending changes
- `pause`: Pauses background sync
- `resume`: Resumes paused sync

### 12. Project Status (`devbox status [project]`)

**What it does:**
- Without project: shows overview of all projects
- With project: detailed status of single project

**Overview shows:**
```
Projects:
  myapp         running   syncing   main    locked (this machine)
  backend       stopped   paused    dev     unlocked
  experiments   stopped   syncing   main    locked (desktop-home)
```

**Detailed shows:**
- Container status and resource usage
- Sync status (files pending, last sync time)
- Git branch and status (clean/dirty, ahead/behind)
- Lock status and history
- Disk usage (local and remote)

### 13. Remove Project (`devbox rm <project>`)

**What it does:**
- Prompts for confirmation
- Releases lock if held
- Stops container if running
- Terminates mutagen sync session
- Deletes local files
- Does NOT touch remote files (safe)

### 14. View/Edit Config (`devbox config <action>`)

**Actions:**
- `show` (default): Prints config file contents
- `edit`: Opens config in $EDITOR (or configured editor)
- `path`: Prints config file path
- `set <key> <value>`: Set a config value

---

## Git Workflow

### How Git Syncing Works

**The .git directory IS synced**, with exclusions for lock files:

```yaml
ignore:
  - ".git/index.lock"
  - ".git/*.lock"
  - ".git/hooks/*"  # hooks might be machine-specific
```

This means:
- Full git history on all machines
- All branches available everywhere
- Commits made locally sync to remote
- Can switch branches on any machine

### Branch Workflow

```bash
# On laptop
devbox up myproject
git checkout -b feature-x
# make changes, commit
git push origin feature-x
devbox handoff myproject

# On desktop
devbox up myproject
git checkout feature-x  # branch is already there via sync
# continue working
```

### Git Operations Safety

**Safe operations (do anywhere):**
- `git status`, `git log`, `git diff`
- `git checkout <branch>`
- `git commit`
- `git push`, `git pull`
- `git branch`

**Careful operations (do on one machine):**
- `git rebase` - avoid concurrent rebase on multiple machines
- `git reset --hard` - syncs to other machines
- Large merges - let sync complete before switching machines

### Recommended Setup

```
GitHub/GitLab (collaboration with others)
     ↑ push/pull
Remote Server (your personal source of truth)
     ↕ devbox sync  
Local Machine (where you actively work)
```

Push to GitHub for collaboration/backup. The sync handles your working directory.

---

## Multi-Computer Workflow

### Lock System

Prevents conflicts when using multiple computers:

1. **Acquiring lock (`devbox up`)**
   - Checks for existing lock on remote
   - If unlocked: creates lock, proceeds
   - If locked by same machine: proceeds (reconnecting)
   - If locked by different machine: warns and prompts

2. **Working with lock**
   - Lock is held while you have project "up"
   - `devbox down` keeps lock (you might come back)
   - Sync continues in background

3. **Releasing lock (`devbox handoff`)**
   - Flushes all pending sync changes
   - Waits for sync completion
   - Releases lock
   - Other machines can now acquire

### Typical Multi-Computer Day

```bash
# Morning on laptop
devbox up myproject
# work work work
devbox handoff myproject  # done for now

# Evening on desktop  
devbox up myproject       # acquires lock
# work work work
devbox handoff myproject  # ready for tomorrow

# Next day on laptop
devbox up myproject       # smooth handoff
```

### Conflict Scenarios

**Scenario: Forgot to handoff**
```bash
# On desktop
devbox up myproject
# Warning: Project locked by 'laptop' since 2024-01-15 10:30
# Last sync: 2 hours ago
# Take over anyway? [y/N]
```

If you take over:
- Desktop acquires lock
- Laptop's sync is orphaned (will error on next sync attempt)
- No data loss (both have recent copies)

**Scenario: Both machines editing simultaneously**
- Shouldn't happen with lock system
- If it does (lock override): last-write-wins via mutagen
- Git history preserved, worst case is a merge needed

---

## Claude Code Integration

### Direct Usage (No Wrapper)

Claude Code runs directly inside the dev container. No special `devbox code` command needed.

**Setup (in devcontainer.json):**
```json
{
  "postCreateCommand": "npm install -g @anthropic-ai/claude-code",
  "mounts": [
    "source=${localEnv:HOME}/.config/claude,target=/home/vscode/.config/claude,type=bind"
  ],
  "remoteEnv": {
    "ANTHROPIC_API_KEY": "${localEnv:ANTHROPIC_API_KEY}"
  }
}
```

**Usage:**
```bash
devbox up myproject
# Now in container shell:
claude  # just run it directly
```

### Why Direct is Better

- No message passthrough latency
- Full Claude Code features work
- Interactive mode works properly
- Can use with any editor integration
- `devbox` doesn't need to know about Claude Code internals

---

## Dependencies

### Required (User Must Have)

| Tool | Purpose | Install |
|------|---------|---------|
| docker | Container runtime | `brew install --cask docker` or docker.com |
| node | Run devbox CLI | Already have if doing JS/TS dev |

### Bundled (Auto-Downloaded)

| Tool | Purpose | How |
|------|---------|-----|
| mutagen | Bidirectional file sync | Downloaded to `~/.devbox/bin/` during `devbox init` |
| devcontainer-cli | Devcontainer lifecycle | Installed via npm during `devbox init` |

### Mutagen Auto-Download

During `devbox init`:
1. Detect OS (darwin/linux) and arch (amd64/arm64)
2. Download from `https://github.com/mutagen-io/mutagen/releases`
3. Verify SHA256 checksum
4. Extract to `~/.devbox/bin/mutagen`
5. Add to PATH for devbox operations

User never needs to manually install mutagen.

---

## Nice-to-Haves / Future Features

### High Priority

#### 1. Multiple Remote Servers
- Support multiple remotes in config (home server, work server, cloud)
- `devbox clone myapp --from work-server`
- `devbox remotes list/add/remove`
- Per-project remote override

#### 2. Status Dashboard (TUI)
- `devbox dashboard` - full-screen terminal UI
- Real-time sync status for all projects
- Container resource usage
- One-key actions (up, down, shell, handoff)
- Built with Ink (React for CLI) or blessed

#### 3. Init Project on Remote
- `devbox new <project>` - create new project on remote
- Initialize git repo
- Create default devcontainer config
- Start syncing immediately

#### 4. Container Templates
- Pre-built devcontainer configs for common stacks
- `devbox init-container <project> --template node-typescript`
- Templates: node, python, rust, go, fullstack, etc.
- Community template repository

### Medium Priority

#### 5. Selective Sync
- Large projects: only sync specific subdirectories
- `devbox clone myapp --include src,config --exclude data`
- Sparse checkout style for monorepos

#### 6. Snapshot/Backup
- `devbox snapshot <project>` - create point-in-time backup
- Store on remote server
- `devbox restore <project> <snapshot>`
- Useful before risky operations

#### 7. Sync Profiles
- Different ignore patterns for different scenarios
- `--profile minimal` (only source files)
- `--profile full` (everything except node_modules)
- Custom profiles in config

#### 8. Hooks
- Pre/post sync hooks
- Pre/post container start hooks
- Example: run migrations after sync, rebuild on start
- Config in `.devbox/hooks/` or `devbox.config.ts`

#### 9. Offline Mode
- `devbox offline <project>` - explicitly go offline
- Queue changes while offline
- Show pending changes count in status
- `devbox online <project>` - reconnect and sync
- Auto-detect network status

### Lower Priority / Exploratory

#### 10. GUI / Menu Bar App
- System tray icon showing sync status
- Click to see all projects
- Quick actions: up, down, shell, handoff
- Notifications for sync errors or lock conflicts
- Electron or Tauri

#### 11. Team Features
- Share devbox configs via git
- `.devbox.yaml` in project root (committed)
- Team members clone and it just works
- Shared remote server config (encrypted)

#### 12. Resource Limits
- Limit container CPU/memory
- Limit sync bandwidth
- Config per-project or global
- Useful on laptops with limited resources

#### 13. Logs and Debugging
- `devbox logs <project>` - container logs
- `devbox logs --sync <project>` - mutagen logs
- `devbox debug <project>` - verbose diagnostics
- Log rotation and cleanup

#### 14. Auto-Up on Directory Enter
- Shell integration (zsh/bash hook)
- `cd ~/.devbox/Projects/myapp` automatically runs `devbox up myapp`
- Configurable, off by default
- Auto-down when leaving directory

#### 15. Custom Sync Engine (Long-term)
- Replace mutagen with custom implementation
- Use chokidar for file watching
- ssh2 for transport
- Custom delta algorithm
- Full control over behavior

#### 16. Cloud Storage Backend
- Support S3/GCS/B2 as sync target (not just SSH)
- For serverless workflows
- Would need different sync mechanism
- Encryption at rest

#### 17. Encrypted Sync
- Encrypt files before sending to remote
- For sensitive projects on shared/untrusted servers
- Key management in system keychain
- Transparent encryption/decryption

#### 18. Metrics/Analytics
- Track time spent per project
- Sync statistics (bytes transferred, conflicts)
- Productivity insights
- Optional, local-only, privacy-respecting

---

## Design Decisions & Rationale

### Why TypeScript?
- Familiar language for the developer
- Excellent CLI libraries (commander, oclif, ink)
- Async/await maps well to SSH and file operations
- Can share code with future GUI (Electron/web)
- NPM distribution is easy
- Good IDE support for maintenance

### Why Bundle Mutagen?
- No manual installation step for users
- Version consistency
- Can update mutagen independently of user's system
- Falls back gracefully if download fails
- Single binary, small download (~15MB)

### Why Not Build Custom Sync?
- Mutagen is battle-tested and handles edge cases
- File watching, delta transfer, conflict resolution are complex
- Can always replace later if needed
- Bundling gives us the benefits without the maintenance

### Why Sync .git?
- Full history available on all machines
- Branches work naturally
- No separate git clone step needed
- Lock system prevents concurrent git operations
- Only exclude lock files to prevent corruption

### Why Lock-Based Multi-Computer?
- Prevents accidental concurrent edits
- Clear ownership model
- Handoff ensures sync completion
- Better than last-write-wins for important work
- Can always force-override if needed

### Why Local-First Instead of Remote-First?
- Zero latency for editing and running tools
- Claude Code works at full speed
- Works offline
- Background sync is transparent
- Remote is backup and sync target, not primary

### Why Direct Claude Code (No Wrapper)?
- No passthrough latency
- All Claude Code features work
- Interactive mode works properly
- Don't need to maintain compatibility
- Container setup is one-time

---

## TypeScript Project Structure

```
devbox/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   ├── init.ts           # Setup wizard
│   │   ├── push.ts           # Push local to remote
│   │   ├── clone.ts          # Clone remote to local
│   │   ├── browse.ts         # List remote projects
│   │   ├── list.ts           # List local projects
│   │   ├── up.ts             # Start working
│   │   ├── down.ts           # Stop working
│   │   ├── handoff.ts        # Release lock with sync
│   │   ├── open.ts           # Open in editor
│   │   ├── shell.ts          # Enter container
│   │   ├── sync.ts           # Sync management
│   │   ├── status.ts         # Project status
│   │   ├── config.ts         # Config management
│   │   └── rm.ts             # Remove project
│   │
│   ├── lib/
│   │   ├── config.ts         # Config file handling
│   │   ├── ssh.ts            # SSH operations
│   │   ├── mutagen.ts        # Mutagen wrapper
│   │   ├── docker.ts         # Docker/devcontainer operations
│   │   ├── lock.ts           # Lock file management
│   │   ├── download.ts       # Binary download (mutagen)
│   │   ├── editor.ts         # Editor integration
│   │   └── ui.ts             # Terminal UI helpers
│   │
│   └── types/
│       └── index.ts          # TypeScript types
│
├── templates/
│   └── devcontainer/         # Default devcontainer templates
│
└── bin/
    └── devbox                # Executable entry
```

### Key Libraries

| Library | Purpose |
|---------|---------|
| commander | CLI argument parsing |
| inquirer | Interactive prompts |
| chalk | Colored output |
| ora | Spinners |
| execa | Running external commands |
| ssh2 | SSH connections (if not shelling out) |
| yaml | Config file parsing |
| fs-extra | File operations |

---

## File Locations

| Path | Purpose |
|------|---------|
| `~/.devbox/config.yaml` | Main configuration |
| `~/.devbox/Projects/` | Local synced project copies |
| `~/.devbox/bin/` | Bundled binaries (mutagen) |
| `~/.devbox/logs/` | Log files |
| `~/.ssh/config` | SSH host configurations |
| `~/code/.devbox-locks/` | Lock files on remote server |
| `<project>/.devcontainer/` | Devcontainer config (synced) |
| `<project>/.devbox-local/` | Local-only files (not synced) |

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DEVBOX_HOME` | Override devbox directory | `~/.devbox` |
| `DEVBOX_EDITOR` | Override editor | Config value or `$EDITOR` |
| `DEVBOX_REMOTE` | Override default remote | Config value |
| `ANTHROPIC_API_KEY` | For Claude Code in containers | (from environment) |

---

## CLI Command Reference

```
devbox - Local-first dev containers with remote sync

SETUP
  devbox init                    Interactive setup wizard
  devbox config [show|edit|set]  View or modify configuration

PROJECTS  
  devbox push <path> [name]      Push local project to remote
  devbox clone <project>         Clone remote project locally
  devbox new <project>           Create new project on remote
  devbox rm <project>            Remove project locally

BROWSING
  devbox browse                  List projects on remote server
  devbox list                    List local projects
  devbox status [project]        Show detailed status

WORKFLOW
  devbox up <project>            Start container, acquire lock
  devbox down <project>          Stop container, keep lock
  devbox handoff <project>       Sync, stop, release lock
  devbox shell <project>         Open shell in container
  devbox open <project>          Open in editor

SYNC
  devbox sync <project> status   Show sync status
  devbox sync <project> flush    Force sync now
  devbox sync <project> pause    Pause syncing
  devbox sync <project> resume   Resume syncing
```

---

## Testing Checklist

Before considering complete:

- [ ] Fresh install on new machine (no prior config)
- [ ] Password-protected SSH server (ssh-copy-id flow)
- [ ] Server with existing key auth
- [ ] Push new local project to empty remote
- [ ] Clone existing remote project
- [ ] Project with no devcontainer config (default created)
- [ ] Project with custom devcontainer config
- [ ] Large project (1GB+)
- [ ] Git operations: commit, branch, checkout
- [ ] Work offline for 30 min, reconnect
- [ ] Handoff between two computers
- [ ] Lock conflict (forgot to handoff)
- [ ] Multiple projects at once
- [ ] Pause/resume sync
- [ ] Remove and re-clone project
- [ ] Open in VS Code, Cursor, vim
- [ ] Claude Code works in container
- [ ] Different shells (bash, zsh)
- [ ] macOS (Intel and ARM)
- [ ] Linux (Ubuntu, Arch)

---

## Migration Path from Bash Sketch

1. Create TypeScript project structure
2. Implement config.ts (read/write config.yaml)
3. Implement ssh.ts (connection testing, key setup)
4. Implement download.ts (mutagen binary download)
5. Port `init` command (most complex)
6. Port `clone`, `push`, `up`, `down`, `shell`
7. Add lock system (`up`, `handoff`)
8. Add `open` command
9. Port remaining commands
10. Add tests
11. Package for npm distribution

---

## Related Tools / Prior Art

| Tool | Relationship |
|------|--------------|
| DevPod | Similar concept but remote-first, not local-first |
| Coder | Remote workspaces, enterprise focused |
| Gitpod | Cloud dev environments |
| VS Code Remote | Remote-first containers |
| Mutagen | Underlying sync engine (bundled) |
| Syncthing | General file sync (not dev-focused) |
| SSHFS | Remote mount (has latency issues) |
| rsync | One-way sync (no watching) |
| unison | Bidirectional but complex config |

