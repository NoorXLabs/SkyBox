# Plan: Docs Snippet Consolidation

Consolidate repeated content across VitePress docs into reusable `<!--@include:-->` snippets in `docs/snippets/`. Eliminates drift risk where the same information appears in multiple files with inconsistent values.

## Context

Four snippets already exist and are wired up:
- `snippets/template-selector-up.md` — used in quick-start, new-project
- `snippets/template-selector-full.md` — used in new-project, reference/new
- `snippets/templates-table.md` — used in new-project
- `snippets/status-detailed.md` — used in quick-start, new-project

The `srcExclude` in `.vitepress/config.ts` already excludes `**/snippets/**` from page generation.

## Batch 1: High Priority (fix existing drift + wire up existing snippets)

### 1.1 Wire up `template-selector-full.md` in `reference/custom-templates.md`

**File:** `docs/reference/custom-templates.md` lines 162-178
**Problem:** Inline template selector has stale descriptions ("Docker support" instead of "Common Utils + Docker") and lists "bun" as a user template instead of a built-in.
**Action:** Split the code block so the template selector portion uses `<!--@include: ../snippets/template-selector-full.md-->`. Keep the user template examples ("bun", "python ⚠ missing workspaceFolder") as a separate code block below to illustrate custom template validation.

### 1.2 Wire up `status-detailed.md` in `guide/workflows/daily-development.md`

**File:** `docs/guide/workflows/daily-development.md` lines 105-137
**Problem:** Inline status output uses wrong separator (`---` vs `━━━`), missing PID line, uses ISO timestamp instead of relative time.
**Action:** Replace the inline status block with `<!--@include: ../../snippets/status-detailed.md-->`.

### 1.3 Create `editors-list.md` snippet

**Files affected:**
- `docs/guide/installation.md` lines 115-120 (numbered list, missing VS Code Insiders)
- `docs/reference/init.md` lines 64-71 (bullet list, missing VS Code Insiders)
- `docs/reference/editor.md` lines 28-33 (table with command IDs)
- `docs/reference/configuration.md` lines 76-81 (list with command IDs)

**Problem:** Already inconsistent — installation.md and init.md omit VS Code Insiders, but `SUPPORTED_EDITORS` in `constants.ts` includes `code-insiders`. Four files to update whenever an editor is added.
**Action:** Create `snippets/editors-list.md` as a markdown table (name + command ID). Include in all four locations. The table format works for reference pages; guide pages can include it too since it's concise.

**Snippet content (derive from `SUPPORTED_EDITORS` in `src/lib/constants.ts`):**
```
| Editor | Command |
|--------|---------|
| Cursor | `cursor` |
| VS Code | `code` |
| VS Code Insiders | `code-insiders` |
| Zed | `zed` |
| Other | custom command |
```

Note: Vim/Neovim are not in `SUPPORTED_EDITORS` — they may be terminal editors handled differently. Verify before finalizing the snippet.

### 1.4 Create `default-ignore-patterns.md` snippet

**Files affected:**
- `docs/guide/concepts.md` lines 123-139
- `docs/reference/configuration.md` lines 99-114 (schema section)
- `docs/reference/configuration.md` lines 214-234 (complete example section)

**Problem:** Full 14-pattern list appears 3 times. Adding a pattern means 3 edits. Should match `DEFAULT_IGNORE` in `src/lib/constants.ts`.
**Action:** Create `snippets/default-ignore-patterns.md` as a YAML code block. Include in all three locations. The complete example in configuration.md may need the snippet embedded within a larger YAML block — if so, restructure to show defaults separately then reference them in the full example.

## Batch 2: Medium Priority

### 2.1 Create `post-start-action-menu.md` snippet

**Files affected:**
- `docs/guide/quick-start.md` lines 124-129
- `docs/guide/workflows/daily-development.md` lines 36-42
- `docs/reference/open.md` lines 55-60

**Problem:** Identical 4-option menu in 3 files. If options change, 3 files need updating.
**Action:** Create `snippets/post-start-action-menu.md` as a code block. Include in all three locations.

### 2.2 Create `common-template-features.md` snippet

**Files affected:**
- `docs/guide/concepts.md` lines 203-207 (detailed with links)
- `docs/guide/workflows/new-project.md` lines 142-147 (brief bullets)

**Problem:** Same 4 features at different detail levels. Will drift when a feature is added/removed.
**Action:** Create `snippets/common-template-features.md` using the detailed version from concepts.md (with links). Replace both occurrences. The brief version in new-project.md gains more useful detail.

### 2.3 Create `env-vars-table.md` snippet

**Files affected:**
- `docs/guide/concepts.md` lines 404-409 (4 vars)
- `docs/reference/configuration.md` lines 298-306 (6 vars)

**Problem:** concepts.md is missing `HOME` and `EDITOR`. `SKYBOX_SKIP_GPG` description differs.
**Action:** Create `snippets/env-vars-table.md` using the complete 6-var version from configuration.md. Include in both files. This also fixes the inconsistency in concepts.md.

## Batch 3: Low Priority

### 3.1 Create `session-file-format.md` snippet

**Files affected:**
- `docs/guide/concepts.md` lines 292-299
- `docs/guide/workflows/multi-machine.md` lines 120-128
- `docs/architecture/design-decisions.md` lines 194-201 (excluded from build, but still in repo)

**Problem:** Same 5-field JSON structure in 3 files with different example values. If a field is added/removed, 3 files need updating.
**Action:** Create `snippets/session-file-format.md` with one canonical set of example values. Include in concepts.md and multi-machine.md. Architecture file can optionally be updated too (it's excluded from build but still read by developers).

### 3.2 Fix `~/.skybox/` directory casing inconsistency

**Files affected:**
- `docs/guide/installation.md` lines 139-144 — shows `projects/` (lowercase)
- `docs/reference/configuration.md` lines 25-34 — shows `Projects/` (capitalized)

**Problem:** The actual constant is `PROJECTS_DIR_NAME = "Projects"` (capitalized). installation.md is wrong.
**Action:** Fix the casing in installation.md. Optionally create a `snippets/skybox-directory-structure.md` snippet if the structure appears in more places, but with only 2 occurrences this can just be a manual fix.

## Verification

After each batch:
1. Run `bun run --cwd docs build` — confirm no errors and no snippet pages in output
2. Spot-check rendered HTML to confirm includes resolved correctly
3. Search for any remaining inline copies: `grep -r "Common Utils + Docker\|two-way-resolved\|SKYBOX_HOME\|session.lock" docs/ --include="*.md" | grep -v snippets/ | grep -v node_modules/`

## Documentation Updates Required

- None external — this plan only restructures internal doc content into snippets
- CLAUDE.md: After completion, add a note under "Documentation" about the `docs/snippets/` convention
