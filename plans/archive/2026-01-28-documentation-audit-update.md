# Documentation Audit & Update Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit all VitePress documentation against the current codebase, fix outdated content, add missing pages/features, and ensure install instructions include the Homebrew tap method.

**Architecture:** Systematic file-by-file audit comparing docs/ content against src/ source of truth. Each task updates one logical section. No code changes—docs only.

**Tech Stack:** VitePress (Markdown), TypeScript (read-only for reference)

---

## Identified Gaps Summary

| # | Gap | Severity |
|---|-----|----------|
| 1 | No Homebrew tap install method in `installation.md` | High |
| 2 | Missing `logs` command reference page | High |
| 3 | Missing `update` command reference page | High |
| 4 | Sidebar missing `doctor`, `open`, `logs`, `update` entries | High |
| 5 | Reference index missing `logs` and `update` commands | High |
| 6 | `config` reference page missing subcommands: `sync-paths`, `encryption enable/disable`, `devcontainer edit/reset` | High |
| 7 | `rm` reference page missing `--remote` flag and interactive multi-select behavior | High |
| 8 | `up` reference page missing `--all`, `--verbose`, `--rebuild`, `--attach` flags | High |
| 9 | `down` reference page missing `--all` flag | High |
| 10 | No documentation for selective sync (`sync_paths`) feature | High |
| 11 | No documentation for encryption feature (AES-256-GCM config toggle) | High |
| 12 | No documentation for devcontainer repair (`config devcontainer edit/reset`) | High |
| 13 | No documentation for batch operations (`--all` on `up`/`down`) | Medium |
| 14 | No documentation for lock takeover behavior | Medium |
| 15 | No documentation for non-interactive mode (`--no-prompt`) | Medium |
| 16 | No documentation for built-in devcontainer templates | Medium |
| 17 | Version shown as `0.1.0` in installation verify section | Medium |
| 18 | `CLAUDE.md` says version 0.5.1-beta but `package.json` is 0.6.0-beta | Medium |
| 19 | GitHub repo URL inconsistency (`NoorXLabs` vs `NoorChasib`) | Medium |
| 20 | Architecture/codebase docs missing new files (`encryption.ts`, `validation.ts`, `logs.ts`, `update.ts`, `open.ts`, `doctor.ts`, `config-devcontainer.ts`) | Medium |
| 21 | Configuration reference page missing `encryption`, `sync_paths`, per-project `editor` fields | Medium |
| 22 | `shell` reference page missing `--force` lock bypass and lock check behavior | Medium |
| 23 | Troubleshooting page may not cover new features (encryption, selective sync, batch ops) | Low |
| 24 | `SKYBOX_HOME` environment variable not documented in user docs | Low |

---

### Task 1: Update Installation Page — Add Homebrew Tap & Fix Version

**Files:**
- Modify: `docs/guide/installation.md`

**Step 1: Update the Install SkyBox section**

Replace the "Install SkyBox" section with two methods—Homebrew (recommended) and source:

```markdown
## Install SkyBox

::: code-group

```bash [Homebrew (macOS)]
brew tap NoorXLabs/homebrew-tap
brew install skybox
```

```bash [From Source (macOS/Linux)]
git clone https://github.com/NoorXLabs/SkyBox.git
cd SkyBox
bun install
bun link
```

:::
```

**Step 2: Fix the version output in Verify Installation**

Change the example output from `0.1.0` to a generic message like "You should see the current version number" to avoid future staleness.

**Step 3: Commit**

```bash
git add docs/guide/installation.md
git commit -m "docs: add Homebrew tap install method and fix version in installation guide"
```

---

### Task 2: Create `logs` Command Reference Page

**Files:**
- Create: `docs/reference/logs.md`
- Read: `src/commands/logs.ts` (for accuracy)

**Step 1: Read the source for accurate flags**

Read `src/commands/logs.ts` to get exact arguments, options, and behavior.

**Step 2: Create the reference page**

Include: usage, arguments (`<project>` required), options (`-f`, `-n`, `-s`), two modes (container logs via `docker logs`, sync logs via `mutagen sync monitor`), examples for each mode.

**Step 3: Commit**

```bash
git add docs/reference/logs.md
git commit -m "docs: add logs command reference page"
```

