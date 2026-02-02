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
| `--no-prompt` | Non-interactive mode (errors instead of prompting) |
| `--verbose` | Show detailed error output on container start failure |
| `-A, --all` | Start all local projects in batch mode (tallies success/failure counts) |

## Description

The `up` command starts a development container for the specified project. It performs the following steps:

1. **Project Resolution** - Determines which project to start (from argument, current directory, or interactive selection)
2. **Lock Acquisition** - Acquires a lock to prevent conflicts with other machines
3. **Archive Decryption** - If encryption is enabled, decrypts the project archive on the remote
4. **Sync Check** - Ensures the Mutagen sync session is active, resuming it if paused
5. **Container Management** - Starts the container (or handles existing running containers)
6. **Devcontainer Setup** - Creates devcontainer.json from templates if needed
7. **Post-Start Actions** - Optionally opens editor or attaches to shell

### Project Auto-Detection

When no project argument is given, DevBox resolves the project in this order:

1. Checks if the current working directory is inside a known project
2. Prompts with a multi-select checkbox to start one or more projects at once (unless `--no-prompt` is set)

### Lock System

DevBox uses a lock system to prevent simultaneous editing from multiple machines. When starting a project:

- If the lock is free, it is acquired automatically
- If another machine holds the lock, you are prompted to take it over
- With `--no-prompt`, a lock conflict causes an error instead of a takeover prompt
- If the project has no configured remote, the lock step is skipped

### Archive Decryption

If the project has encryption enabled and an encrypted archive exists on the remote server, DevBox will:

1. Prompt for your passphrase (up to 3 attempts)
2. Download the encrypted archive from the remote
3. Decrypt it locally using AES-256-GCM
4. Upload the decrypted files back to the remote
5. Extract and clean up

If decryption fails after 3 attempts, `devbox up` exits without starting the container. See [`devbox encrypt`](/reference/encryption) for more details.

### Sync Resume

If the Mutagen sync session exists but is paused (e.g., from a previous `devbox down`), it is automatically resumed during startup.

### Container Auto-Rebuild

If the container fails to start on the first attempt, DevBox automatically retries with a full rebuild. If the rebuild also fails, the error is displayed. Use `--verbose` to see the full error output.

### Devcontainer Templates

If no `.devcontainer/devcontainer.json` exists, DevBox offers to create one using the unified template selector. You can choose from built-in templates, your custom local templates stored in `~/.devbox/templates/`, or enter a git URL. See [Custom Templates](/reference/custom-templates) for details on creating and managing templates.

### Container States

If the container is already running, you can choose to:

- Continue with the existing container
- Restart the container
- Rebuild the container from scratch

### Post-Start Action Prompt

After the container starts, DevBox determines what to do next:

- If `-e` is passed: opens the configured editor
- If `-a` is passed: attaches to the container shell
- If both `-e` and `-a` are passed: opens editor then attaches shell
- If `--no-prompt` is passed: exits without further action
- Otherwise: prompts you to choose from editor, shell, both, or exit

### Multi-Project Start

When no project argument is given and multiple local projects exist, DevBox shows a checkbox to select one or more projects. Selected projects are started sequentially. After all projects start, you can choose to open all, choose specific ones, or skip.

### Batch Mode

With `-A, --all`, DevBox starts every local project sequentially and reports a summary of how many succeeded and how many failed.

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

# Show full error logs on failure
devbox up my-project --verbose

# Start all local projects
devbox up --all

# Multi-select start (no argument)
devbox up
# Shows checkbox to pick which projects to start

# Start from within project directory
cd ~/.devbox/Projects/my-project
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
- [Custom Templates](/reference/custom-templates) - Create and manage reusable templates
