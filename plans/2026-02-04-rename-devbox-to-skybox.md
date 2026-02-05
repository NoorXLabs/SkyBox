# Rename SkyBox to SkyBox — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename every occurrence of "SkyBox" / "skybox" / "SKYBOX" to "SkyBox" / "skybox" / "SKYBOX" across the entire codebase — source, tests, docs, config, build, skills, and project identity.

**Architecture:** Mechanical case-ordered find-and-replace across 143 files (~1,800 occurrences). No logic changes. Directory renames via `git mv`. Verification via typecheck, tests, lint, and a final grep sweep.

**Tech Stack:** Bun (TypeScript), Commander.js, Biome, Lefthook, VitePress

---

## Case Mapping Reference

Every substitution follows this 1:1 map. **Order matters** — replace uppercase variants first to avoid clobbering.

| Order | Old | New | Context |
|-------|-----|-----|---------|
| 1 | `SKYBOX` | `SKYBOX` | Env vars (`SKYBOX_HOME`), shell vars (`_SKYBOX_PREV_DIR`), constants |
| 2 | `SkyBox` | `SkyBox` | Product name in UI text, comments, docs, GitHub URLs |
| 3 | `Skybox` | `Skybox` | TypeScript interfaces (`SkyboxConfig`), Homebrew class, mixed-case refs |
| 4 | `skybox` | `skybox` | CLI name, package name, paths, binary names, Mutagen sessions, everything else |

Additionally:
| Old | New | Context |
|-----|-----|---------|
| `bin/skybox` | `bin/skybox` | Bun entrypoint file (git mv) |
| `skybox-bin` | `skybox-bin` | Build output name in package.json scripts & .gitignore |
| `.skybox` | `.skybox` | Config directory name (`~/.skybox/` -> `~/.skybox/`) |
| `NoorXLabs/SkyBox` | `NoorXLabs/SkyBox` | GitHub repo URLs |

---

## Task 1: Rename skill directories (repo)

Rename the 4 `.claude/skills/skybox-*` directories using `git mv` so git tracks them as renames rather than delete+create.

**Files:**
- Rename: `.claude/skills/skybox-impl-cleanup/` -> `.claude/skills/skybox-impl-cleanup/`
- Rename: `.claude/skills/skybox-list-tasks/` -> `.claude/skills/skybox-list-tasks/`
- Rename: `.claude/skills/skybox-prep-release/` -> `.claude/skills/skybox-prep-release/`
- Rename: `.claude/skills/skybox-update-docs/` -> `.claude/skills/skybox-update-docs/`

**Step 1: Git mv each directory**

```bash
cd /Users/noorchasib/conductor/workspaces/SkyBox/las-vegas
git mv .claude/skills/skybox-impl-cleanup .claude/skills/skybox-impl-cleanup
git mv .claude/skills/skybox-list-tasks .claude/skills/skybox-list-tasks
git mv .claude/skills/skybox-prep-release .claude/skills/skybox-prep-release
git mv .claude/skills/skybox-update-docs .claude/skills/skybox-update-docs
```

**Step 2: Update the `name:` field inside each SKILL.md**

In each of the 4 renamed SKILL.md files, replace the `name:` line:
- `name: skybox-impl-cleanup` -> `name: skybox-impl-cleanup`
- `name: skybox-list-tasks` -> `name: skybox-list-tasks`
- `name: skybox-prep-release` -> `name: skybox-prep-release`
- `name: skybox-update-docs` -> `name: skybox-update-docs`

Also replace any `skybox`/`SkyBox` references in the skill body text.

**Step 3: Stage changes**

```bash
git add .claude/skills/
```

---

## Task 2: Rename bin/skybox entrypoint

**Files:**
- Rename: `bin/skybox` -> `bin/skybox`

**Step 1: Git mv the file**

```bash
git mv bin/skybox bin/skybox
```

The file content (`#!/usr/bin/env bun` + `import "../src/index.ts"`) does not change.

---

## Task 3: Rename local ~/.claude skills

These are outside the repo, on the user's machine.