---

### Task 3: Create `update` Command Reference Page

**Files:**
- Create: `docs/reference/update.md`
- Read: `src/commands/update.ts` (for accuracy)

**Step 1: Read the source for accurate behavior**

Read `src/commands/update.ts` to get exact behavior (shows current version, target version, downloads if outdated).

**Step 2: Create the reference page**

Include: usage, description, behavior (version comparison, download), examples.

**Step 3: Commit**

```bash
git add docs/reference/update.md
git commit -m "docs: add update command reference page"
```

---

### Task 4: Update Reference Index — Add Missing Commands & Sections

**Files:**
- Modify: `docs/reference/index.md`

**Step 1: Add `logs` and `update` to the commands table**

Add these rows to the commands overview table:

```markdown
| [`skybox logs`](/reference/logs) | Show container or sync logs |
| [`skybox update`](/reference/update) | Update Mutagen binary |
```

**Step 2: Add "Diagnostics & Maintenance" quick reference section**

```markdown
### Diagnostics & Maintenance

```bash
# Show container logs
skybox logs my-project -f

# Show sync logs
skybox logs my-project --sync

# Diagnose common issues
skybox doctor

# Update Mutagen binary
skybox update
```
```

**Step 3: Add "Batch Operations" quick reference section**

```markdown
### Batch Operations

```bash
# Start all projects
skybox up --all

# Stop all projects
skybox down --all

# Remove multiple projects (interactive multi-select)
skybox rm
```
```

**Step 4: Commit**

```bash
git add docs/reference/index.md
git commit -m "docs: add logs, update, batch operations to reference index"
```

---

### Task 5: Update VitePress Sidebar — Add Missing Command Entries

**Files:**
- Modify: `docs/.vitepress/config.ts`

**Step 1: Add missing sidebar entries to `/reference/` items array**

After the `skybox remote` entry, add:

```typescript
{ text: 'skybox doctor', link: '/reference/doctor' },
{ text: 'skybox open', link: '/reference/open' },
{ text: 'skybox logs', link: '/reference/logs' },
{ text: 'skybox update', link: '/reference/update' },
```

**Step 2: Commit**

```bash
git add docs/.vitepress/config.ts
git commit -m "docs: add doctor, open, logs, update to sidebar navigation"
```

---

### Task 6: Update `config` Reference Page — Add All Subcommands

**Files:**
- Modify: `docs/reference/config.md`
- Read: `src/commands/config.ts` and `src/commands/config-devcontainer.ts` (for accuracy)

**Step 1: Read the source files**

Read both config command files to get exact subcommand syntax and behavior.

**Step 2: Ensure all subcommands are documented**

The config page must document ALL of these subcommands:

- `config` (no args) — show current config
- `config set <key> <value>` — set config value (currently only `editor`)
- `config --validate` — test SSH connections to all remotes
- `config sync-paths <project> [path1,path2,...]` — view/set selective sync paths
- `config encryption enable` — enable AES-256-GCM config encryption with passphrase
- `config encryption disable` — disable encryption
- `config devcontainer edit <project>` — open devcontainer.json in editor, push to remote after save
- `config devcontainer reset <project>` — reset devcontainer.json from template, push to remote

**Step 3: Add examples for each subcommand**

```markdown
# View selective sync paths
skybox config sync-paths my-project

# Set selective sync paths (comma-separated)
skybox config sync-paths my-project src,build,config

# Enable encryption
skybox config encryption enable

# Edit devcontainer configuration
skybox config devcontainer edit my-project

# Reset devcontainer to template
skybox config devcontainer reset my-project
```

**Step 4: Commit**

```bash
git add docs/reference/config.md
git commit -m "docs: add sync-paths, encryption, devcontainer subcommands to config reference"
```

---

### Task 7: Update `rm` Reference Page — Add Remote Delete & Multi-Select

**Files:**
- Modify: `docs/reference/rm.md`
- Read: `src/commands/rm.ts` (for accuracy)

**Step 1: Read source for exact behavior**

Read `src/commands/rm.ts` to confirm multi-select behavior and `--remote` flag.

**Step 2: Document new features**

