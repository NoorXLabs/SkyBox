# DevBox - Remaining Work & Pre-Production Checklist

This document consolidates all TODOs, incomplete features, future work, and housekeeping tasks.

---

## Table of Contents

1. [Implementation Work](#1-implementation-work)
2. [Code TODOs](#2-code-todos)
3. [Future Features](#3-future-features)
4. [Housekeeping & Cleanup](#4-housekeeping--cleanup)
5. [Pre-Production Checklist](#5-pre-production-checklist)

---

## 1. Implementation Work

### Missing Commands

| Command | Status | Design Doc | Notes |
|---------|--------|------------|-------|
| `devbox shell` | Not implemented | `docs/plans/2026-01-22-shell-command-design.md` | Worktree exists at `.worktrees/shell-command/` |
| `devbox new` | Not implemented | `docs/plans/2026-01-22-new-command-design.md` | Worktree exists at `.worktrees/new-command/` |
| `devbox config` | Not implemented | SPEC.md lines 327-333 | View/edit/manage configuration |
| `devbox handoff` | Not implemented | SPEC.md lines 221-244 | Release lock with sync flush (may be handled by `down` instead) |

### Incomplete Features

| Feature | Location | Issue |
|---------|----------|-------|
| Lock status in status command | `src/commands/status.ts:487` | Shows "unavailable" when config not loaded |

### Active Worktrees (In Progress)

| Worktree | Purpose | Status |
|----------|---------|--------|
| `.worktrees/docs/` | VitePress documentation site | In development |
| `.worktrees/shell-command/` | `devbox shell` implementation | In development |
| `.worktrees/new-command/` | `devbox new` implementation | In development |

---

## 2. Code TODOs

### In Source Code

| File | Line | Description |
|------|------|-------------|
| *(none)* | - | - |

### In Planning Documents (Resolved)

The following TODOs existed in planning docs but have been implemented:

- `docs/plans/2026-01-22-status-command-implementation.md:139` - Overview table (now in `src/commands/status.ts:309-370`)
- `docs/plans/2026-01-22-status-command-implementation.md:152` - Detailed view (now in `src/commands/status.ts:422-508`)

---

## 3. Future Features

From `SPEC.md` lines 528-645 (Nice-to-Haves / Exploratory):

### Infrastructure & Scaling

| Feature | Description |
|---------|-------------|
| Multiple remote server support | Manage projects across different servers |
| Cloud storage backend | Alternative to Mutagen for sync |
| Custom sync engine | Build own sync solution |

### User Experience

| Feature | Description |
|---------|-------------|
| Status dashboard/TUI | Real-time terminal UI for monitoring |
| GUI/menu bar app | Native desktop application |
| Auto-up on directory enter | Automatically start container when entering project directory |

### Project Management

| Feature | Description |
|---------|-------------|
| Init projects on remote | Create new projects directly on server |
| Container templates | Predefined dev environment configurations |
| Selective sync | Choose specific files/folders to sync |
| Sync profiles | Named sync configurations |

### Reliability & Recovery

| Feature | Description |
|---------|-------------|
| Snapshots/backups | Point-in-time recovery |
| Offline mode | Work without network connectivity |
| Encrypted sync | End-to-end encryption for file transfer |

### Developer Experience

| Feature | Description |
|---------|-------------|
| Pre/post hooks | Custom scripts before/after commands |
| Logs and debugging | Enhanced logging and troubleshooting |
| Metrics/analytics | Usage statistics and performance data |

### Team Features

| Feature | Description |
|---------|-------------|
| Team collaboration | Shared projects and configurations |
| Resource limits | CPU/memory constraints per project |

---

## 4. Housekeeping & Cleanup

### Files to Remove Before Production

| File/Directory | Reason |
|----------------|--------|
| `SPEC.md` | Internal specification - move to design/ or remove |
| `docs/plans/` | Planning documents - move to design/ or remove |
| `REMAINING-WORK.md` | This file - remove after tasks complete |

### Recommended Cleanup Actions

1. **Move planning docs out of docs/**
   ```
   mkdir -p design/plans
   mv docs/plans/* design/plans/
   mv SPEC.md design/
   ```

2. **Clean up worktrees after merging**
   ```
   git worktree remove .worktrees/docs
   git worktree remove .worktrees/shell-command
   git worktree remove .worktrees/new-command
   ```

3. **Update .gitignore**
   - Ensure `design/` or planning directories are handled appropriately
   - Review if any dev-only files should be excluded

4. **Documentation site**
   - Implement VitePress site per `docs/plans/2026-01-22-documentation-design.md`
   - Replace `docs/plans/` with actual user documentation

---

## 5. Pre-Production Checklist

### Code Quality

- [ ] Run full test suite: `bun test`
- [ ] Type check passes: `bun run typecheck`
- [ ] Linting passes: `bun run lint`
- [ ] Format check: `bun run format`
- [ ] No console.log statements in production code
- [ ] Error messages are user-friendly

### Feature Completion

- [ ] All implemented commands work end-to-end
- [ ] `devbox init` - setup wizard works
- [ ] `devbox browse` - lists remote projects
- [ ] `devbox list` - lists local projects
- [ ] `devbox clone` - clones from remote
- [ ] `devbox push` - pushes to remote
- [ ] `devbox up` - starts container with lock
- [ ] `devbox down` - stops container, releases lock
- [ ] `devbox status` - shows project status
- [ ] `devbox editor` - configures editor
- [ ] `devbox rm` - removes local project

### Missing Commands Decision

- [ ] Decide: Implement `shell` command or defer?
- [ ] Decide: Implement `new` command or defer?
- [ ] Decide: Implement `config` command or defer?
- [ ] Decide: Implement `handoff` or merge into `down`?

### Documentation

- [ ] README.md is accurate and complete
- [ ] Installation instructions tested
- [ ] All commands documented with examples
- [ ] Configuration options documented
- [ ] Troubleshooting section added

### Repository Cleanup

- [ ] Remove or relocate `SPEC.md`
- [ ] Remove or relocate `docs/plans/`
- [ ] Remove this file (`REMAINING-WORK.md`)
- [ ] Clean up merged worktrees
- [ ] Review and update LICENSE if needed
- [ ] Verify package.json metadata (name, version, description, repository)

### Release Preparation

- [ ] Version number set appropriately
- [ ] CHANGELOG.md created (if desired)
- [ ] npm/package registry setup (if publishing)
- [ ] CI/CD pipeline configured (if using)
- [ ] Binary distribution setup (if distributing executables)

---

## Command Implementation Status Summary

| Command | Status | Priority |
|---------|--------|----------|
| `init` | ✅ Complete | - |
| `browse` | ✅ Complete | - |
| `list` | ✅ Complete | - |
| `clone` | ✅ Complete | - |
| `push` | ✅ Complete | - |
| `up` | ✅ Complete | - |
| `down` | ✅ Complete | - |
| `status` | ✅ Complete | - |
| `editor` | ✅ Complete | - |
| `rm` | ✅ Complete | - |
| `shell` | ❌ Not started | High |
| `new` | ❌ Not started | Medium |
| `config` | ❌ Not started | Low |
| `handoff` | ❌ Not started | Low (may not be needed) |

---

*Last updated: 2026-01-23*