**Files:**
- Rename: `~/.claude/skills/skybox-impl-cleanup/` -> `~/.claude/skills/skybox-impl-cleanup/`
- Rename: `~/.claude/skills/skybox-list-tasks/` -> `~/.claude/skills/skybox-list-tasks/`
- Rename: `~/.claude/skills/skybox-prep-release/` -> `~/.claude/skills/skybox-prep-release/`
- Rename: `~/.claude/skills/skybox-update-docs/` -> `~/.claude/skills/skybox-update-docs/`

**Step 1: Rename directories**

```bash
mv ~/.claude/skills/skybox-impl-cleanup ~/.claude/skills/skybox-impl-cleanup
mv ~/.claude/skills/skybox-list-tasks ~/.claude/skills/skybox-list-tasks
mv ~/.claude/skills/skybox-prep-release ~/.claude/skills/skybox-prep-release
mv ~/.claude/skills/skybox-update-docs ~/.claude/skills/skybox-update-docs
```

**Step 2: Update `name:` field and body text**

Same edits as Task 1 Step 2, but in the `~/.claude/skills/skybox-*/SKILL.md` files.

---

## Task 4: Update package.json

**Files:**
- Modify: `package.json`

**Step 1: Apply these exact changes**

| Line | Old | New |
|------|-----|-----|
| 2 | `"name": "skybox"` | `"name": "skybox"` |
| 7 | `"url": "git+https://github.com/NoorXLabs/SkyBox.git"` | `"url": "git+https://github.com/NoorXLabs/SkyBox.git"` |
| 10 | `"url": "https://github.com/NoorXLabs/SkyBox/issues"` | `"url": "https://github.com/NoorXLabs/SkyBox/issues"` |
| 12 | `"homepage": "https://github.com/NoorXLabs/SkyBox#readme"` | `"homepage": "https://github.com/NoorXLabs/SkyBox#readme"` |
| 13 | `"skybox"` in keywords array | `"skybox"` |
| 21 | `"skybox": "./bin/skybox"` | `"skybox": "./bin/skybox"` |
| 26 | `--outfile=skybox-bin` | `--outfile=skybox-bin` |
| 34 | `--outfile=skybox-bin` | `--outfile=skybox-bin` |

---

## Task 5: Update .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Replace build artifact name**

```
# Old (line 14)
skybox-bin

# New
skybox-bin
```

---

## Task 6: Update source code — constants and paths

