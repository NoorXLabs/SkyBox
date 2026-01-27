# DevBox - Project Specification & Roadmap

> Local-first dev containers with remote sync

This document serves as the single source of truth for DevBox's specification, current implementation status, and future roadmap.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Implementation Status](#3-implementation-status)
4. [Commands Reference](#4-commands-reference)
5. [Design Decisions](#5-design-decisions)
6. [Remaining Work](#6-remaining-work)
7. [Future Features](#7-future-features)
8. [Suggested Improvements](#8-suggested-improvements)
9. [Pre-Production Checklist](#9-pre-production-checklist)

---

## 1. Overview

### Problem Statement

1. **Disk bloat**: `node_modules`, virtual envs, and build artifacts consume gigabytes of local storage
2. **Latency**: Remote dev containers introduce network lag that makes tools like Claude Code frustrating
3. **Multi-machine chaos**: Switching between machines means manual syncing or risking conflicts
4. **Offline limitations**: Need ability to work offline and sync when back online
5. **Source of truth**: Want code accessible from multiple machines with server as source of truth

### Solution

DevBox stores your code on a remote server while running containers locally:

- **Zero latency** - Containers run on your machine
- **Minimal disk usage** - Code lives on the server, synced on-demand
- **Safe multi-machine workflow** - Lock system prevents conflicts when switching computers
- **Offline capable** - Work locally, changes sync when you're back online

---

## 2. Architecture

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

### Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| CLI Language | TypeScript (Bun) | Familiar, good CLI libs, async-friendly |
| Sync Engine | Mutagen (bundled) | Auto-download binary, no manual install |
| Container Mgmt | devcontainer CLI | Standard, VS Code compatible |
| Git Handling | Sync .git directory | Full history on all machines |
| Multi-computer | Lock-based with handoff | Prevents conflicts, explicit ownership |

### File Locations

| Path | Purpose |
|------|---------|
| `~/.devbox/config.yaml` | Main configuration |
| `~/.devbox/Projects/` | Local synced project copies |
| `~/.devbox/bin/` | Bundled binaries (mutagen) |
| `~/.ssh/config` | SSH host configurations |
| `~/code/.devbox-locks/` | Lock files on remote server |

---

## 3. Implementation Status

### Commands (14/14 Complete)

| Command | Status | Description |
|---------|--------|-------------|
| `devbox init` | ✅ Complete | Interactive setup wizard |
| `devbox browse` | ✅ Complete | List projects on remote server |
| `devbox list` | ✅ Complete | List local projects |
| `devbox clone` | ✅ Complete | Clone remote project locally |
| `devbox push` | ✅ Complete | Push local project to remote |
| `devbox up` | ✅ Complete | Start container with lock acquisition |
| `devbox down` | ✅ Complete | Stop container with sync flush and lock release |
| `devbox status` | ✅ Complete | Show detailed project status |
| `devbox editor` | ✅ Complete | Configure default editor |
| `devbox rm` | ✅ Complete | Remove local project |
| `devbox shell` | ✅ Complete | Enter container shell |
| `devbox new` | ✅ Complete | Create new project on remote |
| `devbox config` | ✅ Complete | View/modify configuration |
| `devbox remote` | ✅ Complete | Manage multiple remote servers |

### Core Features

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-remote support | ✅ Complete | Multiple SSH remotes per config |
| Lock system | ✅ Complete | Multi-machine coordination |
| Mutagen sync | ✅ Complete | Bidirectional with auto-download |
| Devcontainer templates | ✅ Complete | Node.js, Python, Go, Bun |
| Editor integration | ✅ Complete | Cursor, VS Code, Vim, Zed |
| Config migration | ✅ Complete | v1 to v2 format auto-migration |
| VitePress documentation | ✅ Complete | Full docs site |
| CI/CD pipelines | ✅ Complete | GitHub Actions |
| Pre-commit hooks | ✅ Complete | Lefthook integration |

### Test Coverage

- 26 test files with ~529 test/describe blocks
- Unit and integration tests with proper isolation
- All tests passing via pre-commit hooks

---

## 4. Commands Reference

### Setup Commands

```bash
devbox init                      # Interactive setup wizard
devbox config [key] [value]      # View or modify configuration
devbox config --validate         # Test connection to all remotes
devbox remote add <name> <url>   # Add a remote server
devbox remote list               # List configured remotes
devbox remote remove <name>      # Remove a remote
devbox remote rename <old> <new> # Rename a remote
```

### Project Management

```bash
devbox push <path> [name]        # Push local project to remote
devbox clone <project>           # Clone remote project locally
devbox new                       # Create new project on remote (interactive)
devbox rm <project>              # Remove project locally (keeps remote)
```

### Browsing & Status

```bash
devbox browse                    # List projects on remote server
devbox list                      # List local projects
devbox status [project]          # Show detailed status
```

### Workflow Commands

```bash
devbox up [project]              # Start container, acquire lock
devbox up <project> --editor     # Start and open in editor
devbox up <project> --attach     # Start and attach to shell
devbox up <project> --rebuild    # Force container rebuild

devbox down [project]            # Stop container, release lock
devbox down <project> --cleanup  # Also remove container and volumes

devbox shell <project>           # Open shell in running container
devbox shell <project> -c "cmd"  # Run single command in container

devbox editor                    # Configure default editor
```

### Configuration File

```yaml
# ~/.devbox/config.yaml
remotes:
  work:
    host: work-server
    user: null           # use SSH config default
    path: ~/code
    key: null            # use SSH config default
  personal:
    host: home-server
    user: deploy
    path: ~/projects
    key: ~/.ssh/personal_key

editor: cursor           # cursor | code | vim | nvim | zed

defaults:
  sync_mode: two-way-resolved
  ignore:
    - node_modules
    - venv
    - __pycache__
    - dist
    - build
    - .next

projects:
  my-app:
    remote: work
  side-project:
    remote: personal
```

---

## 5. Design Decisions

### Why TypeScript with Bun?

- Familiar language, excellent CLI libraries
- Async/await maps well to SSH and file operations
- Can share code with future GUI (Electron/web)
- NPM distribution is straightforward
- Bun provides fast execution and built-in bundling

### Why Bundle Mutagen?

- No manual installation step for users
- Version consistency across installations
- Can update mutagen independently of user's system
- Single binary, small download (~15MB)

### Why Sync .git?

- Full history available on all machines
- Branches work naturally across machines
- No separate git clone step needed
- Lock system prevents concurrent git operations
- Only exclude lock files to prevent corruption

### Why Lock-Based Multi-Computer?

- Prevents accidental concurrent edits
- Clear ownership model
- Handoff (now part of `down`) ensures sync completion
- Better than last-write-wins for important work
- Can force-override if needed

### Why Local-First Instead of Remote-First?

- Zero latency for editing and running tools
- Claude Code works at full speed
- Works offline
- Background sync is transparent
- Remote is backup and sync target, not primary workspace

### Why Merge Handoff into Down?

The original spec had a separate `devbox handoff` command. This was merged into `devbox down` because:
- Simpler mental model (down = stop working)
- `down` now flushes sync and releases lock automatically
- Reduces command surface area
- Most users want both actions together

---

## 6. Remaining Work

### Code TODOs

| File | Line | Description | Priority | Status |
|------|------|-------------|----------|--------|
| `src/commands/shell.ts` | 43 | Integrate lock checking before shell access | Low | Done |
| `src/lib/projectTemplates.ts` | 7 | Replace placeholder template repo URLs | Medium | Documented |

### Minor Improvements

- [x] Add lock status check in `shell` command (currently bypassed)
- [ ] Create actual template repositories or remove template feature
- [x] Add `--force` flag to `shell` to bypass lock check

### Documentation Updates

- [x] Update CHANGELOG.md for v0.5.x changes (remote, config commands)
- [ ] Review and update VitePress docs for accuracy
- [x] Add troubleshooting section to docs

---

## 7. Future Features

### High Priority

| Feature | Description |
|---------|-------------|
| Status Dashboard (TUI) | Full-screen terminal UI with real-time sync status, container resources, one-key actions |
| Selective Sync | Sync specific subdirectories for large monorepos |
| Hooks System | Pre/post sync and container start hooks for custom workflows |

### Medium Priority

| Feature | Description |
|---------|-------------|
| Offline Mode | Explicit offline/online toggle with queued changes |
| Snapshots/Backups | Point-in-time recovery on remote server |
| Sync Profiles | Named sync configurations (minimal, full, custom) |
| Logs & Debugging | `devbox logs` for container and sync logs |
| Auto-Up on Directory Enter | Shell hook to auto-start container when entering project |

### Lower Priority / Exploratory

| Feature | Description |
|---------|-------------|
| GUI / Menu Bar App | System tray with sync status, notifications, quick actions |
| Team Features | Shared configs, project permissions, team remotes |
| Resource Limits | CPU/memory constraints per project |
| Custom Sync Engine | Replace Mutagen with custom implementation |
| Cloud Storage Backend | S3/GCS/B2 as sync target instead of SSH |
| Encrypted Sync | End-to-end encryption for sensitive projects |
| Metrics/Analytics | Usage statistics and productivity insights (local-only) |

---

## 8. Suggested Improvements

Based on the codebase review, here are recommended improvements:

### High Impact

| Improvement | Description | Complexity |
|-------------|-------------|------------|
| **Health Check Command** | `devbox doctor` to diagnose common issues (Docker, SSH, Mutagen status) | Low |
| **Sync Status in Prompt** | Shell integration to show sync status in terminal prompt | Low |
| **Project Aliases** | Allow short aliases for frequently used projects | Low |
| **Batch Operations** | `devbox up --all` to start multiple projects | Medium |
| **Update Command** | `devbox update` to update Mutagen binary and check for CLI updates | Medium |
| **Export/Import Config** | Share config between machines easily | Low |

### Developer Experience

| Improvement | Description | Complexity |
|-------------|-------------|------------|
| **Verbose Mode** | Global `--verbose` flag for debugging | Low |
| **Dry Run Mode** | `--dry-run` to preview what commands will do | Medium |
| **JSON Output** | `--json` flag for scriptable output | Medium |
| **Completion Scripts** | Shell completions for bash/zsh/fish | Low |
| **Watch Mode** | `devbox status --watch` for real-time updates | Medium |

### Reliability

| Improvement | Description | Complexity |
|-------------|-------------|------------|
| **Graceful Degradation** | Better handling when Docker/SSH is unavailable | Medium |
| **Retry Logic** | Automatic retry for transient network failures | Medium |
| **Stale Lock Detection** | Auto-detect and offer to clear locks from crashed sessions | Medium |
| **Sync Conflict Resolution** | Better UI for handling sync conflicts | High |

### Performance

| Improvement | Description | Complexity |
|-------------|-------------|------------|
| **Lazy Config Loading** | Only load config when needed | Low |
| **Parallel Operations** | Start multiple containers in parallel | Medium |
| **Incremental Sync Status** | Cache sync status to avoid repeated Mutagen calls | Medium |

### Security

| Improvement | Description | Complexity |
|-------------|-------------|------------|
| **SSH Key Rotation** | Helper to rotate SSH keys | Medium |
| **Audit Log** | Track who accessed what project and when | Medium |
| **Secret Detection** | Warn if syncing files that look like secrets | Medium |

---

## 9. Pre-Production Checklist

### Code Quality

- [x] Run full test suite: `bun test`
- [x] Type check passes: `bun run typecheck`
- [x] Linting passes: `bun run lint`
- [x] Format check: `bun run format`
- [x] No console.log statements in production code
- [x] Error messages are user-friendly
- [x] Pre-commit hooks configured (Lefthook)

### Feature Completion

- [x] All 14 commands implemented and working
- [x] Multi-remote support functional
- [x] Lock system prevents conflicts
- [x] Sync works bidirectionally
- [x] Editor integration works
- [x] Devcontainer templates available

### Testing

- [ ] Fresh install on new machine (no prior config)
- [ ] Test with password-protected SSH server
- [ ] Test with existing key auth
- [ ] Push new local project to empty remote
- [ ] Clone existing remote project
- [ ] Test with project without devcontainer config
- [ ] Test with custom devcontainer config
- [ ] Test with large project (1GB+)
- [ ] Git operations: commit, branch, checkout
- [ ] Work offline for 30 min, reconnect
- [ ] Test lock takeover between two computers
- [ ] Multiple projects running simultaneously
- [ ] macOS (Intel and ARM)
- [ ] Linux (Ubuntu, Debian)

### Documentation

- [x] README.md is accurate
- [x] VitePress documentation site built
- [ ] Installation instructions tested on clean machine
- [ ] All commands documented with examples
- [ ] Configuration options documented
- [x] Troubleshooting section added

### Repository Cleanup

- [x] Remove `SPEC.md` (consolidated into PROJECT.md)
- [x] Remove `REMAINING-WORK.md` (consolidated into PROJECT.md)
- [x] Move `design/plans/` to archive or remove
- [x] Move `plans/` to archive or remove
- [ ] Clean up worktrees after merging
- [x] Update package.json repository URL
- [x] Verify LICENSE file

### Release Preparation

- [x] Version number set (0.5.1-beta)
- [x] CHANGELOG.md maintained
- [x] CI/CD pipeline configured
- [x] Binary distribution setup (GitHub releases)
- [ ] npm registry publication configured
- [ ] Homebrew formula updated

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

---

*Last updated: 2026-01-25*
