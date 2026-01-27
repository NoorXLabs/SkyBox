# DevBox Up Command Design

## Overview

The `devbox up` command starts a development container for a project, ensuring sync is active and providing options to open in an editor or attach to a shell.

## Command Interface

```
devbox up [project] [options]

Arguments:
  project          Project name (optional)

Options:
  --editor, -e     Open in editor after start (skip prompt)
  --attach, -a     Attach to shell after start (skip prompt)
  --rebuild, -r    Force container rebuild
  --no-prompt      Non-interactive mode (use defaults, fail if missing)
  --verbose, -v    Show detailed output
```

### Project Resolution Order

1. If `project` argument provided → use it
2. If current directory is inside `~/.devbox/Projects/<name>` → use that project
3. Otherwise → show interactive list from `devbox list`

## Main Workflow

### Step 1 - Resolve Project

- Find project in config, get local path
- If not found → error: "Project not found. Run `devbox list` to see available projects."

### Step 2 - Ensure Sync

- Check if mutagen session is active for this project
- If stopped → start it automatically
- If missing → error: "No sync session. Run `devbox clone` first."

### Step 3 - Check Container Status

- Query if a container for this project is already running
- If running → prompt: "Container already running. Restart it?" (Yes/No)
  - Yes → stop existing, continue to Step 4
  - No → skip to Step 5 (post-start options)

### Step 4 - Start Container

- Check for `.devcontainer/devcontainer.json`
  - Missing locally → check remote, trigger sync wait
  - Still missing → offer template creation
- Run `devcontainer up` in background
- On failure → retry once automatically
- On second failure → show error, exit

### Step 5 - Post-Start Options

Prompt: "What would you like to do?"

- Open in editor
- Attach to shell
- Both
- Neither (just exit)

## Devcontainer Templates

When `.devcontainer/devcontainer.json` is missing (after checking remote):

```
No devcontainer.json found. Would you like to create one?

> Node.js (node:20, npm/yarn)
  Python (python:3.12, pip/venv)
  Go (golang:1.22)
  Generic (debian, basic dev tools)
  No, I'll set it up myself
```

### Template Contents

Each template creates `.devcontainer/devcontainer.json` with:

- Base image for the stack
- Common extensions (language-specific)
- Basic `postCreateCommand` for dependency install
- Workspace folder mount

### Example Node Template

```json
{
  "name": "Node.js",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "postCreateCommand": "npm install",
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint"]
    }
  }
}
```

### After Creation

- Commit the new file to git locally
- Sync will push it to remote
- Continue with container startup

## Editor Selection & Management

### First-Time Flow

```
Which editor would you like to use?

> VS Code
  Cursor
  VS Code Insiders
  Other (specify command)

[User picks Cursor]

Make Cursor your default editor for future sessions? (Y/n)
```

### Subsequent Runs

- Uses saved default silently
- Opens directly without prompting

### Storage

- Add `defaultEditor` field to `~/.devbox/config.yaml`
- Values: `code`, `cursor`, `code-insiders`, or custom command

### `devbox editor` Command

```
devbox editor

Current default: Cursor

> VS Code
  Cursor (current)
  VS Code Insiders
  Other (specify command)

Default editor updated to VS Code.
```

### Opening in Editor

- Uses `devcontainer open` with the appropriate editor flag
- Or falls back to direct command: `cursor /path/to/project`

## Error Handling

### Container Start Failure

```
Starting container...
Container failed to start. Retrying...
Container failed to start after retry.

Error: devcontainer build failed
[truncated error output]

Run with --verbose for full logs.
```

### Sync Not Running

```
Sync session paused. Starting sync...
Sync resumed. Starting container...
```

### Project Not Cloned

```
Error: Project "myproject" not found locally.
Run `devbox clone myproject` to sync it first.
```

### Docker Not Running

```
Error: Docker is not running.
Please start Docker Desktop and try again.
```

### Non-Interactive Mode (`--no-prompt`)

- Uses default editor if set, otherwise skips editor
- If container running, continues without restart
- If no devcontainer.json, fails with error (no template prompt)
- Useful for scripting: `devbox up myproject --no-prompt --editor`

## New Commands

### `devbox editor`

Change the default editor preference at any time.

```
devbox editor
```

Shows current default and allows selection of a new one.

## Summary

The `devbox up` command provides a smooth workflow for starting development containers:

1. **Resolve project** - from argument, current directory, or interactive list
2. **Ensure sync** - verify/start mutagen session automatically
3. **Handle running containers** - ask to restart or continue
4. **Check devcontainer.json** - fetch from remote if missing, offer templates if truly absent
5. **Start container** - with auto-retry on failure
6. **Post-start options** - editor, shell, both, or neither
7. **Learn editor preference** - ask once, remember, changeable via `devbox editor`