These are the foundational files that other source files depend on. Do these first.

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/paths.ts`
- Modify: `src/types/index.ts`
- Modify: `src/lib/migration.ts`

**Step 1: `src/lib/constants.ts`**

Apply case-ordered replacements:
1. `SKYBOX` -> `SKYBOX` (env var references like `process.env.SKYBOX_INSTALL_METHOD`)
2. `SkyBox` -> `SkyBox` (any comments)
3. `Skybox` -> `Skybox` (if any)
4. `skybox` -> `skybox` (the `SKYBOX_HOME_DIR = ".skybox"` constant becomes `SKYBOX_HOME_DIR = ".skybox"`, and all other lowercase refs)

**Important:** The constant name itself changes: `SKYBOX_HOME_DIR` -> `SKYBOX_HOME_DIR`. This will require updating all imports of this constant across the codebase.

**Step 2: `src/lib/paths.ts`**

1. Update import: `SKYBOX_HOME_DIR` -> `SKYBOX_HOME_DIR`
2. `process.env.SKYBOX_HOME` -> `process.env.SKYBOX_HOME`
3. All comments referencing `SKYBOX_HOME` -> `SKYBOX_HOME`
4. Function names: `getSkyboxHome` -> `getSkyboxHome` (if present — check first)

**Step 3: `src/types/index.ts`**

1. `SkyboxConfig` -> `SkyboxConfig`
2. `SkyboxConfigV2` -> `SkyboxConfigV2`
3. All `SkyBox` -> `SkyBox` in comments
4. All `skybox` -> `skybox` in comments/string references

**Step 4: `src/lib/migration.ts`**

1. Update imports: `SkyboxConfig` -> `SkyboxConfig`, `SkyboxConfigV2` -> `SkyboxConfigV2`
2. Update function signatures and type annotations accordingly

---

## Task 7: Update source code — library files

**Files:**
- Modify: `src/lib/config.ts`
- Modify: `src/lib/container.ts`
- Modify: `src/lib/encryption.ts`
- Modify: `src/lib/mutagen.ts`
- Modify: `src/lib/mutagen-extract.ts`
- Modify: `src/lib/session.ts`
- Modify: `src/lib/startup.ts`
- Modify: `src/lib/templates.ts`
- Modify: `src/lib/update-check.ts`

**Step 1: For each file, apply case-ordered replacements**

Order: `SKYBOX` -> `SKYBOX`, then `SkyBox` -> `SkyBox`, then `Skybox` -> `Skybox`, then `skybox` -> `skybox`.

**Key changes to watch for:**

- `src/lib/container.ts`: Function `listSkyboxContainers` -> `listSkyboxContainers`. All callers must be updated too.
- `src/lib/mutagen.ts`: Session name prefix `skybox-` -> `skybox-` in template strings.
- `src/lib/update-check.ts`: GitHub URLs `NoorXLabs/SkyBox` -> `NoorXLabs/SkyBox`. User-Agent header `SkyBox-CLI` -> `SkyBox-CLI`. Brew/npm command strings.
- `src/lib/config.ts`: Any imports of renamed types (`SkyboxConfig` -> `SkyboxConfig`, etc.) and renamed constants (`SKYBOX_HOME_DIR` -> `SKYBOX_HOME_DIR`).
- `src/lib/encryption.ts`: Comment `Encryption utilities for SkyBox` -> `SkyBox`.
- `src/lib/templates.ts`: Comment about `~/.skybox/templates/` -> `~/.skybox/templates/`.
- `src/lib/paths.ts`: Already handled in Task 6.

---

## Task 8: Update source code — command files

**Files:**
- Modify: `src/index.ts`
- Modify: `src/commands/browse.ts`
- Modify: `src/commands/clone.ts`
- Modify: `src/commands/config.ts`
- Modify: `src/commands/config-devcontainer.ts`
- Modify: `src/commands/dashboard.tsx`
- Modify: `src/commands/doctor.ts`
- Modify: `src/commands/down.ts`
- Modify: `src/commands/editor.ts`
- Modify: `src/commands/encrypt.ts`
- Modify: `src/commands/hook.ts`
- Modify: `src/commands/init.ts`
- Modify: `src/commands/list.ts`
- Modify: `src/commands/new.ts`
- Modify: `src/commands/open.ts`
- Modify: `src/commands/push.ts`
- Modify: `src/commands/remote.ts`
- Modify: `src/commands/rm.ts`
- Modify: `src/commands/shell.ts`
- Modify: `src/commands/status.ts`
- Modify: `src/commands/up.ts`

**Step 1: For each file, apply case-ordered replacements**

**Key changes to watch for:**

- `src/index.ts` line 43: `.name("skybox")` -> `.name("skybox")` — this is the CLI command name.
- `src/commands/hook.ts`: This file has shell script strings with `_skybox_hook`, `_SKYBOX_PREV_DIR`, `skybox hook-check`, `# SkyBox shell hook`, and `spawn("skybox", ...)`. All must be renamed carefully. The shell functions become `_skybox_hook`, `_SKYBOX_PREV_DIR`, etc.
- `src/commands/init.ts`: Welcome message `"Welcome to skybox setup!"` -> `"Welcome to skybox setup!"`, and all other user-facing strings.
- `src/commands/doctor.ts`: `chalk.bold("SkyBox Doctor")` -> `chalk.bold("SkyBox Doctor")`, and all diagnostic messages.
- `src/commands/encrypt.ts` and `src/commands/down.ts`: Archive prefix `skybox-${project}` -> `skybox-${project}`.
- All commands: error messages referencing `skybox` CLI commands (e.g., `"Run 'skybox init' first"` -> `"Run 'skybox init' first"`).

---

## Task 9: Update test files