Add:
- `-r, --remote` flag: Also deletes project from remote server (double confirmation required)
- Interactive multi-select: When run without project argument, shows checkbox list for selecting multiple projects to remove
- Double confirmation for destructive actions (local file deletion, remote deletion)

**Step 3: Add examples**

```markdown
# Interactive multi-select (no args)
skybox rm

# Remove with remote deletion
skybox rm my-project --remote

# Force remove without confirmation
skybox rm my-project --force
```

**Step 4: Commit**

```bash
git add docs/reference/rm.md
git commit -m "docs: add remote delete and multi-select to rm reference"
```

---

### Task 8: Update `up` Reference Page — Add All Missing Flags

**Files:**
- Modify: `docs/reference/up.md`
- Read: `src/commands/up.ts` (for accuracy)

**Step 1: Read source for exact flags**

Read `src/commands/up.ts` to confirm all options.

**Step 2: Ensure all options are documented**

- `-e, --editor` — open in editor after start
- `-a, --attach` — attach to shell after start
- `-r, --rebuild` — force container rebuild
- `--no-prompt` — non-interactive mode (errors instead of prompting)
- `--verbose` — show detailed error output
- `-A, --all` — start all local projects (batch mode, tallies success/failure)

**Step 3: Document key behaviors**

- Lock acquisition flow (with takeover prompt if locked by another machine)
- Sync resume if paused
- Container auto-rebuild on failure
- Post-start action prompt (editor/shell/both)
- Editor preference saving
- Project auto-detection from current directory

**Step 4: Commit**

```bash
git add docs/reference/up.md
git commit -m "docs: add all flags and lock/batch behavior to up reference"
```

---

### Task 9: Update `down` Reference Page — Add `--all` Flag

**Files:**
- Modify: `docs/reference/down.md`
- Read: `src/commands/down.ts` (for accuracy)

**Step 1: Read source for exact flags**

Read `src/commands/down.ts` to confirm all options.

**Step 2: Ensure all options are documented**

- `-c, --cleanup` — remove container and volumes
- `-f, --force` — force stop even on errors
- `--no-prompt` — non-interactive mode
- `-A, --all` — stop all local projects (batch mode)

**Step 3: Document key behaviors**

- Sync flush before stopping (waits for pending changes)
- Lock release
- Optional local file removal (double confirmation)
- Sync pause if not cleaning up

**Step 4: Commit**

```bash
git add docs/reference/down.md
git commit -m "docs: add --all flag and sync/lock behavior to down reference"
```

---

### Task 10: Update `shell` Reference Page — Add Lock Behavior & Force Flag

**Files:**
- Modify: `docs/reference/shell.md`
- Read: `src/commands/shell.ts` (for accuracy)

**Step 1: Read source to confirm behavior**

**Step 2: Document lock check behavior**

- Shell checks lock status before entry
- Errors if locked by another machine (safety feature)
- Warns if no lock held
- `-f, --force` bypasses lock check

**Step 3: Document auto-start behavior**

Container auto-starts if not running when shell is entered.

**Step 4: Commit**

```bash
git add docs/reference/shell.md
git commit -m "docs: add lock behavior and force flag to shell reference"
```

---

### Task 11: Update Configuration Reference — Add Full Schema

**Files:**
- Modify: `docs/reference/configuration.md`
- Read: `src/types/index.ts` (for exact schema)

**Step 1: Read the types file**

Read `src/types/index.ts` to get the complete config schema including all fields.

**Step 2: Ensure the configuration reference documents ALL fields**

Missing fields to add:
- `encryption.enabled` (boolean) — toggle AES-256-GCM encryption
- `encryption.salt` (string, hex) — auto-generated salt
- `projects.<name>.sync_paths` (string[]) — selective sync paths per project
- `projects.<name>.editor` (string) — per-project editor override
- `remotes.<name>.key` (string) — SSH key path per remote

**Step 3: Add a complete example config showing all fields**

```yaml
editor: cursor

defaults:
  sync_mode: two-way-resolved
  ignore:
    - .git/index.lock
    - node_modules

encryption:
  enabled: true
  salt: "a1b2c3d4..."

remotes:
  work:
    host: work-server
    user: deploy
    path: ~/code
    key: ~/.ssh/work_key

projects:
  my-app:
    remote: work
    editor: vim
    sync_paths:
      - src
      - build
    ignore:
      - custom-pattern
```

