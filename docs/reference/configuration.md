# Configuration Reference

DevBox uses a YAML configuration file to store global settings, sync preferences, and project-specific configurations.

## Config File Location

The configuration file is located at:

```
~/.devbox/config.yaml
```

You can override the DevBox home directory by setting the `DEVBOX_HOME` environment variable:

```bash
export DEVBOX_HOME=/custom/path/.devbox
```

When set, the config file will be located at `$DEVBOX_HOME/config.yaml`.

## Directory Structure

DevBox creates the following directory structure:

```
~/.devbox/
├── config.yaml      # Main configuration file
├── projects/        # Local project files
├── bin/             # Binary tools (mutagen)
└── logs/            # Log files
```

## Configuration Schema

The configuration file has four main sections:

### `remote`

Remote server connection settings.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `host` | `string` | Yes | SSH host name (from ~/.ssh/config or user@hostname) |
| `base_path` | `string` | Yes | Base directory for projects on the remote server |

### `editor`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `editor` | `string` | - | Command to launch your preferred editor |

Supported editors include:
- `cursor` - Cursor editor
- `code` - Visual Studio Code
- `zed` - Zed editor
- `vim` - Vim
- `nvim` - Neovim
- Any custom editor command

### `defaults`

Default settings for file synchronization.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sync_mode` | `string` | `"two-way-resolved"` | Mutagen sync mode for file synchronization |
| `ignore` | `string[]` | See below | Default patterns to ignore during sync |

#### Default Ignore Patterns

The following patterns are ignored by default:

```yaml
ignore:
  - ".git/index.lock"
  - ".git/*.lock"
  - ".git/hooks/*"
  - "node_modules"
  - "venv"
  - ".venv"
  - "__pycache__"
  - "*.pyc"
  - ".devbox-local"
  - "dist"
  - "build"
  - ".next"
  - "target"
  - "vendor"
```

#### Sync Modes

The `sync_mode` option accepts Mutagen sync mode values:

| Mode | Description |
|------|-------------|
| `two-way-resolved` | Bidirectional sync with automatic conflict resolution (recommended) |
| `two-way-safe` | Bidirectional sync that flags conflicts for manual resolution |
| `one-way-safe` | One-way sync from alpha (local) to beta (remote) |
| `one-way-replica` | One-way sync that mirrors alpha exactly on beta |

### `projects`

A map of project names to project-specific configurations.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `remote` | `string` | No | Override remote path for this project |
| `ignore` | `string[]` | No | Additional ignore patterns for this project |
| `editor` | `string` | No | Override editor for this project |

## Complete Example

Here is a complete example configuration file:

```yaml
# Remote server configuration
remote:
  host: dev-server           # SSH host name
  base_path: ~/code          # Base path for projects on remote

# Default editor command
editor: cursor

# Default sync settings
defaults:
  sync_mode: two-way-resolved
  ignore:
    # Git internals
    - ".git/index.lock"
    - ".git/*.lock"
    - ".git/hooks/*"

    # Node.js
    - "node_modules"

    # Python
    - "venv"
    - ".venv"
    - "__pycache__"
    - "*.pyc"

    # Build outputs
    - "dist"
    - "build"
    - ".next"
    - "target"
    - "vendor"

    # DevBox local files
    - ".devbox-local"

# Project-specific configurations
projects:
  my-web-app:
    remote: ~/code/my-web-app
    ignore:
      - ".cache"
      - "coverage"
    editor: code

  backend-api:
    remote: ~/code/services/backend-api
    ignore:
      - "*.log"
      - "tmp"

  data-pipeline:
    editor: nvim
    ignore:
      - "data/*.csv"
      - "output"
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DEVBOX_HOME` | Override the default DevBox home directory (`~/.devbox`) |

## Creating Configuration

The configuration file is automatically created when you run:

```bash
devbox init
```

This interactive command will:
1. Check for required dependencies (Docker, Node.js)
2. Install Mutagen for file synchronization
3. Configure your remote SSH server
4. Set your preferred editor
5. Create the configuration file

## Modifying Configuration

You can edit the configuration file directly:

```bash
# Open with your default editor
$EDITOR ~/.devbox/config.yaml

# Or use any text editor
nano ~/.devbox/config.yaml
vim ~/.devbox/config.yaml
```

Changes take effect immediately for new commands. Running containers or sync sessions may need to be restarted to pick up configuration changes.

## Per-Project Overrides

Projects can override global settings by adding entries to the `projects` section:

```yaml
projects:
  my-project:
    # Use a different editor for this project
    editor: nvim

    # Additional ignore patterns (merged with defaults)
    ignore:
      - "local-only/"
      - "*.local"

    # Custom remote path (if different from base_path/project-name)
    remote: ~/code/special/my-project
```

## Validation

DevBox validates the configuration file on load. Common issues include:

- **Missing required fields**: Ensure `remote.host` and `remote.base_path` are set
- **Invalid YAML syntax**: Check for proper indentation and formatting
- **Invalid sync mode**: Use one of the supported Mutagen sync modes

If the configuration is invalid, DevBox commands will fail with an error message indicating the issue.
