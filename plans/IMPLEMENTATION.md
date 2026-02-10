# SkyBox - Implementation Tracker

> **Version:** 0.8.0
>
> **Progress:** 2/19 future features | 0/18 checklist items | 1/1 release tasks
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

- [x] ### Create Template Repositories *(Completed in v0.8.0)*

Built-in templates (Node.js, Bun, Python, Go) reference non-existent GitHub repos at `skybox-templates/*-starter`. Either create these repos or replace with working alternatives (e.g., official devcontainer templates).

- **Files:** `src/lib/projectTemplates.ts` (placeholder URLs)
- **Notes:** Could use official `devcontainers/templates` or create minimal starter repos under a SkyBox GitHub org

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

Short aliases for frequently used projects (e.g., `skybox up web` instead of `skybox up my-company-web-frontend`).

- **Files:** `src/types/index.ts` (add `aliases` to config), `src/lib/project.ts` (resolve aliases)
- **Notes:** Stored in config.yaml under `aliases` section

- [ ] ### Backup & Restore (Export/Import)

`skybox export` / `skybox import <file>` — Export all SkyBox settings to a password-protected encrypted file for machine migration. Backs up config.yaml (remotes, projects, defaults, editor, encryption settings) and custom templates. On a new machine, `skybox import` restores everything so you can immediately `skybox clone` your projects.

- **Files:** New `src/commands/export.ts`, `src/commands/import.ts`, `src/lib/backup.ts`
- **Dependencies:** None (uses existing AES-256-GCM + Argon2 from `src/lib/encryption.ts`)
- **Notes:** Output is encrypted JSON (e.g., `skybox-backup-2026-02-09.json.enc`). Excludes ephemeral data (Mutagen binary, logs, local project files). Import validates config schema before writing and warns if config already exists. Full plan: [`plans/export-import.md`](export-import.md)

- [ ] ### Git Worktree Support

Allow multiple worktrees of the same repo to operate as related SkyBox projects with independent containers and sync sessions.

- **Files:** `src/lib/paths.ts`, `src/lib/project.ts`, `src/lib/container.ts`, `src/lib/mutagen.ts`, `src/lib/session.ts`, `src/lib/sync-session.ts`, `src/commands/up.ts`, `src/types/index.ts`
- **Config:** Add optional `local_path` to project config; support worktree-aware session naming
- **Notes:** Requires decoupling project identity from filesystem path. Current architecture hardcodes `~/.skybox/Projects/<name>` as the single source of truth for local path, Mutagen session name, container label lookup, and session file location. Key changes: (1) add custom Docker label instead of relying on `devcontainer.local_folder` path matching, (2) support multiple Mutagen sessions per logical project (e.g., `skybox-myapp-main`, `skybox-myapp-feature`), (3) move session files out of synced directory to `~/.skybox/sessions/`, (4) make `resolveProjectFromCwd()` config-aware instead of purely path-based. ~15 files affected.

- [ ] ### Encryption Migration & Legacy Deprecation

- [ ] Add `skybox encrypt migrate` subcommand to re-encrypt data with current Argon2 parameters
- [ ] Deprecate legacy Argon2 fallback in v0.9.0

- **Files:** New `src/commands/encrypt.ts`, `src/lib/encryption.ts`
- **Notes:** Legacy Argon2 parameters (time=2, parallelism=1) were hardened in v0.7.7 (time=3, parallelism=4). Migration subcommand should re-derive keys with current OWASP-compliant parameters. Remove fallback path after deprecation period.

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

- [x] ### Dry Run Mode *(Completed in v0.8.0)*

`--dry-run` flag to preview commands without executing them.

- [ ] ### JSON Output

`--json` flag for scriptable/machine-readable output.

- **Files:** `src/index.ts` (global option), `src/lib/ui.ts` (output formatter)
- **Notes:** Suppress human-readable output; emit structured JSON

- [ ] ### Shell Completions

bash/zsh/fish completion scripts for all commands and options.

- **Files:** New `src/lib/completions.ts` or use Commander.js built-in support
- **Notes:** Commander.js has basic completion support; may need custom logic for project names

- [ ] ### Watch Mode

`skybox status --watch` for real-time status updates.

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
- [ ] Test lock takeover between two computers
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

- [x] Homebrew formula updated

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

*Last updated: 2026-02-09*