**Step 4: Document default ignore patterns**

List all default ignore patterns from `src/types/index.ts` (`DEFAULT_IGNORE`).

**Step 5: Commit**

```bash
git add docs/reference/configuration.md
git commit -m "docs: add encryption, sync_paths, per-project editor to configuration reference"
```

---

### Task 12: Update Concepts Page — Add Selective Sync, Encryption, Templates

**Files:**
- Modify: `docs/guide/concepts.md`
- Read: `src/lib/encryption.ts`, `src/lib/mutagen.ts`, `src/lib/templates.ts` (for accuracy)

**Step 1: Read source files for feature details**

**Step 2: Add or update sections for:**

- **Selective Sync**: What it is, when to use it, how `sync_paths` creates per-path Mutagen sessions, configuration via `skybox config sync-paths`
- **Encryption**: AES-256-GCM with PBKDF2 key derivation, what it protects (config.yaml), how to enable/disable, passphrase recovery warning
- **Templates**: Built-in templates (Node.js, Python, Go, Generic), what each includes (image, features, post-create commands), custom git repo templates
- **Lock System**: Expand existing lock docs with takeover behavior, force bypass, multi-machine coordination details
- **Non-interactive Mode**: `--no-prompt` flag for scripting/CI use

**Step 3: Commit**

```bash
git add docs/guide/concepts.md
git commit -m "docs: add selective sync, encryption, templates, lock takeover to concepts"
```

---

### Task 13: Audit & Update All Remaining Command Reference Pages

**Files:**
- Read: All `docs/reference/*.md` files
- Read: Corresponding `src/commands/*.ts` files
- Modify: Any reference pages with outdated flags/options

**Step 1: Verify each existing page against source**

For each of these pages, compare documented arguments/options/behavior against source code:
- `init.md` — verify wizard steps match current init flow
- `clone.md` — verify selective sync mention if project has `sync_paths`
- `push.md` — verify auto-git-init behavior, remote selection
- `status.md` — verify all columns/fields in overview and detailed modes
- `browse.md` — verify branch display behavior
- `list.md` — verify output format
- `editor.md` — verify supported editor list
- `new.md` — verify template selection flow, custom git URL support
- `open.md` — verify options (`-e`, `-s`, `--no-prompt`), requires running container
- `doctor.md` — verify all diagnostic checks listed
- `remote.md` — verify all subcommands (add/list/remove/rename), `-k` flag

**Step 2: Update any pages with incorrect or missing information**

**Step 3: Commit**

```bash
git add docs/reference/
git commit -m "docs: audit and update all command reference pages against source"
```

---

### Task 14: Update Troubleshooting Page — Add New Feature Issues

**Files:**
- Modify: `docs/guide/troubleshooting.md`

**Step 1: Read current troubleshooting page**

Read `docs/guide/troubleshooting.md` to see what's covered.

**Step 2: Add troubleshooting sections for new features**

Ensure these are covered:
- **Encryption**: Forgotten passphrase (data loss warning), decryption errors
- **Selective Sync**: Sync path not syncing (check path format, no leading slash, no `..`)
- **Lock Issues**: Lock takeover failed, stale locks, force bypass
- **Batch Operations**: Partial failures in `--all` mode
- **Doctor Command**: Reference `skybox doctor` as first diagnostic step throughout
- **Update Command**: Mutagen download failures, version mismatches
- **Devcontainer Repair**: Container won't start → use `config devcontainer reset`

**Step 3: Commit**

```bash
git add docs/guide/troubleshooting.md
git commit -m "docs: add encryption, selective sync, lock troubleshooting sections"
```

---

### Task 15: Update Workflow Guides — Reflect New Features

**Files:**
- Modify: `docs/guide/workflows/new-project.md`
- Modify: `docs/guide/workflows/daily-development.md`
- Modify: `docs/guide/workflows/team-sharing.md`

**Step 1: Read all three workflow guides**

**Step 2: Update each guide to reflect current features**

- **New Project**: Mention template selection (built-in + custom git), `skybox new` full workflow
- **Daily Development**: Add `skybox open` as quick-access alternative to `up`, mention `skybox logs -f` for debugging, batch `--all` for multi-project workflows
- **Team Sharing**: Mention multi-remote support, selective sync for large repos, encryption for sensitive configs

