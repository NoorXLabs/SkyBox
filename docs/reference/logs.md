# devbox logs

Show container or sync logs for a project.

## Usage

```bash
devbox logs <project> [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `<project>` | Name of the project (required) |

## Options

| Option | Description |
|--------|-------------|
| `-f, --follow` | Follow log output in real time |
| `-n, --lines <number>` | Number of lines to show (default: `50`) |
| `-s, --sync` | Show sync logs instead of container logs |

## Description

The `logs` command has two modes depending on whether the `--sync` flag is provided:

### Container Logs (default)

By default, `devbox logs` shows Docker container logs for the project. It looks up the running container by project path and passes the request to `docker logs`. The `--follow` and `--lines` options are forwarded to Docker.

If no container is found for the project, an error is displayed.

### Sync Logs (`--sync`)

When the `--sync` flag is provided, the command shows Mutagen sync session activity instead. It runs `mutagen sync monitor` filtered to the session matching the project name. This is useful for diagnosing file synchronization issues.

Note: In sync mode, the `--follow` and `--lines` options are not used; Mutagen's monitor streams output continuously by default.

## Examples

```bash
# Show last 50 lines of container logs
devbox logs my-project

# Follow container logs in real time
devbox logs my-project --follow

# Show last 200 lines
devbox logs my-project --lines 200

# Show sync session activity
devbox logs my-project --sync
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (project not found, container not running, log retrieval failed) |

## See Also

- [devbox up](/reference/up) - Start a project container
- [devbox down](/reference/down) - Stop a project container
- [devbox status](/reference/status) - Check project status
