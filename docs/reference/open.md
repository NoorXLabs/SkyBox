---
title: skybox open
description: Open editor or shell for a running container without restarting it using skybox open. Attach to active dev environments.
---

# skybox open

Open editor or shell for a running container without restarting it.

## Usage

```bash
skybox open [project] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[project]` | Name of the project (optional, auto-detected from cwd or prompted) |

## Options

| Option | Description |
|--------|-------------|
| `-e, --editor` | Open in editor only |
| `-s, --shell` | Attach to shell only |
| `--no-prompt` | Non-interactive mode |
| `--dry-run` | Preview what would happen without executing |

## Description

The `open` command provides quick access to a running container's editor or shell without going through the full `skybox up` workflow. It's designed for when you already have a container running and just want to:

- Open another editor window
- Attach a new shell session
- Quickly jump into a project that's already up

### Key Differences from `skybox up`

| Command | Behavior |
|---------|----------|
| `skybox up` | Creates session, resumes sync, starts container if needed, then opens editor/shell |
| `skybox open` | Only works with running containers, just opens editor/shell |

Use `skybox open` when:
- Container is already running
- You want quick access without session/sync checks
- You need multiple editor windows or shell sessions

Use `skybox up` when:
- Starting a work session
- Container might not be running
- You need the full startup flow (session, sync, container start)

### Action Menu

Without flags, `skybox open` presents the same action menu as `skybox up`:

<!--@include: ../snippets/post-start-action-menu.md-->

### Container Must Be Running

Unlike `skybox up`, the `open` command requires the container to already be running:

```bash
$ skybox open my-project
Error: Container for 'my-project' is not running.
  i Run 'skybox up' to start the container first.
```

## Examples

```bash
# Open action menu for a running project
skybox open my-project

# Open editor only (no prompts)
skybox open my-project --editor

# Attach to shell only
skybox open my-project --shell

# Open both editor and shell
skybox open my-project --editor --shell

# Auto-detect project from current directory
cd ~/.skybox/Projects/my-project
skybox open

# Non-interactive mode (does nothing if no flags)
skybox open my-project --no-prompt --editor
```

### Workflow Example

```bash
# Start your work session
skybox up my-project --editor

# Later, need another shell window
skybox open my-project --shell

# Or open in a different editor
skybox open my-project --editor
```

### Multiple Sessions

Open multiple shells for the same running container:

```bash
# Terminal 1: Main development
skybox up my-project --attach

# Terminal 2: Run tests
skybox open my-project --shell

# Terminal 3: Watch logs
skybox open my-project --shell
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (not configured, project not found, container not running) |

## See Also

- [skybox up](/reference/up) - Start container with full workflow
- [skybox shell](/reference/shell) - Direct shell access with auto-start option
- [skybox status](/reference/status) - Check if container is running
