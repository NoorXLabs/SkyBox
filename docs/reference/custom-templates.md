# Custom Templates

Create and manage reusable devcontainer templates stored locally on your machine.

## Overview

Custom templates are `.json` files stored in `~/.devbox/templates/`. Each file is a complete `devcontainer.json` that can be selected whenever DevBox needs a devcontainer configuration — during `devbox up`, `devbox new`, or `devbox config devcontainer reset`.

## Template Storage

| Property | Value |
|----------|-------|
| Location | `~/.devbox/templates/<name>.json` |
| Format | Standard devcontainer.json |
| Display name | Filename without `.json` extension |

**Example:** `~/.devbox/templates/bun.json` appears as "bun" in the template selector.

The templates directory is created automatically the first time you create a template through the CLI.

## Required Fields

Every custom template must contain these fields:

| Field | Description |
|-------|-------------|
| `workspaceFolder` | Container path where the project is mounted |
| `workspaceMount` | Docker mount specification for the project |

::: warning
When a template is applied to a project, DevBox overrides `workspaceFolder` and `workspaceMount` with project-specific values. These fields are required for validation but their values in the template file are not used directly.
:::

## Template Format

A complete template file:

```json
{
  "name": "bun",
  "image": "mcr.microsoft.com/devcontainers/base:debian",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/${localWorkspaceFolderBasename},type=bind,consistency=cached",
  "postCreateCommand": "curl -fsSL https://bun.sh/install | bash",
  "postStartCommand": "",
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {
      "configureZshAsDefaultShell": true
    }
  },
  "customizations": {
    "vscode": {
      "extensions": ["oven.bun-vscode"],
      "settings": {}
    }
  }
}
```

## Validation

Templates are validated at two points:

**At list time** — when the template selector is displayed:
- Invalid templates appear with a warning indicator (e.g., `bun ⚠ invalid JSON`)
- Templates missing required fields show the specific error (e.g., `python ⚠ missing workspaceFolder`)

**At selection time** — when you select an invalid template:
- The specific error is displayed
- You are returned to the template selector to choose another

### Validation Rules

- File must contain valid JSON
- JSON must be an object (not an array or primitive)
- Must contain `workspaceFolder` property
- Must contain `workspaceMount` property
- Non-`.json` files in the templates directory are ignored

## Template Selector

All commands that need a devcontainer configuration use the same unified selector:

```
? Select a template:
── Built-in ──
  Node.js — Node.js 20 with npm/yarn + Docker support
  Python — Python 3.12 with pip/venv + Docker support
  Go — Go 1.22 + Docker support
  Generic — Debian with basic dev tools + Docker support
── Other ──
  Enter git URL
── Your Templates ──
  bun
  python ⚠ missing workspaceFolder
  Create new template
```

- **Built-in** and **Other** sections are fixed at the top
- **Your Templates** section appears at the bottom and grows as you add templates
- **Create new template** is always the last item

## Creating a Template

### Through the CLI

Select "Create new template" from the template selector. DevBox walks you through:

1. **Name** — Enter a name (letters, numbers, hyphens, underscores only; no collisions with existing templates)
2. **Scaffold** — DevBox creates a template file with required fields pre-filled
3. **Edit** — Choose how to edit the template:
   - **Open in editor** — launches your configured DevBox editor
   - **Edit in terminal** — opens with `$EDITOR` (falls back to `vi`)
   - **Skip** — prints the file path, returns to the selector

After creating and optionally editing, you return to the template selector where the new template is available for selection.

### Manually

Create a `.json` file in `~/.devbox/templates/`:

```bash
mkdir -p ~/.devbox/templates
cat > ~/.devbox/templates/rust.json << 'EOF'
{
  "name": "rust",
  "image": "mcr.microsoft.com/devcontainers/rust:1",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/${localWorkspaceFolderBasename},type=bind,consistency=cached",
  "postCreateCommand": "rustup update",
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {
      "configureZshAsDefaultShell": true
    }
  },
  "customizations": {
    "vscode": {
      "extensions": ["rust-lang.rust-analyzer"],
      "settings": {}
    }
  }
}
EOF
```

## Commands That Use Templates

| Command | When templates are shown |
|---------|------------------------|
| `devbox up` | When a project has no `devcontainer.json` |
| `devbox new` | When creating a new project (built-in/user templates create an empty project with the selected config; git URLs clone the repo) |
| `devbox config devcontainer reset` | When resetting a project's devcontainer config |

## Edge Cases

- **Template directory doesn't exist** — created automatically on first use
- **Name collisions with built-in templates** — both appear in their respective sections, no conflict
- **Template deleted between listing and selection** — error is shown, selector loops back
- **Non-JSON files in templates directory** — ignored
- **Empty templates directory** — "Your Templates" section shows only "Create new template"

## See Also

- [devbox up](/reference/up) - Start a development container
- [devbox new](/reference/new) - Create a new project
- [devbox config](/reference/config) - Configure devcontainer settings
- [Core Concepts — Templates](/guide/concepts#templates) - Template overview
