# Command Reference

DevBox provides a set of commands for managing your development environments.

## Commands Overview

| Command | Description |
|---------|-------------|
| [`devbox init`](/reference/init) | Initialize a new development environment |
| [`devbox up`](/reference/up) | Start the development container |
| [`devbox down`](/reference/down) | Stop the development container |
| [`devbox status`](/reference/status) | Show container status |
| [`devbox shell`](/reference/shell) | Open a shell in the container |
| [`devbox new`](/reference/new) | Create a new environment from template |
| [`devbox list`](/reference/list) | List available containers |
| [`devbox clone`](/reference/clone) | Clone an environment configuration |
| [`devbox push`](/reference/push) | Push environment to registry |

## Global Options

All commands support these global options:

```bash
--help, -h     Show help for a command
--version, -v  Show DevBox version
```

## Configuration

DevBox uses a `devbox.yaml` file for environment configuration. See [Configuration Reference](/reference/configuration) for details.
