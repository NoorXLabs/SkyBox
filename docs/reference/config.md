# devbox config

View and modify DevBox configuration.

## Usage

```bash
devbox config [subcommand] [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| (none) | Display current configuration |
| `set <key> <value>` | Set a configuration value |
| `sync-paths <project> [paths]` | View or set selective sync paths |
| `encryption enable` | Enable AES-256-GCM config encryption |
| `encryption disable` | Disable config encryption |
| `devcontainer edit <project>` | Open devcontainer.json in editor |
| `devcontainer reset <project>` | Reset devcontainer.json from template |

## Options

| Option | Description |
|--------|-------------|
| `--validate` | Test SSH connection to all configured remotes and show project counts |

## Description

The `config` command provides ways to view and modify your DevBox configuration. It shows your configured remotes and global settings, manages selective sync paths, handles config encryption, and provides devcontainer configuration management.

### Display Configuration

Running `devbox config` without arguments shows:

```
─── Remotes: ───

  production  deploy@prod.example.com:~/code
  personal    me@home-server:~/projects

─── Settings: ───

  editor: cursor
```

### Set Configuration Values

```bash
devbox config set <key> <value>
```

Currently supported configuration keys:

| Key | Description | Example Values |
|-----|-------------|----------------|
| `editor` | Default editor command | `cursor`, `code`, `vim`, `nvim`, `zed` |

### Validate Configuration

The `--validate` flag tests SSH connections to all remotes and shows project counts:

```bash
devbox config --validate
```

Output:
```
─── Testing remotes... ───

  ✓ production - connected (5 projects)
  ✓ personal - connected (3 projects)

All remotes connected successfully.
```

If a connection fails:
```
  ✓ production - connected (5 projects)
  ✗ personal - failed

Some remotes failed to connect.
```

### Selective Sync Paths

View or set which paths to sync for a project. By default, DevBox syncs the entire project directory. Setting sync paths limits synchronization to only the specified subdirectories.

```bash
# View current sync paths
devbox config sync-paths my-project

# Set sync paths (comma-separated)
devbox config sync-paths my-project src,docs,package.json

# Clear sync paths (sync entire project)
devbox config sync-paths my-project ""
```

Paths are validated before saving. When no sync paths are configured, the entire project is synced.

### Encryption

Enable or disable AES-256-GCM encryption for your DevBox configuration file.

```bash
# Enable encryption (prompts for passphrase)
devbox config encryption enable

# Disable encryption
devbox config encryption disable
```

When enabling encryption, you will be prompted for a passphrase. Keep this passphrase safe -- it cannot be recovered.

### Devcontainer Edit

Open the project's `devcontainer.json` in your configured editor. After saving and closing the editor, the updated file is automatically pushed to the remote server.

```bash
devbox config devcontainer edit <project>
```

If no `devcontainer.json` exists for the project, you will be prompted to create one using `devcontainer reset`.

### Devcontainer Reset

Replace the project's `devcontainer.json` with a fresh copy from a template. An interactive prompt lets you select a template. After selection, the new file is pushed to the remote server.

```bash
devbox config devcontainer reset <project>
```

## Examples

```bash
# Show current configuration
devbox config

# Test all remote connections
devbox config --validate

# Change default editor to VS Code
devbox config set editor code

# Change default editor to Vim
devbox config set editor vim

# View sync paths for a project
devbox config sync-paths my-app

# Set selective sync paths
devbox config sync-paths my-app src,tests,package.json

# Enable config encryption
devbox config encryption enable

# Disable config encryption
devbox config encryption disable

# Edit devcontainer.json for a project
devbox config devcontainer edit my-app

# Reset devcontainer.json from template
devbox config devcontainer reset my-app
```

### Workflow Example

```bash
# Check current setup
devbox config

# Verify all remotes are accessible
devbox config --validate

# Switch editor preference
devbox config set editor code

# Limit sync to only source files for a large project
devbox config sync-paths my-app src,package.json

# Customize the devcontainer configuration
devbox config devcontainer edit my-app
```

## Configuration File

The configuration is stored in `~/.devbox/config.yaml`. While `devbox config set` handles common changes, you can also edit the file directly for advanced configuration.

For full configuration file documentation, see [Configuration Reference](/reference/configuration).

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (no config, unknown key, validation failed) |

## See Also

- [Configuration Reference](/reference/configuration) - Full config file format
- [devbox remote](/reference/remote) - Manage remote servers
- [devbox editor](/reference/editor) - Interactive editor selection
- [devbox init](/reference/init) - Initial setup wizard
