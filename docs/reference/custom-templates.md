---
title: Custom Templates
description: Create and manage reusable devcontainer templates in SkyBox. Store templates locally for consistent container configurations across projects.
---

# Custom Templates

Create and manage reusable devcontainer templates stored locally on your machine.

## Overview

Custom templates are `.json` files stored in `~/.skybox/templates/`. Each file is a complete `devcontainer.json` that can be selected whenever SkyBox needs a devcontainer configuration — during `skybox up`, `skybox new`, or `skybox config devcontainer reset`.

## Template Storage

| Property | Value |
|----------|-------|
| Location | `~/.skybox/templates/<name>.json` |
| Format | Standard devcontainer.json |
| Display name | Filename without `.json` extension |

**Example:** `~/.skybox/templates/bun.json` appears as "bun" in the template selector.

The templates directory is created automatically the first time you create a template through the CLI.

## Required Fields

Every custom template must contain these fields:

| Field | Description |
|-------|-------------|
| `workspaceFolder` | Container path where the project is mounted (must use `/workspaces/` prefix) |
| `workspaceMount` | Docker mount specification for the project |

The `/workspaces/` prefix is required by the devcontainer spec — it's the standard location where projects are mounted inside the container.

::: warning
When a template is applied to a project, SkyBox overrides `workspaceFolder` and `workspaceMount` with project-specific values (e.g., `/workspaces/my-app`). These fields are required for validation but their exact values in the template file are not used directly.
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

This template includes the features that SkyBox's built-in templates use. These are recommended for a smooth development experience:

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
  "postCreateCommand": "[ -f package.json ] && bun install || true",
  "postStartCommand": "[ ! -L $HOME/.ssh ] && rm -rf $HOME/.ssh && ln -s /var/ssh-config $HOME/.ssh || true",
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {
      "configureZshAsDefaultShell": true
    },
    "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {
      "moby": false
    },
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/shyim/devcontainers-features/bun:0": {}
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

::: tip Devcontainer Features
Instead of installing tools via `postCreateCommand`, prefer using [devcontainer features](https://containers.dev/features) when available. Features are cached in the image layer and don't re-run on every container start.
:::

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

SkyBox uses a shared template selector component. Available options can vary by command:

<!--@include: ../snippets/template-selector-full.md-->

If you have custom templates in `~/.skybox/templates/`, they appear in the "Your Templates" section with validation status:

```
── Your Templates ──
  bun
  python ⚠ missing workspaceFolder
  Create new template
```

- **Built-in** and **Other** sections are fixed at the top
- **Your Templates** section appears at the bottom and grows as you add templates
- **Create new template** is always the last item

`Enter git URL` is shown in `skybox new`. The `skybox up` and `skybox config devcontainer reset` selectors show built-in and local templates only.

## Creating a Template

### Through the CLI

Select "Create new template" from the template selector. SkyBox walks you through:

1. **Name** — Enter a name (letters, numbers, hyphens, underscores only; no collisions with existing templates)
2. **Scaffold** — SkyBox creates a template file with required fields pre-filled
3. **Edit** — Choose how to edit the template:
   - **Open in editor** — launches your configured SkyBox editor
   - **Edit in terminal** — opens with `$EDITOR` (falls back to `vi`)
   - **Skip** — prints the file path, returns to the selector

After creating and optionally editing, you return to the template selector where the new template is available for selection.

### Manually

Create a `.json` file in `~/.skybox/templates/`. Copy one of the starter templates above and save it:

```bash
mkdir -p ~/.skybox/templates
# Then create your template file, e.g.:
# ~/.skybox/templates/rust.json
# ~/.skybox/templates/bun.json
```

The template will appear in the selector the next time any command needs a devcontainer configuration.

## Commands That Use Templates

| Command | When templates are shown |
|---------|------------------------|
| `skybox up` | When a project has no `devcontainer.json` (built-in and local templates only) |
| `skybox new` | When creating a new project (built-in/user templates create an empty project with the selected config; git URLs clone the repo) |
| `skybox config devcontainer reset` | When resetting a project's devcontainer config (built-in and local templates only) |

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

- [skybox up](/reference/up) - Start a development container
- [skybox new](/reference/new) - Create a new project
- [skybox config](/reference/config) - Configure devcontainer settings
- [Core Concepts — Templates](/guide/concepts#templates) - Template overview
