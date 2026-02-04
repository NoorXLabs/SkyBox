# devbox browse

List projects available on the remote server.

## Usage

```bash
devbox browse
```

## Arguments

This command takes no arguments.

## Options

This command has no options.

## Description

The `browse` command connects to your configured remote server and lists all projects in the configured base path. If multiple remotes are configured, you'll be prompted to select which remote to browse. For each project, it shows:

- Project name (directory name)
- Current git branch (if it's a git repository)

This is useful for discovering what projects are available to clone.

### Remote Connection

The command uses SSH to connect to the remote server configured during `devbox init`. It runs a script on the remote to enumerate directories and their git status.

### Output Format

Projects are displayed in a table with name and branch:

```
Remote projects (my-server:~/code):

  NAME           BRANCH
  my-api         main
  frontend-app   feature/new-ui
  data-service   develop

Run 'devbox clone <project>' to clone a project locally.
```

If no projects exist on the remote:

```
No projects found on remote.
Run 'devbox push ./my-project' to push your first project.
```

## Examples

```bash
# List all remote projects
devbox browse

# Then clone one
devbox clone my-api
```

### Workflow Example

```bash
# Check what's available on remote
devbox browse

# Output:
# Remote projects (my-server:~/code):
#
#   NAME              BRANCH
#   awesome-project   main
#   another-project   feature/cool-stuff

# Clone a project to work on it
devbox clone awesome-project

# Start the container (creates session)
devbox up awesome-project
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (not configured, SSH connection failed) |

## See Also

- [devbox clone](/reference/clone) - Clone a project from remote
- [devbox push](/reference/push) - Push a local project to remote
- [devbox list](/reference/list) - List local projects
- [devbox init](/reference/init) - Configure remote server