**Files:**
- Modify: `src/commands/__tests__/clone.test.ts`
- Modify: `src/commands/__tests__/encrypt.test.ts`
- Modify: `src/commands/__tests__/hook.test.ts`
- Modify: `src/commands/__tests__/new.test.ts`
- Modify: `src/commands/__tests__/open.test.ts`
- Modify: `src/commands/__tests__/shell-docker-isolated.test.ts`
- Modify: `src/commands/__tests__/shell.test.ts`
- Modify: `src/commands/__tests__/status.test.ts`
- Modify: `src/lib/__tests__/config-auto-up.test.ts`
- Modify: `src/lib/__tests__/config.test.ts`
- Modify: `src/lib/__tests__/container.test.ts`
- Modify: `src/lib/__tests__/encryption.test.ts`
- Modify: `src/lib/__tests__/hooks.test.ts`
- Modify: `src/lib/__tests__/migration.test.ts`
- Modify: `src/lib/__tests__/mutagen-extract.test.ts`
- Modify: `src/lib/__tests__/mutagen-selective.test.ts`
- Modify: `src/lib/__tests__/mutagen.test.ts`
- Modify: `src/lib/__tests__/paths.test.ts`
- Modify: `src/lib/__tests__/session.test.ts`
- Modify: `src/lib/__tests__/ssh.test.ts`
- Modify: `src/lib/__tests__/templates.test.ts`
- Modify: `src/lib/__tests__/test-utils.ts`
- Modify: `src/lib/__tests__/update-check.test.ts`

**Step 1: For each file, apply case-ordered replacements**

**Key things to watch for:**
- `hook.test.ts`: String assertions like `expect(hook).toContain("_skybox_hook()")` must become `expect(hook).toContain("_skybox_hook()")`. Same for `_SKYBOX_PREV_DIR` -> `_SKYBOX_PREV_DIR`.
- `mutagen.test.ts` and `mutagen-selective.test.ts`: Session name assertions like `expect(name).toBe("skybox-my-project")` -> `expect(name).toBe("skybox-my-project")`.
- `paths.test.ts`: References to `SKYBOX_HOME` env var -> `SKYBOX_HOME`.
- `config.test.ts`: May reference `SKYBOX_HOME` env var in test setup.
- `test-utils.ts`: Shared test helpers may reference skybox paths.
- `shell-docker-isolated.test.ts`: Mock references to `listSkyboxContainers` -> `listSkyboxContainers`.
- All test files that use `process.env.SKYBOX_HOME` in `beforeEach`/`afterEach` -> `process.env.SKYBOX_HOME`.

---

