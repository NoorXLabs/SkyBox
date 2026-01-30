# devbox new

Create a new project on the remote server.

## Usage

```bash
devbox new
```

## Arguments

This command takes no arguments. It runs interactively.

## Options

This command has no options. All configuration is done through interactive prompts.

## Description

The `new` command creates a new project directly on your remote server. This is useful when you want to start fresh rather than pushing an existing local project.

The command walks you through:

1. **Remote Selection** - Choose which remote server to create the project on
2. **Project Name** - Enter a valid project name
3. **Project Type** - Choose between empty project or template
4. **Template Selection** - If using a template, choose from built-in or custom
5. **Clone Option** - Optionally clone the new project locally
6. **Encryption** - If default encryption is enabled, optionally enable encryption for the new project

### Project Naming Rules

Project names must:
- Contain only letters, numbers, hyphens, and underscores
- Not start with a hyphen or underscore
- Not already exist on the selected remote

### Project Types

**Empty Project:**
Creates a minimal project directory with just a `devcontainer.json`:

```
my-project/
└── .devcontainer/
    └── devcontainer.json
```

**From Template:**
Clones a git repository to create the project. You can:
- Use built-in starter templates (Node.js, Bun, Python, Go)
- Use custom templates from your config
- Enter any git URL

## Examples

```bash
# Start the interactive wizard
devbox new
```

### Example Session

```
─── Create a new project ───

? Select remote: production
? Project name: my-new-api
  Checking remote... Name available
? How would you like to create this project?
  > Empty project (with devcontainer.json)
    From a template

Creating project on remote... done

? Clone this project locally now? (Y/n)
```

### Creating from Template

```
? How would you like to create this project?
    Empty project (with devcontainer.json)
  > From a template

? Select a template:
  ──── Built-in ────
    Node.js Starter
    Bun Starter
    Python Starter
    Go Starter
  ──── Custom ────
    my-company-template
  ────────────────
    Enter git URL...

Cloning template to remote... done
```

### Using Custom Git URL

```
? Select a template: Enter git URL...
? Git repository URL: https://github.com/org/template-repo.git
? Git history:
  > Start fresh (recommended)
    Keep original history

Cloning template to remote... done
```

## Built-in Templates

| Template | Description |
|----------|-------------|
| Node.js Starter | Node.js 20 with npm, ESLint, devcontainer |
| Bun Starter | Bun runtime with TypeScript |
| Python Starter | Python 3.12 with pip, venv |
| Go Starter | Go 1.22 with standard tooling |

All templates include:
- Proper devcontainer.json configuration
- Docker-outside-of-Docker support
- SSH passthrough for git operations
- Language-specific VS Code extensions

## Custom Templates

You can configure custom templates in `~/.devbox/config.yaml`:

```yaml
templates:
  my-company-template: https://github.com/myorg/template.git
  react-starter: https://github.com/myorg/react-template.git
```

These appear in the template selection menu under "Custom".

## Git History Options

When using a custom git URL:

**Start fresh (recommended):**
- Removes the original `.git` directory
- Initializes a new git repository
- Your project starts with a clean history

**Keep original history:**
- Preserves the template's full git history
- Useful for forking an existing project

## After Creation

After creating a project, you're prompted to clone it locally:

```
? Clone this project locally now? (Y/n)
```

- **Yes** - Runs `devbox clone <project>` to sync locally
- **No** - Project exists only on remote; clone later with `devbox clone`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (project exists, clone failed, no config) |

## See Also

- [devbox clone](/reference/clone) - Clone project from remote
- [devbox push](/reference/push) - Push existing project to remote
- [devbox browse](/reference/browse) - List projects on remote
- [devbox remote](/reference/remote) - Manage remote servers
