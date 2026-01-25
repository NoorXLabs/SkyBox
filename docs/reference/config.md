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

## Options

| Option | Description |
|--------|-------------|
| `--validate` | Test SSH connection to all configured remotes |

## Description

The `config` command provides ways to view and modify your DevBox configuration. It shows your configured remotes and global settings.

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

# Change default editor to Cursor
devbox config set editor cursor
```

### Workflow Example

```bash
# Check current setup
devbox config

# Verify all remotes are accessible
devbox config --validate

# Switch editor preference
devbox config set editor code
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
