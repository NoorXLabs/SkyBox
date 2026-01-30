# DevBox - Implementation Tracker

> **Version:** 0.6.0-beta
>
> **Progress:** 0/21 future features | 0/18 checklist items | 0/2 release tasks
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

- [ ] ### Status Dashboard (TUI)

Full-screen terminal UI with real-time sync status, container resources, and one-key actions.

- **Files:** New `src/commands/dashboard.ts` or extend `src/commands/status.ts`
- **Dependencies:** TUI library (e.g., `blessed`, `ink`, or `terminal-kit`)
- **Notes:** Should show all running projects, sync health, container CPU/memory

- [ ] ### Hooks System

Pre/post sync and container start hooks for custom workflows (e.g., run migrations after sync, build assets before push).

- **Files:** New `src/lib/hooks.ts`, integration points in `src/commands/up.ts`, `src/commands/down.ts`, `src/lib/mutagen.ts`
- **Config:** Add `hooks` section to project config in `src/types/index.ts`
- **Notes:** Support shell commands and script paths; run in container or host context

- [ ] ### Version Update Notification

After any command completes, show a one-line footer if a newer DevBox version is available. Checks GitHub Releases API once per day (cached to `~/.devbox/.update-check.json`). Channel-aware: stable users see stable releases only; beta users see all releases.

- **Files:** New `src/lib/update-check.ts` (`checkForUpdate()`, `displayUpdateNotice()`)
- **Integration:** End of main CLI flow in `src/index.ts`
- **Display:** `Update available: 0.6.0-beta → 0.7.0. Run <install-specific-command> to update.`
- **Notes:** Depends on Install Method Detection for correct upgrade command

- [ ] ### Install Method Detection

Embed `INSTALL_METHOD` constant at build time (`homebrew`, `github-release`, `npm`, `source`). CI sets `DEVBOX_INSTALL_METHOD` env var per distribution channel. Used by update notification to show the correct upgrade command.

- **Files:** `src/lib/constants.ts` (new `INSTALL_METHOD` constant)
- **CI:** `.github/workflows/release.yml` sets env var per build target
- **Notes:** Prerequisite for Version Update Notification

- [ ] ### Custom Local Templates

Local devcontainer.json files stored in `~/.devbox/templates/` as reusable templates. Filename becomes display name (e.g., `bun.json` → "bun"). Unified shared `selectTemplate()` component replaces fragmented template logic across commands. Includes CLI flow to scaffold new templates with required fields, edit options (editor/terminal/skip), and validation (must have `workspaceFolder`/`workspaceMount`).

- **Design:** [`plans/2026-01-30-custom-local-templates-design.md`](2026-01-30-custom-local-templates-design.md)
- **Files:** `src/lib/templates.ts`, `src/types/index.ts`, `src/commands/new.ts`, `src/commands/up.ts`, `src/commands/clone.ts`, `src/commands/config-devcontainer.ts`
- **Notes:** Also unifies built-in templates into `devbox new` which currently only supports git URLs

- [ ] ### Bundle Mutagen with DevBox

Embed platform-specific Mutagen binary inside the compiled DevBox binary. On first run (or after DevBox update), extract to `~/.devbox/bin/mutagen` if missing or version mismatch. Pinned version in `MUTAGEN_VERSION` constant ensures all users run the exact tested version.

- **Files:** New `src/lib/mutagen-extract.ts` (`ensureMutagenExtracted()`)
- **Build:** `vendor/mutagen/` directory or CI download step, Bun `--compile` asset embedding
- **Removes:** `downloadMutagen()` from end-user flow; `devbox update` repurposed or removed
- **Notes:** Binary size increases ~15-20MB per platform

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

- [ ] ### Auto-Up on Directory Enter

Shell hook (bash/zsh) to auto-start container when entering a project directory.

- **Files:** New `src/commands/hook.ts` or shell script generator
- **Notes:** Generate shell function that wraps `cd`; check if directory is a DevBox project

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
- [ ] **Cloud Storage Backend:** S3/GCS/B2 as alternative to SSH remotes
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

*Last updated: 2026-01-30*
