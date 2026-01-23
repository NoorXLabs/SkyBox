# devbox up

Start a development container for a project.

## Usage

```bash
devbox up [project] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[project]` | Name of the project to start. If omitted, DevBox will try to detect the project from the current directory or prompt for selection. |

## Options

| Option | Description |
|--------|-------------|
| `-e, --editor` | Open in editor after container starts |
| `-a, --attach` | Attach to shell after container starts |
| `-r, --rebuild` | Force container rebuild |
| `--no-prompt` | Non-interactive mode (fails if input would be required) |
| `--verbose` | Show detailed output on errors |

## Description

The `up` command starts a development container for the specified project. It performs the following steps:

1. **Project Resolution** - Determines which project to start (from argument, current directory, or interactive selection)
2. **Lock Acquisition** - Acquires a lock to prevent conflicts with other machines
3. **Sync Check** - Ensures the Mutagen sync session is active
4. **Container Management** - Starts the container (or handles existing running containers)
5. **Devcontainer Setup** - Creates devcontainer.json from templates if needed
6. **Post-Start Actions** - Optionally opens editor or attaches to shell

### Lock System

DevBox uses a lock system to prevent simultaneous editing from multiple machines. If another machine holds the lock, you'll be prompted to take it over (which notifies the other machine).

### Devcontainer Templates

If no `.devcontainer/devcontainer.json` exists, DevBox offers to create one from built-in templates for common development environments.

### Container States

If the container is already running, you can choose to:

- Continue with the existing container
- Restart the container
- Rebuild the container from scratch

## Examples

```bash
# Start a specific project
devbox up my-project

# Start project and open in editor
devbox up my-project --editor

# Start project and attach to shell
devbox up my-project --attach

# Start with both editor and shell
devbox up my-project -e -a

# Force rebuild the container
devbox up my-project --rebuild

# Non-interactive start (for scripts)
devbox up my-project --no-prompt

# Start from within project directory
cd ~/.devbox/projects/my-project
devbox up
```

### Workflow Example

```bash
# Clone a project from remote
devbox clone awesome-project

# Start working on it
devbox up awesome-project --editor

# Or do it all in one go (clone offers to start container)
devbox clone another-project
# Answer "yes" when prompted to start container
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (project not found, container failed to start, lock conflict in non-interactive mode) |

## See Also

- [devbox down](/reference/down) - Stop the container
- [devbox status](/reference/status) - Check container status
- [devbox clone](/reference/clone) - Clone a project from remote
- [devbox editor](/reference/editor) - Change default editor
