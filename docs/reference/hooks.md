# Hooks

Run custom shell commands before and after lifecycle operations.

## Overview

Hooks let you define shell commands that run automatically at key points during `devbox up` and `devbox down`. Hooks are configured per-project in your DevBox config file.

## Configuration

Add a `hooks` section to a project in `~/.devbox/config.yaml`:

```yaml
projects:
  my-app:
    remote: work
    hooks:
      pre-up: "echo 'Starting up...'"
      post-up: "npm run migrate"
      pre-down: "npm run cleanup"
      post-down: "echo 'Stopped.'"
```

## Hook Events

| Event | When it runs |
|-------|-------------|
| `pre-up` | Before the container starts during `devbox up` |
| `post-up` | After the container starts during `devbox up` |
| `pre-down` | Before the container stops during `devbox down` |
| `post-down` | After the container stops during `devbox down` |

## Syntax

### Simple (string)

A single shell command:

```yaml
hooks:
  post-up: "npm run db:migrate"
```

### Multiple commands (array)

An array of hook entries:

```yaml
hooks:
  post-up:
    - command: "npm run db:migrate"
    - command: "npm run seed"
```

Each entry supports:

| Field | Required | Description |
|-------|----------|-------------|
| `command` | Yes | Shell command to execute |
| `context` | No | Execution context: `host` (default) or `container` (not yet supported) |

## Behavior

- Hooks run on the **host machine** in the project directory
- Hooks are **non-fatal** — if a hook fails, a warning is shown but the operation continues
- Multiple hooks for the same event run **sequentially** in order
- Hook output is captured and displayed if the hook fails
- A one-time security warning is shown the first time hooks execute in a session

::: tip Suppress Warning
Set `DEVBOX_HOOK_WARNINGS=0` to disable the one-time hook security warning.
:::

::: warning Security
Hook commands execute with full shell access on your host machine. Only define hooks in trusted configuration files. Review hooks before running `devbox up` or `devbox down` on shared configs.
:::

## Examples

```yaml
projects:
  my-api:
    remote: work
    hooks:
      # Run database migrations after starting
      post-up: "docker exec devbox-my-api npm run migrate"

      # Back up database before stopping
      pre-down: "docker exec devbox-my-api npm run db:backup"

  frontend:
    remote: work
    hooks:
      # Multiple post-up hooks
      post-up:
        - command: "open http://localhost:3000"
        - command: "echo 'Frontend ready!'"
```

## See Also

- [devbox up](/reference/up) - Start a development container
- [devbox down](/reference/down) - Stop a development container
- [Configuration](/reference/configuration) - DevBox config reference
