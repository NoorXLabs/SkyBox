# devbox list

List projects available on your local machine.

## Usage

```bash
devbox list
```

## Arguments

This command takes no arguments.

## Options

This command has no options.

## Description

The `list` command shows all projects in your local DevBox projects directory (`~/.devbox/Projects`). For each project, it displays:

- Project name
- Current git branch
- Local path

This gives you a quick overview of what projects are available to work on locally.

### Output Format

Projects are displayed with their details:

```
Local projects:

  my-api
    Branch: main
    Path: /Users/you/.devbox/Projects/my-api

  frontend-app
    Branch: feature/new-ui
    Path: /Users/you/.devbox/Projects/frontend-app

Run 'devbox up <project>' to start working.
```

If no projects exist locally:

```
No local projects yet.
Run 'devbox clone <project>' or 'devbox push ./path' to get started.
```

## Examples

```bash
# List all local projects
devbox list

# Then start one
devbox up my-api
```

### Workflow Example

```bash
# Check what's available locally
devbox list

# Output:
# Local projects:
#
#   my-api
#     Branch: main
#     Path: /Users/you/.devbox/Projects/my-api

# Start working on it
devbox up my-api --editor
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (DevBox not configured) |

## See Also

- [devbox browse](/reference/browse) - List projects on remote server
- [devbox up](/reference/up) - Start a project
- [devbox status](/reference/status) - Show detailed project status
- [devbox clone](/reference/clone) - Clone a project from remote
