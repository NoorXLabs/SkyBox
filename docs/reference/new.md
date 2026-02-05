# skybox new

Create a new project on the remote server.

## Usage

```bash
skybox new
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
3. **Template Selection** - Choose a devcontainer template from the unified selector (built-in, git URL, or your custom templates)
4. **Clone Option** - Optionally clone the new project locally
5. **Encryption** - If default encryption is enabled, optionally enable encryption for the new project

### Project Naming Rules

Project names must:
- Contain only letters, numbers, hyphens, and underscores
- Not start with a hyphen or underscore
- Not already exist on the selected remote

### Template Selection

The unified template selector offers three types of templates:

- **Built-in templates** (Node.js, Python, Go, Generic) — creates an empty project with a devcontainer.json using that template's configuration
- **Your custom templates** — local devcontainer.json files stored in `~/.skybox/templates/`. See [Custom Templates](/reference/custom-templates) for details
- **Git URL** — clones a git repository to the remote as the project

When selecting a built-in or custom template, SkyBox creates the project directory on the remote, writes the devcontainer.json, and initializes a git repo. When using a git URL, SkyBox clones the repo instead.

## Examples

```bash
# Start the interactive wizard
skybox new
```

### Example Session

```
─── Create a new project ───

? Select remote: production
? Project name: my-new-api
  Checking remote... Name available
? Select a template:
── Built-in ──
  Node.js — Node.js (latest) with npm/yarn + Docker support
  Python — Python (latest) with pip/venv + Docker support
  Go — Go (latest) + Docker support
  Generic — Debian with basic dev tools + Docker support
── Other ──
  Enter git URL
── Your Templates ──
  bun
  Create new template

Creating project on remote... done

? Clone this project locally now? (Y/n)
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

## Templates

For details on built-in templates, custom local templates, and the template selector, see [Custom Templates](/reference/custom-templates).

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

- **Yes** - Syncs the project locally, then offers to start the dev container
- **No** - Project exists only on remote; clone later with `skybox clone`

If you choose to clone, SkyBox also prompts:

```
? Start dev container now? (Y/n)
```

This lets you go from `skybox new` to a running container in a single flow.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (project exists, clone failed, no config) |

## See Also

- [skybox clone](/reference/clone) - Clone project from remote
- [skybox push](/reference/push) - Push existing project to remote
- [skybox browse](/reference/browse) - List projects on remote
- [skybox remote](/reference/remote) - Manage remote servers
- [Custom Templates](/reference/custom-templates) - Create and manage reusable templates
