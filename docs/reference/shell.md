# devbox shell

Access an interactive shell inside a running container.

## Usage

```bash
devbox shell <project> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `<project>` | Name of the project to access (required) |

## Options

| Option | Description |
|--------|-------------|
| `-c, --command <cmd>` | Run a single command and exit instead of interactive shell |
| `-f, --force` | Bypass lock check (use with caution) |

## Description

The `shell` command provides interactive shell access to a running development container. It performs the following steps:

1. **Configuration Check** - Verifies DevBox is configured
2. **Project Verification** - Checks the project exists locally
3. **Lock Check** - Verifies lock status before allowing access
4. **Container Status** - Checks if container is running
5. **Auto-Start** - Offers to start the container if not running
6. **Shell Attach** - Opens an interactive shell inside the container

### Lock Check

Before attaching, `devbox shell` checks the project's lock status:

- If the project is locked by **another machine**, the command errors out with a message showing which machine holds the lock. Use `--force` to bypass this check.
- If **no lock is held** at all, a warning is shown recommending you run `devbox up` first to acquire a lock for safe editing.
- If the lock is held by **your machine**, the command proceeds normally.

Use `-f, --force` to skip the lock check entirely (e.g., for quick read-only inspection).

### Interactive Mode

By default, `devbox shell` opens an interactive `/bin/sh` session inside the container. The working directory is set to the `workspaceFolder` from `devcontainer.json` (defaults to `/workspaces/<project>` if not specified).

### Command Mode

With the `-c` flag, you can run a single command and exit. The exit code from the command is propagated back to your shell.

### Container Auto-Start

If the container is not running, you'll be prompted:

```
Container is not running. Start it now? (Y/n)
```

Choosing **yes** runs `devbox up` with `--no-prompt` to start the container before attaching to the shell.

## Examples

```bash
# Open interactive shell
devbox shell my-project

# Run a single command
devbox shell my-project -c "npm run build"

# Check Node version inside container
devbox shell my-project -c "node --version"

# Run tests inside container
devbox shell my-project -c "npm test"

# Bypass lock check for quick inspection
devbox shell my-project --force

# Interactive shell for debugging
devbox shell my-project
# Then inside: ls -la, cat package.json, etc.
```

### Workflow Example

```bash
# Start a project
devbox up my-project

# Open shell to run commands
devbox shell my-project
# Inside container:
# $ npm install
# $ npm run dev
# Press Ctrl+D to exit

# Or run commands directly
devbox shell my-project -c "npm install && npm run build"
```

### Difference from `devbox up --attach`

| Command | Behavior |
|---------|----------|
| `devbox up --attach` | Starts container + acquires lock + attaches shell |
| `devbox shell` | Checks lock + attaches to existing/started container |

Use `devbox shell` when:
- Container is already running
- You just want shell access without the full startup flow
- You want to run a quick command

Use `devbox up --attach` when:
- Starting a work session
- You need the lock acquired
- Container might not be running

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (interactive mode exited cleanly) |
| 1 | Error (project not found, container failed to start, lock held by another machine) |
| * | Command exit code (when using `-c` flag) |

## See Also

- [devbox up](/reference/up) - Start the container
- [devbox down](/reference/down) - Stop the container
- [devbox status](/reference/status) - Check container status
