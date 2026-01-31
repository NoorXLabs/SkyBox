# Custom Local Templates — Design Document

> **Date:** 2026-01-30
>
> **Status:** Draft
>
> **Related:** `plans/IMPLEMENTATION.md` → Future Features — High Priority

---

## Summary

Users can store devcontainer.json files in `~/.devbox/templates/` as reusable templates. The filename (minus `.json`) becomes the display name. These templates appear in a unified CLI selector alongside built-in templates whenever a devcontainer config is needed — during `devbox up`, `devbox clone`, `devbox new`, and `devbox config-devcontainer`.

A shared `selectTemplate()` component replaces the currently fragmented template selection logic spread across multiple commands.

---

## Template Storage

- **Location:** `~/.devbox/templates/<name>.json`
- **Example:** `~/.devbox/templates/bun.json` displays as "bun"
- **Each file is a complete devcontainer.json** — DevBox does not merge or inject features
- **Required fields:** `workspaceFolder` and `workspaceMount` must be present
- **Directory auto-created** on first use

---

## Validation

- Must be valid JSON
- Must contain `workspaceFolder` and `workspaceMount` properties
- **At list time:** invalid templates shown with a warning indicator (e.g., `bun ⚠ invalid JSON`)
- **At selection time:** selecting an invalid template shows the specific error and returns to the selector

---

## Template Selector Layout

A single unified selector used by all commands:

```
── Built-in ──
  Node.js
  Python
  Go
  Generic
── Other ──
  Enter git URL
── Your Templates ──
  bun
  python ⚠ missing workspaceFolder
  Create new template
```

- Built-in and Other sections are fixed at the top (fixed length)
- Your Templates section is at the bottom (scrollable, can grow)
- "Create new template" is always the last item

---

## "Create New Template" Flow

### Step 1 — Name Prompt

```
? Template name: bun
```

Validates:
- No spaces or special characters
- No collision with existing template names
- Generates `~/.devbox/templates/bun.json`

### Step 2 — Scaffold the File

DevBox writes a template with required fields pre-filled and common optional fields as placeholders:

```json
{
  "name": "bun",
  "image": "mcr.microsoft.com/devcontainers/base:debian",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/${localWorkspaceFolderBasename},type=bind,consistency=cached",
  "postCreateCommand": "",
  "postStartCommand": "",
  "features": {},
  "customizations": {
    "vscode": {
      "extensions": [],
      "settings": {}
    }
  }
}
```

### Step 3 — Edit Prompt

```
? How would you like to edit this template?
  Open in editor
  Edit in terminal
  Skip — edit later
```

- **Open in editor** — launches configured DevBox editor (from `devbox editor` setting)
- **Edit in terminal** — opens with `$EDITOR`, falls back to `vi`
- **Skip** — prints the file path, returns to template selector

After editing (or skipping), returns to the template selector so the user can select the template for the current operation.

---

## Shared Template Selector Component

### `selectTemplate()` in `src/lib/templates.ts`

A single function that all commands call. It handles:

- Loading built-in templates from `TEMPLATES` array
- Loading and validating user templates from `~/.devbox/templates/`
- Rendering the unified selector with sections
- The "Create new template" sub-flow
- Returning a normalized result

### Return Type

```typescript
type TemplateSelection =
  | { source: "builtin"; config: DevcontainerConfig }
  | { source: "user"; config: DevcontainerConfig }
  | { source: "git"; url: string }
```

Each command handles the result according to its context:
- **`up` / `clone`** — writes config to `.devcontainer/devcontainer.json`
- **`new`** — writes config to the remote project (or clones git URL)
- **`config-devcontainer`** — overwrites existing devcontainer config

---

## Integration Points

### `devbox up` / `devbox clone` (no devcontainer found)

Current flow asks the user to pick a built-in template. Replaced by `selectTemplate()`. When a custom template is selected, DevBox copies the JSON into the project's `.devcontainer/devcontainer.json`.

### `devbox new` (creating a new project)

Current flow offers only git repo URLs. Now also includes built-in and user local templates. When a local template (built-in or user) is chosen, DevBox creates the project directory on the remote, initializes a git repo, and writes the devcontainer.json — no git clone step needed.

### `devbox config-devcontainer` (reset/change devcontainer)

Currently lets users pick a built-in template. Now uses `selectTemplate()` for the full selector.

---

## Files Affected

| File | Change |
|------|--------|
| `src/lib/templates.ts` | Add `loadUserTemplates()`, `validateTemplate()`, `scaffoldTemplate()`, `getUserTemplatesDir()`, `selectTemplate()` |
| `src/types/index.ts` | Add `UserLocalTemplate` interface, `TemplateSelection` type |
| `src/commands/new.ts` | Replace template selection with `selectTemplate()`, add built-in template support |
| `src/commands/up.ts` | Replace template selection with `selectTemplate()` |
| `src/commands/clone.ts` | Replace template selection with `selectTemplate()` |
| `src/commands/config-devcontainer.ts` | Replace template selection with `selectTemplate()` |
| `docs/reference/custom-templates.md` | Reference doc with all template fields |

---

## Edge Cases

- **Template directory doesn't exist:** auto-created on first use
- **Name collisions with built-in:** both appear in their respective sections, no conflict (return type tracks source)
- **Template deleted between listing and selection:** show error, return to selector
- **Non-JSON files in templates directory:** ignored, only `*.json` loaded
- **Empty templates directory:** "Your Templates" section shows with just "Create new template"
- **"Skip" edit during active operation:** scaffold has valid required fields, works as a basic Debian container

---

## Documentation Updates Required

When this feature is implemented, the following docs need to be created or updated:

| Doc | Action |
|-----|--------|
| `docs/reference/custom-templates.md` | **Create** — template storage, validation rules, scaffold fields, and examples |
| `docs/reference/new.md` | **Update** — document built-in and user template options (currently only covers git URLs) |
| `docs/reference/up.md` | **Update** — mention user templates in the "no devcontainer found" flow |
| `docs/reference/clone.md` | **Update** — mention user templates in the "no devcontainer found" flow |
| `docs/reference/config.md` | **Update** — document `config-devcontainer` now uses unified template selector |
| `docs/guide/concepts.md` | **Update** — add templates as a concept (storage location, relationship to devcontainers) |

---

*Last updated: 2026-01-30*
