---
title: Configuration Reference
description: SkyBox YAML configuration file reference. Configure remotes, sync modes, ignore patterns, editors, and project-specific settings.
---

# Configuration Reference

SkyBox uses a YAML configuration file to store global settings, remote server connections, sync preferences, and project-specific configurations.

## Config File Location

The configuration file is located at:

```
~/.skybox/config.yaml
```

You can override the SkyBox home directory by setting the `SKYBOX_HOME` environment variable:

```bash
export SKYBOX_HOME=/custom/path/.skybox
```

When set, the config file will be located at `$SKYBOX_HOME/config.yaml`.

## Directory Structure

SkyBox creates the following directory structure:

```
~/.skybox/
├── config.yaml          # Main configuration file
├── .installed           # First-run telemetry marker
├── .update-check.json   # Update check cache (24h TTL)
├── audit.log            # Audit log (when SKYBOX_AUDIT=1)
├── Projects/            # Local synced project copies
│   ├── my-app/
│   └── backend/
├── bin/
│   ├── mutagen                # Auto-downloaded sync binary
│   └── mutagen-agents.tar.gz  # Mutagen agents archive
├── templates/           # Custom local devcontainer templates
└── logs/                # Log files (auto-up, etc.)
```

## Configuration Schema

The configuration file has four main sections:

### `remotes`

A map of named remote server configurations. Each remote represents a server where projects can be stored and synced.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `host` | `string` | Yes | SSH hostname or IP address |
| `user` | `string` | No | SSH username (null to use SSH config default) |
| `path` | `string` | Yes | Base directory for projects on the remote |
| `key` | `string` | No | Path to SSH private key (null to use SSH config default) |

Example:

```yaml
remotes:
  production:
    host: prod.example.com
    user: deploy
    path: ~/code
    key: ~/.ssh/id_ed25519

  personal:
    host: home-server
    user: null          # Uses SSH config
    path: ~/projects
    key: null           # Uses SSH config
```

### `editor`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `editor` | `string` | - | Command to launch your preferred editor |

Supported editors:

<!--@include: ../snippets/editors-list.md-->

Vim (`vim`), Neovim (`nvim`), and any custom editor command are also supported.

### `defaults`

Default settings for file synchronization.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sync_mode` | `string` | `"two-way-resolved"` | Mutagen sync mode for file synchronization |
| `ignore` | `string[]` | See below | Default patterns to ignore during sync |
| `encryption` | `boolean` | `false` | Enable encryption by default for new projects |
| `auto_up` | `boolean` | `false` | Auto-start containers when entering project directories (see [Shell Integration](/guide/shell-integration)) |

#### Default Ignore Patterns

The following patterns are ignored by default:

<!--@include: ../snippets/default-ignore-patterns.md-->

#### Sync Modes

The `sync_mode` option accepts Mutagen sync mode values:

| Mode | Description |
|------|-------------|
| `two-way-resolved` | Bidirectional sync with automatic conflict resolution (recommended) |
| `two-way-safe` | Bidirectional sync that flags conflicts for manual resolution |
| `one-way-replica` | One-way sync that mirrors alpha exactly on beta |

### `projects`

A map of project names to project-specific configurations. Each project references a remote by name.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `remote` | `string` | Yes | Name of the remote this project belongs to |
| `ignore` | `string[]` | No | Additional ignore patterns for this project |
| `editor` | `string` | No | Override editor for this project |
| `sync_paths` | `string[]` | No | Selective sync: only sync these subdirectories instead of the entire project |
| `encryption` | `object` | No | Per-project encryption config (see below) |
| `hooks` | `object` | No | Lifecycle hooks: shell commands to run before/after `up` and `down` (see [Hooks](/reference/hooks)) |
| `auto_up` | `boolean` | No | Auto-start container when entering this project's directory (see [Shell Integration](/guide/shell-integration)) |

Example:

```yaml
projects:
  my-web-app:
    remote: production
    ignore:
      - ".cache"
      - "coverage"
    editor: code

  backend-api:
    remote: production
    ignore:
      - "*.log"
      - "tmp"

  side-project:
    remote: personal
    editor: nvim

  large-monorepo:
    remote: production
    sync_paths:
      - src
      - build
```

#### Per-Project Encryption

Projects can have encryption at rest enabled. When enabled, project files are encrypted on the remote when not in active use.

```yaml
projects:
  my-app:
    remote: production
    encryption:
      enabled: true
      salt: "a1b2c3d4e5f6..."
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | `boolean` | Whether encryption at rest is active |
| `salt` | `string` | Auto-generated hex salt for key derivation. Do not edit. |

Use `skybox encrypt enable/disable` to manage these settings. See [`skybox encrypt`](/reference/encryption).

### `templates` (Optional)

Custom project templates as git repository URLs. These templates appear in `skybox new` when selecting "From a template".

```yaml
templates:
  company-starter: https://github.com/myorg/starter-template.git
  react-app: https://github.com/myorg/react-template.git
```

::: tip
You can also create local templates stored as `.json` files in `~/.skybox/templates/`. See [Custom Templates](/reference/custom-templates) for details.
:::

## Complete Example

Here is a complete example configuration file:

