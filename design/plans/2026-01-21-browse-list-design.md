# Design: devbox browse and devbox list

> Quick commands to see what projects exist remotely and locally

## Overview

Two simple commands that show project listings:
- `devbox browse` - Lists projects on the remote server via SSH
- `devbox list` - Lists projects synced locally

Both use a "detailed cards" output format with minimal metadata (project name + git branch) for fast execution.

## Output Format

### devbox browse

```
Remote projects (hetzner-dev:~/code):

  myapp
    Branch: main

  backend
    Branch: develop

  experiments
    Branch: main

Run 'devbox clone <project>' to clone a project locally.
```

### devbox list

```
Local projects:

  myapp
    Branch: main
    Path: ~/.devbox/Projects/myapp

  backend
    Branch: develop
    Path: ~/.devbox/Projects/backend

Run 'devbox up <project>' to start working.
```

### Empty States

```
# devbox browse (no remote projects)
No projects found on remote.
Run 'devbox push ./my-project' to push your first project.

# devbox list (no local projects)
No local projects yet.
Run 'devbox clone <project>' or 'devbox push ./path' to get started.
```

## Implementation

### devbox browse

1. Load config to get remote host and base_path
2. Run single SSH command to get project info:
   ```bash
   ssh <host> 'for d in ~/code/*/; do
     name=$(basename "$d")
     branch=$(git -C "$d" branch --show-current 2>/dev/null || echo "-")
     echo "$name|$branch"
   done'
   ```
3. Parse pipe-delimited output
4. Format as cards
5. Show clone hint at bottom

### devbox list

1. Read directories in `~/.devbox/Projects/`
2. For each directory:
   - Get git branch via `git branch --show-current`
   - Build path string
3. Format as cards
4. Show hint at bottom

### File Structure

```
src/commands/
  ├── init.ts       (existing)
  ├── browse.ts     (new)
  └── list.ts       (new)
```

### CLI Registration (src/index.ts)

```typescript
program.command("browse")
  .description("List projects on remote server")
  .action(browseCommand);

program.command("list")
  .description("List local projects")
  .action(listCommand);
```

## Error Handling

### devbox browse

| Scenario | Behavior |
|----------|----------|
| No config file | Error: "devbox not configured. Run 'devbox init' first." |
| SSH connection fails | Error: "Failed to connect to remote. Check your SSH config." |
| Remote directory doesn't exist | Error: "Remote path ~/code doesn't exist." |

### devbox list

| Scenario | Behavior |
|----------|----------|
| No config file | Error: "devbox not configured. Run 'devbox init' first." |
| Projects directory doesn't exist | Treat as empty (show friendly message) |
| Git not initialized in a project | Show branch as "-" |

## UX Details

- `browse`: Show spinner "Fetching remote projects..." during SSH
- `list`: No spinner needed (local filesystem is fast)
- Use existing `ui.ts` helpers for consistent output

## Future Expansion

Easy to add later without changing the interface:
- Directory size (`du -sh`)
- Devcontainer present (check for `.devcontainer/`)
- Lock status (once lock module exists)
- Container status (once docker module exists)
- Sync status (once mutagen module exists)
- Color coding based on status

## Testing

- Unit tests with mocked SSH/filesystem
- Manual test against real remote server
