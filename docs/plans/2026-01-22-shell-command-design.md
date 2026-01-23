# Shell Command Design

## Overview

The `devbox shell` command enters a running dev container's shell for direct interaction with the development environment.

## CLI Interface

```bash
# Interactive shell (default)
devbox shell <project>

# Run a single command and exit
devbox shell <project> -c "npm test"
devbox shell <project> --command "git status"
```

## Behavior

- **Lock required:** User must hold the project lock to enter the shell
- **Container not running:** Prompts user whether to start it (runs `devbox up` if confirmed)
- **Shell selection:** Uses shell from devcontainer.json, falls back to container default
- **Working directory:** Starts in the project's workspace directory

## Command Flow

```
devbox shell <project>
        │
        ▼
┌─────────────────────┐
│ Validate project    │ → Error if project doesn't exist locally
│ exists locally      │
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Check lock status   │ → Error if another machine holds the lock
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ Check container     │
│ running?            │
└────────┬────────────┘
         │
    No ──┴── Yes
    │         │
    ▼         │
┌─────────────┐│
│ Prompt:     ││
│ Start it?   ││
└─────┬───────┘│
      │        │
  Yes─┴─No     │
  │     │      │
  ▼     ▼      │
[up]  [exit]   │
  │            │
  └────────────┘
         │
         ▼
┌─────────────────────┐
│ Get workspace path  │ (from devcontainer.json or default)
│ Get shell           │ (from devcontainer.json or default)
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ docker exec -it     │ (interactive or with -c command)
└─────────────────────┘
```

## Implementation

### New File: `src/commands/shell.ts`

**Main function:** `shellCommand(project: string, options: { command?: string })`

1. Validate project exists locally
2. Check lock ownership (error if another machine holds it)
3. Check container status
4. If not running, prompt to start (call `devbox up` if confirmed)
5. Read devcontainer.json for shell and workspace path
6. Execute docker command

**Helper functions:**

- `getContainerShell(projectPath: string): string` - Read shell from devcontainer.json, fall back to `/bin/sh`
- `getWorkspacePath(projectPath: string): string` - Read workspace folder from devcontainer.json, fall back to `/workspaces/<project-name>`

### Docker Command

```typescript
// Interactive mode
docker exec -it -w /workspaces/myproject <container-name> /bin/bash

// Command mode (-c flag)
docker exec -w /workspaces/myproject <container-name> /bin/bash -c "npm test"
```

Key flags:
- `-it` - Interactive with TTY (only for interactive mode, omit for command mode)
- `-w` - Set working directory to workspace path

### Dependencies

- `lib/config.ts` - Read DevBox config
- `lib/container.ts` - Check container status, get container name
- `lib/project.ts` - Project validation utilities
- `lib/ssh.ts` - Check lock status on remote
- `commands/up.ts` - Reuse for starting container when needed

## Error Handling

| Scenario | Message |
|----------|---------|
| Project not found locally | "Project 'foo' not found. Run `devbox clone foo` first." |
| Lock held by another machine | "Project 'foo' is locked by machine 'work-laptop'. Run `devbox handoff` on that machine first." |
| User declines to start container | Exit cleanly with no error |
| Container start fails | Show the error from `devbox up` |
| Docker exec fails | "Failed to enter shell: <docker error>" |

## Testing

### Unit Tests: `src/commands/__tests__/shell.test.ts`

1. **Project validation** - Errors when project doesn't exist
2. **Lock checking** - Errors when another machine holds lock
3. **Container not running** - Prompts user, starts if confirmed
4. **Container not running, user declines** - Exits cleanly
5. **Shell detection** - Reads from devcontainer.json correctly
6. **Workspace path** - Uses devcontainer.json or falls back to default
7. **Command mode** - Passes `-c` flag correctly to docker exec
8. **Interactive mode** - Uses `-it` flags

### Mocking Approach

- Mock `lib/container.ts` for container status checks
- Mock `lib/ssh.ts` for lock status
- Mock `execa` for docker exec calls
- Mock `inquirer` for prompt responses

## Files to Create/Modify

- `src/commands/shell.ts` (new)
- `src/commands/__tests__/shell.test.ts` (new)
- `src/index.ts` (register command)