**Step 3: Commit**

```bash
git add docs/guide/workflows/
git commit -m "docs: update workflow guides with new features (open, logs, batch, templates)"
```

---

### Task 16: Audit & Update Architecture Docs

**Files:**
- Modify: `docs/architecture/codebase.md`
- Modify: `docs/architecture/index.md`
- Modify: `docs/architecture/design-decisions.md`

**Step 1: Read all three architecture files**

**Step 2: Update codebase.md directory structure**

Add all new files:
- `src/commands/`: `logs.ts`, `update.ts`, `open.ts`, `doctor.ts`, `config-devcontainer.ts`
- `src/lib/`: `encryption.ts`, `validation.ts`

**Step 3: Update architecture overview if needed**

Check that component diagrams and data flow sequences reflect current architecture (encryption layer, validation, selective sync sessions).

**Step 4: Update design decisions if new rationale exists**

Add entries for encryption choice (AES-256-GCM), selective sync approach (per-path sessions), template system design.

**Step 5: Commit**

```bash
git add docs/architecture/
git commit -m "docs: update architecture docs with new modules and design decisions"
```

---

### Task 17: Document Environment Variables

**Files:**
- Modify: `docs/reference/configuration.md` (add section)

**Step 1: Add an Environment Variables section**

Document:
- `SKYBOX_HOME` — override default `~/.skybox` base directory
- `HOME` — used for `~` expansion in paths
- `EDITOR` — fallback editor if not configured in SkyBox

**Step 2: Commit**

```bash
git add docs/reference/configuration.md
git commit -m "docs: add environment variables section to configuration reference"
```

---

### Task 18: Update CLAUDE.md Version and Directory Structure

**Files:**
- Modify: `.claude/CLAUDE.md`

**Step 1: Update version from 0.5.1-beta to 0.6.0-beta**

**Step 2: Update directory structure listing**

Add missing files:
- `src/commands/`: `logs.ts`, `update.ts`, `open.ts`, `doctor.ts`, `config-devcontainer.ts`
- `src/lib/`: `encryption.ts`, `validation.ts`

**Step 3: Commit**

```bash
git add .claude/CLAUDE.md
git commit -m "docs: update CLAUDE.md version and directory structure"
```

---

### Task 19: Verify GitHub Repo URL Consistency

**Files:**
- Read: `package.json`, `docs/.vitepress/config.ts`, `README.md`, `docs/guide/installation.md`

**Step 1: Identify canonical GitHub URL**

`package.json` uses `NoorChasib/SkyBox`, VitePress config uses `NoorXLabs/SkyBox`. Determine which is correct by checking which org the Homebrew tap references (`NoorXLabs/homebrew-tap`).

**Step 2: Normalize all URLs to the canonical org**

Update any inconsistent references across all docs and config files.

**Step 3: Commit (if changes made)**

```bash
git add -A
git commit -m "docs: normalize GitHub repository URLs"
```

---

### Task 20: Update CHANGELOG for 0.6.0-beta

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Read current CHANGELOG and git log since 0.5.1-beta**

```bash
git log --oneline v0.5.1-beta..HEAD
```

(Or check git log for all commits since the 0.5.1-beta entry.)

**Step 2: Add 0.6.0-beta entry**

Document all new features:
- `skybox logs` command
- `skybox update` command
- `skybox doctor` command
- `skybox open` command
- Batch operations (`up --all`, `down --all`)
- Interactive multi-select in `rm`
- Remote delete (`rm --remote`)
- Selective sync (`config sync-paths`)
- Encryption support (`config encryption enable/disable`)
- Devcontainer repair (`config devcontainer edit/reset`)
- Input validation improvements
- Non-interactive mode (`--no-prompt`)
- Lock check in shell command

**Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add 0.6.0-beta changelog entry"
```

---

### Task 21: Final Review — Build Docs and Check for Broken Links

**Step 1: Build the VitePress site**

```bash
bun run docs:build
```

**Step 2: Check for build warnings or errors**

Look for broken links, missing pages, or build failures in the output.

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add docs/
git commit -m "docs: fix build warnings and broken links"
```
