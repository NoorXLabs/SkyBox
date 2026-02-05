# skybox list

List projects available on your local machine.

## Usage

```bash
skybox list
```

## Arguments

This command takes no arguments.

## Options

This command has no options.

## Description

The `list` command shows all projects in your local SkyBox projects directory (`~/.skybox/Projects`). For each project, it displays:

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
    Path: /Users/you/.skybox/Projects/my-api

  frontend-app
    Branch: feature/new-ui
    Path: /Users/you/.skybox/Projects/frontend-app

Run 'skybox up <project>' to start working.
```

If no projects exist locally:

```
No local projects yet.
Run 'skybox clone <project>' or 'skybox push ./path' to get started.
```

## Examples

```bash
# List all local projects
skybox list

# Then start one
skybox up my-api
```

### Workflow Example

```bash
# Check what's available locally
skybox list

# Output:
# Local projects:
#
#   my-api
#     Branch: main
#     Path: /Users/you/.skybox/Projects/my-api

# Start working on it
skybox up my-api --editor
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (SkyBox not configured) |

## See Also

- [skybox browse](/reference/browse) - List projects on remote server
- [skybox up](/reference/up) - Start a project
- [skybox status](/reference/status) - Show detailed project status
- [skybox clone](/reference/clone) - Clone a project from remote