## Task 10: Update CI/CD and build scripts

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/release.sh`
- Modify: `scripts/download-mutagen.sh`

**Step 1: `.github/workflows/release.yml`**

This file has the densest concentration of platform-specific binary names. Replace:
- Binary names: `skybox-darwin-arm64` -> `skybox-darwin-arm64`, etc. (4 platforms)
- Archive names: `skybox-darwin-arm64.tar.gz` -> `skybox-darwin-arm64.tar.gz`, etc.
- Homebrew formula: `Formula/skybox.rb` -> `Formula/skybox.rb`
- Homebrew class: `class Skybox < Formula` -> `class Skybox < Formula`
- All GitHub URLs: `NoorXLabs/SkyBox` -> `NoorXLabs/SkyBox`
- Install commands: `=> "skybox"` -> `=> "skybox"`
- User-facing messages: `SkyBox requires Docker` -> `SkyBox requires Docker`
- Commit messages: `"Update skybox to v${VERSION}"` -> `"Update skybox to v${VERSION}"`

**Step 2: `scripts/release.sh`**

- Product name in comments: `SkyBox` -> `SkyBox`
- GitHub URLs: `NoorXLabs/SkyBox` -> `NoorXLabs/SkyBox`

**Step 3: `scripts/download-mutagen.sh`**

- Comment: `SkyBox binary` -> `SkyBox binary`

---

## Task 11: Update documentation — VitePress config and components

**Files:**
- Modify: `docs/.vitepress/commands.ts`
- Modify: `docs/.vitepress/config.ts`
- Modify: `docs/package.json`
- Modify: `docs/index.md`

**Step 1: Apply case-ordered replacements in each file**

- `docs/.vitepress/config.ts`: Site title, description, nav items, sidebar labels — all `SkyBox`/`skybox` refs.
- `docs/.vitepress/commands.ts`: Command descriptions referencing `skybox`.
- `docs/package.json`: If it has a name field with `skybox`.
- `docs/index.md`: Landing page hero text, feature descriptions.

---

## Task 12: Update documentation — guide pages

**Files:**
- Modify: `docs/guide/concepts.md`
- Modify: `docs/guide/index.md`
- Modify: `docs/guide/installation.md`
- Modify: `docs/guide/quick-start.md`
- Modify: `docs/guide/shell-integration.md`
- Modify: `docs/guide/troubleshooting.md`
- Modify: `docs/guide/workflows/daily-development.md`
- Modify: `docs/guide/workflows/multi-machine.md`
- Modify: `docs/guide/workflows/new-project.md`

**Step 1: Apply case-ordered replacements in each file**

These are the heaviest doc files. Key patterns:
- All CLI command examples: `skybox up`, `skybox clone`, etc. -> `skybox up`, `skybox clone`
- All path references: `~/.skybox/` -> `~/.skybox/`
- All env vars: `SKYBOX_HOME`, `SKYBOX_DEBUG` -> `SKYBOX_HOME`, `SKYBOX_DEBUG`
- Product name: `SkyBox` -> `SkyBox` in narrative text
- Code blocks with shell commands

---

## Task 13: Update documentation — reference pages

**Files:**
- Modify: `docs/reference/browse.md`
- Modify: `docs/reference/clone.md`
- Modify: `docs/reference/config.md`
- Modify: `docs/reference/configuration.md`
- Modify: `docs/reference/custom-templates.md`
- Modify: `docs/reference/dashboard.md`
- Modify: `docs/reference/doctor.md`
- Modify: `docs/reference/down.md`
- Modify: `docs/reference/editor.md`
- Modify: `docs/reference/encryption.md`
- Modify: `docs/reference/hook.md`
- Modify: `docs/reference/hooks.md`
- Modify: `docs/reference/index.md`
- Modify: `docs/reference/init.md`
- Modify: `docs/reference/list.md`
- Modify: `docs/reference/logs.md`
- Modify: `docs/reference/new.md`
- Modify: `docs/reference/open.md`
- Modify: `docs/reference/push.md`
- Modify: `docs/reference/remote.md`
- Modify: `docs/reference/rm.md`
- Modify: `docs/reference/shell.md`
- Modify: `docs/reference/status.md`
- Modify: `docs/reference/up.md`
- Modify: `docs/reference/update.md`

**Step 1: Apply case-ordered replacements in each file**

Same patterns as Task 12. Every reference page has command examples with `skybox <command>`.

---

## Task 14: Update documentation — architecture pages

**Files:**
- Modify: `docs/architecture/codebase.md`
- Modify: `docs/architecture/design-decisions.md`
- Modify: `docs/architecture/index.md`

**Step 1: Apply case-ordered replacements in each file**

---

## Task 15: Update README.md and CHANGELOG.md

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Step 1: Apply case-ordered replacements**

- `README.md`: Title `# SkyBox` -> `# SkyBox`, all command examples, path references, GitHub URLs.
- `CHANGELOG.md`: All release notes, commit descriptions, comparison URLs (`NoorXLabs/SkyBox/compare/...` -> `NoorXLabs/SkyBox/compare/...`). This file is large (~100+ occurrences).

---

## Task 16: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Apply case-ordered replacements**

This is the AI assistant guide. It has extensive references throughout:
- Title: `# CLAUDE.md - AI Assistant Guide for SkyBox` -> `SkyBox`
- All command examples, path references, type names, constant names
- Container naming: `skybox-<project-name>` -> `skybox-<project-name>`
- Environment variables: `SKYBOX_HOME` -> `SKYBOX_HOME`
- Config directory: `~/.skybox/` -> `~/.skybox/`
- Session file paths, Docker labels, everything

---

## Task 17: Update plans and archived plans

**Files:**
- Modify: `plans/IMPLEMENTATION.md`
- Modify: `plans/2026-02-04-rm-remote-multi-design.md`
- Modify: All files in `plans/archive/` (20+ files)

**Step 1: Apply case-ordered replacements in each file**

These are historical design documents. While they describe past work, updating them keeps the codebase consistent and searchable.

---

## Task 18: Verification

**Step 1: Run TypeScript type checking**

```bash
bun run typecheck
```

