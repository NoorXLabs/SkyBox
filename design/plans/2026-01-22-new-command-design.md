# Design: `devbox new` Command

Create a new project on the remote server.

## Command Overview

```
devbox new
```

Fully interactive wizard - no command-line arguments.

## User Flow

1. **Prompt for project name** - Text input, validated for allowed characters
2. **Check remote** - If name exists, show error and re-prompt
3. **Choose project type:**
   - Empty project (with devcontainer.json)
   - From template
4. **If template selected:**
   - Show list: built-in + user's saved templates + "Enter git URL"
   - If git URL entered: ask "Keep git history or start fresh?"
5. **Create on remote** - Execute creation via SSH
6. **Offer local clone** - "Clone this project locally now?"

## Template System

### Built-in Templates

Hardcoded git repo URLs pointing to a templates repository:

- `node` - Node.js starter
- `python` - Python starter
- `go` - Go starter
- `bun` - Bun starter

### User-defined Templates

Users add custom templates to their DevBox config file:

```yaml
# ~/.config/devbox/config.yaml
templates:
  react: https://github.com/user/react-template
  rust: https://github.com/user/rust-template
  work-api: https://gitlab.company.com/templates/api
```

### Template Selection Prompt

```
? Select a template:
  ──── Built-in ────
  node
  python
  go
  bun
  ──── Custom ────
  react
  rust
  work-api
  ────────────────
  Enter git URL...
```

## Project Creation

### Empty Project

Creates:

```
my-project/
└── .devcontainer/
    └── devcontainer.json
```

With minimal `devcontainer.json`:

```json
{
  "name": "my-project",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu"
}
```

### Template Project

1. Clone the template repo to a temp location on remote
2. If "start fresh" selected: remove `.git` directory, run `git init`
3. If "keep history" selected: leave `.git` intact
4. Move files to the project directory
5. If no `.devcontainer/devcontainer.json` exists in template, add the default one

### Remote Location

Projects are created in the same directory structure that `browse` and `clone` expect (existing remote project path configuration).

## Error Handling

### Project Name Validation

- Must be non-empty
- Only alphanumeric, hyphens, underscores (no spaces or special chars)
- Show clear error and re-prompt if invalid

### Name Already Exists

- Check remote before creation
- "A project named 'my-project' already exists. Please choose a different name."
- Re-prompt for name

### Git Clone Failures

- "Failed to clone template: <git error message>"
- Offer to retry or go back to template selection

### SSH/Remote Connection Failures

- Use existing DevBox error handling patterns
- "Could not connect to remote server. Check your connection and try again."

### No Remote Configured

- "No remote server configured. Run 'devbox init' first."

## Implementation Structure

### New Files

```
src/commands/new.ts          # Main command logic
src/lib/templates.ts         # Template fetching and processing
```

### Changes to Existing Files

- `src/index.ts` - Register the new command
- `src/types/index.ts` - Add template-related types
- Config schema - Add `templates` field for user-defined templates

### Key Functions

```typescript
// src/commands/new.ts
newCommand()           // Main entry point, orchestrates the flow

// src/lib/templates.ts
getBuiltInTemplates()  // Returns hardcoded template URLs
getUserTemplates()     // Reads from config file
cloneTemplate()        // Clones repo to remote, handles git history option
createEmptyProject()   // Creates directory + devcontainer.json
```

### Dependencies

- Uses existing: SSH, config, Inquirer prompts, error handling
- No new external dependencies needed

## Testing

### Unit Tests (`src/commands/__tests__/new.test.ts`)

- Project name validation
- Template list merging (built-in + user-defined)
- Config parsing for user templates

### Integration Tests

- Full flow with mocked SSH/remote
- Empty project creation
- Template cloning (with/without git history)
- Error cases (name exists, clone fails)

### Manual Testing Scenarios

- Create empty project, verify devcontainer.json
- Create from built-in template
- Create from git URL
- Add custom template to config, verify it appears
- Clone locally after creation
