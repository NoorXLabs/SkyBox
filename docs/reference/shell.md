---
title: skybox shell
description: Access an interactive shell inside a running container with skybox shell. Execute commands in your dev environment.
---

# skybox shell

Access an interactive shell inside a running container.

<!-- COMMAND-SPEC:START -->
## Usage

```bash
skybox shell [options] <project>
```

## Arguments

| Argument | Description |
|----------|-------------|
| `<project>` | Project name. |

## Options

| Option | Description |
|--------|-------------|
| `-c, --command <cmd>` | Run a single command and exit |
| `-f, --force` | Bypass session check |

## Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | display help for command |
| `-v, --version` | output the version number |
| `--dry-run` | Preview commands without executing them |
<!-- COMMAND-SPEC:END -->

## Description

The `shell` command provides interactive shell access to a running development container. It performs the following steps:

1. **Configuration Check** - Verifies SkyBox is configured
2. **Project Verification** - Checks the project exists locally
3. **Session Check** - Verifies session status before allowing access
4. **Container Status** - Checks if container is running
5. **Auto-Start** - Offers to start the container if not running
6. **Shell Attach** - Opens an interactive shell inside the container

### Session Check

Before attaching, `skybox shell` checks the project's session status:

- If the project has an active session on **another machine**, the command warns you and shows which machine has the session. Use `--force` to bypass this check.
- If **no session exists**, a warning is shown recommending you run `skybox up` first to start a session for safe editing.
- If the session belongs to **your machine**, the command proceeds normally.

Use `-f, --force` to skip the session check entirely (e.g., for quick read-only inspection).

### Interactive Mode

By default, `skybox shell` opens an interactive `/bin/sh` session inside the container. The working directory is set to the `workspaceFolder` from `devcontainer.json` (defaults to `/workspaces/<project>` if not specified).

### Command Mode

With the `-c` flag, you can run a single command and exit. The exit code from the command is propagated back to your shell.

### Container Auto-Start

If the container is not running, you'll be prompted:

```
Container is not running. Start it now? (Y/n)
```

Choosing **yes** runs `skybox up` with `--no-prompt` to start the container before attaching to the shell.

## Examples

```bash
# Open interactive shell
skybox shell my-project

# Run a single command
skybox shell my-project -c "npm run build"

# Check Node version inside container
skybox shell my-project -c "node --version"

# Run tests inside container
skybox shell my-project -c "npm test"

# Bypass session check for quick inspection
skybox shell my-project --force

# Interactive shell for debugging
skybox shell my-project
# Then inside: ls -la, cat package.json, etc.
```

### Workflow Example

```bash
# Start a project
skybox up my-project

# Open shell to run commands
skybox shell my-project
# Inside container:
# $ npm install
# $ npm run dev
# Press Ctrl+D to exit

# Or run commands directly
skybox shell my-project -c "npm install && npm run build"
```

### Difference from `skybox up --attach`

| Command | Behavior |
|---------|----------|
| `skybox up --attach` | Starts container + creates session + attaches shell |
| `skybox shell` | Checks session + attaches to existing/started container |

Use `skybox shell` when:
- Container is already running
- You just want shell access without the full startup flow
- You want to run a quick command

Use `skybox up --attach` when:
- Starting a work session
- You need a session created
- Container might not be running

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (interactive mode exited cleanly) |
| 1 | Error (project not found, container failed to start, session active on another machine) |
| * | Command exit code (when using `-c` flag) |

## See Also

- [skybox up](/reference/up) - Start the container
- [skybox down](/reference/down) - Stop the container
- [skybox status](/reference/status) - Check container status
