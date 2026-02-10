---
title: skybox logs
description: Show container or sync logs for a project with skybox logs. Stream Docker and Mutagen output for debugging.
---

# skybox logs

Show container or sync logs for a project.

<!-- COMMAND-SPEC:START -->
## Usage

```bash
skybox logs [options] <project>
```

## Arguments

| Argument | Description |
|----------|-------------|
| `<project>` | Project name. |

## Options

| Option | Description |
|--------|-------------|
| `-f, --follow` | follow log output |
| `-n, --lines <number>` | number of lines to show (default: 50) |
| `-s, --sync` | show sync logs instead of container logs |

## Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | display help for command |
| `-v, --version` | output the version number |
| `--dry-run` | Preview commands without executing them |
<!-- COMMAND-SPEC:END -->

## Description

The `logs` command has two modes depending on whether the `--sync` flag is provided:

### Container Logs (default)

By default, `skybox logs` shows Docker container logs for the project. It looks up the running container by project path and passes the request to `docker logs`. The `--follow` and `--lines` options are forwarded to Docker.

If no container is found for the project, an error is displayed.

### Sync Logs (`--sync`)

When the `--sync` flag is provided, the command shows Mutagen sync session activity instead. It runs `mutagen sync monitor` filtered to the session matching the project name. This is useful for diagnosing file synchronization issues.

Note: In sync mode, the `--follow` and `--lines` options are not used; Mutagen's monitor streams output continuously by default.

## Examples

```bash
# Show last 50 lines of container logs
skybox logs my-project

# Follow container logs in real time
skybox logs my-project --follow

# Show last 200 lines
skybox logs my-project --lines 200

# Show sync session activity
skybox logs my-project --sync
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (project not found, container not running, log retrieval failed) |

## See Also

- [skybox up](/reference/up) - Start a project container
- [skybox down](/reference/down) - Stop a project container
- [skybox status](/reference/status) - Check project status
