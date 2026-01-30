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
| `workspaceFolder` | Container path where the project is mounted (must use `/workspaces/` prefix) |
| `workspaceMount` | Docker mount specification for the project |

The `/workspaces/` prefix is required by the devcontainer spec — it's the standard location where projects are mounted inside the container.

::: warning
When a template is applied to a project, DevBox overrides `workspaceFolder` and `workspaceMount` with project-specific values (e.g., `/workspaces/my-app`). These fields are required for validation but their exact values in the template file are not used directly.
:::

## Starter Templates

### Minimal Template

The bare minimum to get a working container. Copy this and customize it:

```json
{
  "name": "my-template",
  "image": "mcr.microsoft.com/devcontainers/base:debian",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/${localWorkspaceFolderBasename},type=bind,consistency=cached"
}
```

This gives you a Debian container with basic dev tools. No SSH passthrough, no Docker access, no shell customization.

### Recommended Template

This template includes the features that DevBox's built-in templates use. These are recommended for a smooth development experience:

```json
{
  "name": "my-template",
  "image": "mcr.microsoft.com/devcontainers/base:debian",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/${localWorkspaceFolderBasename},type=bind,consistency=cached",
  "postCreateCommand": "",
  "postStartCommand": "[ ! -L $HOME/.ssh ] && rm -rf $HOME/.ssh && ln -s /var/ssh-config $HOME/.ssh || true",
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {
      "configureZshAsDefaultShell": true
    },
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
      "moby": false
    },
    "ghcr.io/devcontainers/features/git:1": {}
  },
  "mounts": [
    "source=${localEnv:HOME}/.ssh,target=/var/ssh-config,type=bind,readonly"
  ],
  "customizations": {
    "vscode": {
      "extensions": [],
      "settings": {
        "terminal.integrated.defaultProfile.linux": "zsh"
      }
    }
  }
}
```

### Why These Features Are Recommended

| Feature | What it does | Why you want it |
|---------|-------------|-----------------|
| **common-utils** (zsh) | Installs zsh and sets it as the default shell | Better shell experience with auto-completion and history |
| **docker-outside-of-docker** | Exposes the host Docker daemon inside the container | Run `docker` commands from your dev container without nested Docker |
| **git** | Ensures git is installed and configured | Required for version control inside the container |
| **SSH passthrough** (mount + postStartCommand) | Bind-mounts your host `~/.ssh` directory read-only and symlinks it inside the container | Git operations over SSH (push, pull, clone) work using your existing keys — no need to copy keys into the container |
| **zsh as default terminal** (VS Code setting) | Sets the integrated terminal to use zsh | Matches the shell configured by common-utils |

The `postStartCommand` creates a symlink from `$HOME/.ssh` to the bind-mounted `/var/ssh-config` directory. This runs each time the container starts, ensuring SSH keys are always available.

### Language-Specific Example

A complete template for a Bun/TypeScript project with all recommended features:

```json
{
  "name": "bun",
  "image": "mcr.microsoft.com/devcontainers/base:debian",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
  "workspaceMount": "source=${localWorkspaceFolder},target=/workspaces/${localWorkspaceFolderBasename},type=bind,consistency=cached",
  "postCreateCommand": "curl -fsSL https://bun.sh/install | bash && export BUN_INSTALL=\"$HOME/.bun\" && export PATH=\"$BUN_INSTALL/bin:$PATH\" && [ -f package.json ] && bun install || true",
  "postStartCommand": "[ ! -L $HOME/.ssh ] && rm -rf $HOME/.ssh && ln -s /var/ssh-config $HOME/.ssh || true",
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {
      "configureZshAsDefaultShell": true
    },
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
      "moby": false
    },
    "ghcr.io/devcontainers/features/git:1": {}
  },
  "mounts": [
    "source=${localEnv:HOME}/.ssh,target=/var/ssh-config,type=bind,readonly"
  ],
  "customizations": {
    "vscode": {
      "extensions": ["oven.bun-vscode"],
      "settings": {
        "terminal.integrated.defaultProfile.linux": "zsh"
      }
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

Create a `.json` file in `~/.devbox/templates/`. Copy one of the starter templates above and save it:

```bash
mkdir -p ~/.devbox/templates
# Then create your template file, e.g.:
# ~/.devbox/templates/rust.json
# ~/.devbox/templates/bun.json
```

The template will appear in the selector the next time any command needs a devcontainer configuration.

## Commands That Use Templates

| Command | When templates are shown |
|---------|------------------------|
| `devbox up` | When a project has no `devcontainer.json` |
| `devbox new` | When creating a new project (built-in/user templates create an empty project with the selected config; git URLs clone the repo) |
| `devbox config devcontainer reset` | When resetting a project's devcontainer config |

## Field Reference

All fields supported in a custom template:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | No | Display name for the container |
| `image` | No | Docker image to use (e.g., `mcr.microsoft.com/devcontainers/base:debian`) |
| `workspaceFolder` | **Yes** | Container path for the project (must start with `/workspaces/`) |
| `workspaceMount` | **Yes** | Docker bind mount spec for the project directory |
| `postCreateCommand` | No | Shell command to run after the container is first created (e.g., `npm install`) |
| `postStartCommand` | No | Shell command to run each time the container starts (e.g., SSH symlink setup) |
| `features` | No | Devcontainer features to install (e.g., git, Docker-outside-of-Docker, common-utils) |
| `mounts` | No | Additional Docker bind mounts (e.g., SSH key passthrough) |
| `customizations.vscode.extensions` | No | VS Code extensions to install in the container |
| `customizations.vscode.settings` | No | VS Code settings to apply in the container |

For the full devcontainer.json specification, see the [devcontainers spec](https://containers.dev/implementors/json_reference/).

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