Expected: 0 errors. If there are errors, they'll be from:
- Missed import renames (`SkyboxConfig` still referenced somewhere)
- Missed constant renames (`SKYBOX_HOME_DIR` still imported somewhere)

Fix any errors before proceeding.

**Step 2: Run tests**

```bash
bun run test
```

Expected: All tests pass. If failures, they'll be from:
- String assertions still expecting old names
- Environment variable setup still using `SKYBOX_HOME`
- Mock function names not updated

Fix any failures before proceeding.

**Step 3: Run Biome lint and format**

```bash
bun run check
```

Expected: Clean pass. Biome may auto-fix import ordering after renames.

**Step 4: Final grep sweep**

```bash
# Search for any surviving references (excluding node_modules and .git)
grep -ri "skybox" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.sh" --include="*.md" . | grep -v node_modules | grep -v '.git/'
```

Expected: **Zero results.** If any remain, fix them.

Also check the bin file was renamed:
```bash
ls bin/
# Should show: skybox (not skybox)
```

And check .gitignore:
```bash
grep skybox-bin .gitignore
# Should match
```

---

## Task 19: Commit

**Step 1: Stage all changes**

```bash
git add -A
```

**Step 2: Review staged changes**

```bash
git diff --cached --stat
```

Verify the file count and renames look correct.

**Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor: rename SkyBox to SkyBox

Rename the entire project from SkyBox to SkyBox to avoid name collision
with Jetify's Skybox (Nix-based dev environment tool).

Changes across 143 files:
- Package identity: name, bin, build output
- CLI command: skybox -> skybox
- TypeScript types: SkyboxConfig -> SkyboxConfig, SkyboxConfigV2 -> SkyboxConfigV2
- Constants: SKYBOX_HOME_DIR -> SKYBOX_HOME_DIR
- Environment variables: SKYBOX_HOME -> SKYBOX_HOME, SKYBOX_DEBUG -> SKYBOX_DEBUG
- Config directory: ~/.skybox/ -> ~/.skybox/
- Container naming: skybox-<project> -> skybox-<project>
- Mutagen sessions: skybox-<name> -> skybox-<name>
- Shell hooks: _skybox_hook -> _skybox_hook, _SKYBOX_PREV_DIR -> _SKYBOX_PREV_DIR
- GitHub URLs: NoorXLabs/SkyBox -> NoorXLabs/SkyBox
- Binary names: skybox-darwin-arm64 -> skybox-darwin-arm64, etc.
- Homebrew formula: class Skybox -> class Skybox
- All documentation, plans, skills, and CI/CD workflows
EOF
)"
```

---

## Automation Tip

For the mechanical text replacement (Tasks 6-17), you can use `sed` in a loop instead of manual edits. Here's the case-ordered script:

```bash
#!/bin/bash
# Run from repo root. Process order matters!

# Collect all target files
FILES=$(grep -ril "skybox\|SkyBox\|SKYBOX" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  --include="*.yml" --include="*.yaml" --include="*.md" \
  --include="*.sh" . | grep -v node_modules | grep -v '.git/')

for f in $FILES; do
  # Order 1: SKYBOX -> SKYBOX (uppercase)
  sed -i '' 's/SKYBOX/SKYBOX/g' "$f"
  # Order 2: SkyBox -> SkyBox (PascalCase)
  sed -i '' 's/SkyBox/SkyBox/g' "$f"
  # Order 3: Skybox -> Skybox (Title case — interfaces, Homebrew)
  sed -i '' 's/Skybox/Skybox/g' "$f"
  # Order 4: skybox -> skybox (lowercase — everything else)
  sed -i '' 's/skybox/skybox/g' "$f"
done

echo "Done. Run verification steps next."
```

**Warning:** After running this, still do Tasks 1-5 (git mv operations) and Task 18 (verification) manually. The script only handles text content, not file/directory renames.

---

## Post-Rename Checklist (outside this repo)

- [ ] Rename GitHub repo: `NoorXLabs/SkyBox` -> `NoorXLabs/SkyBox`
- [ ] Update any Homebrew tap repo if it exists
- [ ] Reserve `skybox` on npm: `npm publish` (or `npm init --scope` for scoped)
- [ ] Update any external references (personal site, social, etc.)
- [ ] Register `skybox.dev` domain (optional)