```yaml
# Default editor command
editor: cursor

# Default sync settings
defaults:
  sync_mode: two-way-resolved
  # Default ignore patterns (see above for details)
  ignore:
    - ".git/index.lock"
    - ".git/*.lock"
    - ".git/hooks/*"
    - "node_modules"
    - "venv"
    - ".venv"
    - "__pycache__"
    - "*.pyc"
    - ".skybox-local"
    - "dist"
    - "build"
    - ".next"
    - "target"
    - "vendor"

# Remote server configurations
remotes:
  production:
    host: prod.example.com
    user: deploy
    path: ~/code
    key: ~/.ssh/id_ed25519

  staging:
    host: staging.example.com
    user: deploy
    path: ~/code
    key: ~/.ssh/id_ed25519

  personal:
    host: home-server
    user: null
    path: ~/projects
    key: null

# Project-specific configurations
projects:
  my-web-app:
    remote: production
    ignore:
      - ".cache"
      - "coverage"
    editor: code

  backend-api:
    remote: production
    ignore:
      - "*.log"
      - "tmp"

  data-pipeline:
    remote: staging
    editor: nvim
    ignore:
      - "data/*.csv"
      - "output"

  side-project:
    remote: personal

  large-monorepo:
    remote: production
    sync_paths:
      - src
      - build

# Custom project templates
templates:
  company-starter: https://github.com/myorg/starter.git
  react-app: https://github.com/myorg/react-template.git
```

## Environment Variables

<!--@include: ../snippets/env-vars-table.md-->

### Audit Logging

When `SKYBOX_AUDIT=1`, security-relevant operations are logged to `~/.skybox/audit.log` in JSON Lines format:

```json
{"timestamp":"2026-02-04T12:00:00Z","action":"clone:success","user":"john","machine":"macbook","details":{"project":"myapp"}}
```

Logged actions include: `clone:start`, `clone:success`, `clone:fail`, `push:start`, `push:success`, `push:fail`, `rm:local`, `rm:remote`, `up:start`, `up:success`, `down`, `lock:force`, `config:change`.

#### Log Sanitization

Audit log entries are automatically sanitized before being written:

- **Home directory paths** are replaced with `~` (e.g., `/Users/john/code` becomes `~/code`)
- **Credentials** matching `password=...` or `token=...` patterns are redacted

#### Log Rotation

The audit log is automatically rotated when it exceeds **10 MB**. When rotation occurs, the current log is renamed to `audit.log.YYYY-MM-DD` and a new log file is started.

::: tip Manual Rotation
You can also rotate the log manually at any time:
```bash
mv ~/.skybox/audit.log ~/.skybox/audit.log.$(date +%Y%m%d)
```
:::

### Telemetry

SkyBox sends a single anonymous event on first run to help track installation counts. The data includes only the OS, architecture, version, and install method — no personal information is collected.

To opt out, set `SKYBOX_TELEMETRY=0` before running any SkyBox command:

```bash
export SKYBOX_TELEMETRY=0
```

The telemetry event fires at most once. After the first run, a marker file (`~/.skybox/.installed`) is written and no further telemetry is sent.

## Creating Configuration

The configuration file is automatically created when you run:

```bash
skybox init
```

This interactive command will:
1. Check for required dependencies (Docker, Node.js)
2. Download and install Mutagen for file synchronization
3. Configure your first remote SSH server
4. Set your preferred editor
5. Create the configuration file

## Modifying Configuration

### Using SkyBox Commands

```bash
# View current configuration
skybox config

# Change editor
skybox config set editor vim

# Add a new remote
skybox remote add myserver user@host:~/code

# Remove a remote
skybox remote remove myserver

# Validate all remote connections
skybox config --validate
```

### Direct File Editing

You can edit the configuration file directly:

```bash
# Open with your default editor
$EDITOR ~/.skybox/config.yaml

# Or use any text editor
nano ~/.skybox/config.yaml
vim ~/.skybox/config.yaml
```

Changes take effect immediately for new commands. Running containers or sync sessions may need to be restarted to pick up configuration changes.

## Per-Project Overrides

Projects can override global settings:

```yaml
projects:
  my-project:
    remote: production

    # Use a different editor for this project
    editor: nvim

    # Additional ignore patterns (merged with defaults)
    ignore:
      - "local-only/"
      - "*.local"

    # Selective sync: only sync specific subdirectories
    sync_paths:
      - src
      - config
```

## Validation

SkyBox validates the configuration file on load. Common issues include:

- **Missing remotes section**: At least one remote must be configured
- **Invalid project remote reference**: Project references a non-existent remote
- **Invalid YAML syntax**: Check for proper indentation and formatting
- **Invalid sync mode**: Use one of the supported Mutagen sync modes

If the configuration is invalid, SkyBox commands will fail with an error message indicating the issue.

## Migration from Old Format

If you have an older configuration with a single `remote` section (instead of `remotes`), SkyBox will automatically migrate it on first use:

**Old format:**
```yaml
remote:
  host: my-server
  base_path: ~/code
```

**New format (auto-migrated):**
```yaml
remotes:
  my-server:           # Name derived from host
    host: my-server
    user: null
    path: ~/code
    key: null

projects:
  existing-project:
    remote: my-server  # Updated to reference new remote name
```

The migration happens automatically and preserves all your existing projects.

## See Also

- [`skybox config`](/reference/config) - View and modify configuration via CLI
- [`skybox remote`](/reference/remote) - Manage remote server connections
- [Custom Templates](/reference/custom-templates) - Create reusable devcontainer templates
- [`skybox hook`](/reference/hook) - Shell hook for auto-starting containers on `cd`
