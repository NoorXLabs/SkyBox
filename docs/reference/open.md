# devbox open

Open editor or shell for a running container without restarting it.

## Usage

```bash
devbox open [project] [options]
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

## Description

The `open` command provides quick access to a running container's editor or shell without going through the full `devbox up` workflow. It's designed for when you already have a container running and just want to:

- Open another editor window
- Attach a new shell session
- Quickly jump into a project that's already up

### Key Differences from `devbox up`

| Command | Behavior |
|---------|----------|
| `devbox up` | Acquires lock, resumes sync, starts container if needed, then opens editor/shell |
| `devbox open` | Only works with running containers, just opens editor/shell |

Use `devbox open` when:
- Container is already running
- You want quick access without lock/sync checks
- You need multiple editor windows or shell sessions

Use `devbox up` when:
- Starting a work session
- Container might not be running
- You need the full startup flow (lock, sync, container start)

### Action Menu

Without flags, `devbox open` presents the same action menu as `devbox up`:

```
? What would you like to do?
  1) Open in editor
  2) Attach to shell
  3) Both
  4) Neither (just exit)
```

### Container Must Be Running

Unlike `devbox up`, the `open` command requires the container to already be running:

```bash
$ devbox open my-project
Error: Container for 'my-project' is not running.
  i Run 'devbox up' to start the container first.
```

## Examples

```bash
# Open action menu for a running project
devbox open my-project

# Open editor only (no prompts)
devbox open my-project --editor

# Attach to shell only
devbox open my-project --shell

# Open both editor and shell
devbox open my-project --editor --shell

# Auto-detect project from current directory
cd ~/.devbox/projects/my-project
devbox open

# Non-interactive mode (does nothing if no flags)
devbox open my-project --no-prompt --editor
```

### Workflow Example

```bash
# Start your work session
devbox up my-project --editor

# Later, need another shell window
devbox open my-project --shell

# Or open in a different editor
devbox open my-project --editor
```

### Multiple Sessions

Open multiple shells for the same running container:

```bash
# Terminal 1: Main development
devbox up my-project --attach

# Terminal 2: Run tests
devbox open my-project --shell

# Terminal 3: Watch logs
devbox open my-project --shell
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (not configured, project not found, container not running) |

## See Also

- [devbox up](/reference/up) - Start container with full workflow
- [devbox shell](/reference/shell) - Direct shell access with auto-start option
- [devbox status](/reference/status) - Check if container is running
