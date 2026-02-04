# DevBox - Implementation Tracker

> **Version:** 0.7.7
>
> **Progress:** 0/17 future features | 0/18 checklist items | 0/2 release tasks
>
> **Completed work archived:** [`plans/archive/ARCHIVED-IMPLEMENTATION.md`](archive/ARCHIVED-IMPLEMENTATION.md)

---

## Table of Contents

1. [Future Features — High Priority](#future-features--high-priority)
2. [Future Features — Medium Priority](#future-features--medium-priority)
3. [Future Features — Lower Priority](#future-features--lower-priority)
4. [Future Features — Exploratory](#future-features--exploratory)
5. [Pre-Production Checklist](#pre-production-checklist)
6. [Release Preparation](#release-preparation)

---

## Future Features — High Priority

- [ ] ### Create Template Repositories

Built-in templates (Node.js, Bun, Python, Go) reference non-existent GitHub repos at `devbox-templates/*-starter`. Either create these repos or replace with working alternatives (e.g., official devcontainer templates).

- **Files:** `src/lib/projectTemplates.ts` (placeholder URLs)
- **Notes:** Could use official `devcontainers/templates` or create minimal starter repos under a DevBox GitHub org

---

## Future Features — Medium Priority

- [ ] ### Offline Mode

Explicit offline/online toggle with queued changes that sync when connectivity resumes.

- **Files:** New `src/lib/offline.ts`, modifications to `src/lib/mutagen.ts`
- **Notes:** Queue sync operations locally; replay on reconnect

- [ ] ### Snapshots/Backups

Point-in-time recovery on remote server. Snapshot project state before destructive operations.

- **Files:** New `src/commands/snapshot.ts`, `src/lib/snapshot.ts`
- **Notes:** Could use tar archives on remote, stored alongside project directory

- [ ] ### Sync Profiles

Named sync configurations (minimal, full, custom) for different workflows.

- **Files:** `src/types/index.ts` (new `SyncProfile` type), `src/lib/mutagen.ts`
- **Config:** Add `sync_profiles` to project config
- **Notes:** Useful for large repos where you only need a subset of files

- [ ] ### Project Aliases

Short aliases for frequently used projects (e.g., `devbox up web` instead of `devbox up my-company-web-frontend`).

- **Files:** `src/types/index.ts` (add `aliases` to config), `src/lib/project.ts` (resolve aliases)
- **Notes:** Stored in config.yaml under `aliases` section

- [ ] ### Export/Import Config

Share config between machines easily via encrypted export/import.

- **Files:** New `src/commands/export.ts`, `src/commands/import.ts`
- **Notes:** Export as encrypted JSON/YAML bundle; import with validation

---

## Future Features — Lower Priority

- [ ] ### GUI / Menu Bar App

System tray application with sync status, notifications, and quick actions.

- **Notes:** Electron or Tauri; communicates with CLI via IPC or config files

- [ ] ### Team Features

Shared configs, project permissions, team-level remotes.

- **Notes:** Requires server-side component or shared config repository

- [ ] ### Resource Limits

CPU/memory constraints per project container.

- **Files:** `src/lib/container.ts`, `src/types/index.ts` (add resource config)
- **Notes:** Pass `--cpus`, `--memory` flags to Docker

- [ ] ### Verbose Mode

Global `--verbose` flag for debugging output across all commands.

- **Files:** `src/index.ts` (global option), all command files
- **Notes:** Use environment variable or global flag; conditionally log debug info

- [ ] ### Dry Run Mode

`--dry-run` flag to preview commands without executing them.

- **Files:** `src/index.ts` (global option), command files
- **Notes:** Print commands that would be executed; useful for debugging

- [ ] ### JSON Output

`--json` flag for scriptable/machine-readable output.

- **Files:** `src/index.ts` (global option), `src/lib/ui.ts` (output formatter)
- **Notes:** Suppress human-readable output; emit structured JSON

- [ ] ### Shell Completions

bash/zsh/fish completion scripts for all commands and options.

- **Files:** New `src/lib/completions.ts` or use Commander.js built-in support
- **Notes:** Commander.js has basic completion support; may need custom logic for project names

- [ ] ### Watch Mode

`devbox status --watch` for real-time status updates.

- **Files:** `src/commands/status.ts`
- **Notes:** Poll Docker and Mutagen status on interval; clear and redraw

---

## Future Features — Exploratory

- [ ] **Custom Sync Engine:** Replace Mutagen with a purpose-built sync solution
- [ ] **Cloud Storage Backend:** Remote-to-S3 backups via rclone (not real-time sync — Mutagen requires an agent on both sides, which rules out object storage as a sync target)
- [ ] **Metrics/Analytics:** Local-only usage metrics for debugging and optimization

---

## Pre-Production Checklist

### Manual Testing

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
- [ ] Test session conflict between two computers
- [ ] Multiple projects running simultaneously
- [ ] macOS (Intel and ARM)
- [ ] Linux (Ubuntu, Debian)

### Documentation

- [ ] Installation instructions tested on clean machine
- [ ] All commands documented with examples
- [ ] Configuration options documented

### Repository Cleanup

- [ ] Clean up worktrees after merging

---

## Release Preparation

- [ ] npm registry publication configured
- [ ] Homebrew formula updated

---

## Feature Entry Template

Copy-paste this when adding a new future feature:

```markdown
- [ ] ### Feature Name

One-line description of what this feature does and why.

- **Files:** List of new/modified files
- **Config:** Config changes needed (if any)
- **Dependencies:** External packages needed (if any)
- **Notes:** Implementation considerations, trade-offs, or prerequisites
```

---

*Last updated: 2026-02-04*
