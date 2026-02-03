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
- Lock status (who currently has the project locked, if anyone)

This is useful for discovering what projects are available to clone and seeing who's currently working on what.

### Remote Connection

The command uses SSH to connect to the remote server configured during `devbox init`. It runs a script on the remote to enumerate directories, their git status, and lock file information.

### Output Format

Projects are displayed in a table with name, branch, and lock status:

```
Remote projects (my-server:~/code):

  NAME           BRANCH           LOCK
  my-api         main             locked (bobs-macbook)
  frontend-app   feature/new-ui   unlocked
  data-service   develop          locked (you)

Run 'devbox clone <project>' to clone a project locally.
```

Lock status values:
- `unlocked` — No one is working on this project
- `locked (you)` — You have the lock on this project
- `locked (<machine>)` — Another machine has the lock

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
#   NAME              BRANCH              LOCK
#   awesome-project   main                unlocked
#   another-project   feature/cool-stuff  locked (alice-mbp)

# Clone an unlocked project to work on it
devbox clone awesome-project

# Start the container (acquires lock)
devbox up awesome-project
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (not configured, SSH connection failed) |

## See Also

- [devbox locks](/reference/locks) - Show only lock statuses for all projects
- [devbox clone](/reference/clone) - Clone a project from remote
- [devbox push](/reference/push) - Push a local project to remote
- [devbox list](/reference/list) - List local projects
- [devbox init](/reference/init) - Configure remote server
