# skybox config

View and modify SkyBox configuration.

## Usage

```bash
skybox config [subcommand] [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| (none) | Display current configuration |
| `set <key> <value>` | Set a configuration value |
| `sync-paths <project> [paths]` | View or set selective sync paths |
| `devcontainer edit <project>` | Open devcontainer.json in editor |
| `devcontainer reset <project>` | Reset devcontainer.json from template |

## Options

| Option | Description |
|--------|-------------|
| `--validate` | Test SSH connection to all configured remotes and show project counts |

## Description

The `config` command provides ways to view and modify your SkyBox configuration. It shows your configured remotes and global settings, manages selective sync paths and provides devcontainer configuration management.

### Display Configuration

Running `skybox config` without arguments shows:

```
─── Remotes: ───

  production  deploy@prod.example.com:~/code
  personal    me@home-server:~/projects

─── Settings: ───

  editor: cursor
```

### Set Configuration Values

```bash
skybox config set <key> <value>
```

Currently supported configuration keys:

| Key | Description | Example Values |
|-----|-------------|----------------|
| `editor` | Default editor command | `cursor`, `code`, `vim`, `nvim`, `zed` |

### Validate Configuration

The `--validate` flag tests SSH connections to all remotes and shows project counts:

```bash
skybox config --validate
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

View or set which paths to sync for a project. By default, SkyBox syncs the entire project directory. Setting sync paths limits synchronization to only the specified subdirectories.

```bash
# View current sync paths
skybox config sync-paths my-project

# Set sync paths (comma-separated)
skybox config sync-paths my-project src,docs,package.json

# Clear sync paths (sync entire project)
skybox config sync-paths my-project ""
```

Paths are validated before saving. When no sync paths are configured, the entire project is synced.

### Devcontainer Edit

Open the project's `devcontainer.json` in your configured editor. After saving and closing the editor, the updated file is automatically pushed to the remote server.

```bash
skybox config devcontainer edit <project>
```

If no `devcontainer.json` exists for the project, you will be prompted to create one using `devcontainer reset`.

### Devcontainer Reset

Replace the project's `devcontainer.json` with a fresh copy from the unified template selector. You can choose from built-in templates, your custom local templates in `~/.skybox/templates/`, or enter a git URL. After selection, the new file is pushed to the remote server. See [Custom Templates](/reference/custom-templates) for details.

```bash
skybox config devcontainer reset <project>
```

## Examples

```bash
# Show current configuration
skybox config

# Test all remote connections
skybox config --validate

# Change default editor to VS Code
skybox config set editor code

# Change default editor to Vim
skybox config set editor vim

# View sync paths for a project
skybox config sync-paths my-app

# Set selective sync paths
skybox config sync-paths my-app src,tests,package.json

# Edit devcontainer.json for a project
skybox config devcontainer edit my-app

# Reset devcontainer.json from template
skybox config devcontainer reset my-app
```

### Workflow Example

```bash
# Check current setup
skybox config

# Verify all remotes are accessible
skybox config --validate

# Switch editor preference
skybox config set editor code

# Limit sync to only source files for a large project
skybox config sync-paths my-app src,package.json

# Customize the devcontainer configuration
skybox config devcontainer edit my-app
```

## Configuration File

The configuration is stored in `~/.skybox/config.yaml`. While `skybox config set` handles common changes, you can also edit the file directly for advanced configuration.

For full configuration file documentation, see [Configuration Reference](/reference/configuration).

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (no config, unknown key, validation failed) |

## See Also

- [Configuration Reference](/reference/configuration) - Full config file format
- [skybox remote](/reference/remote) - Manage remote servers
- [skybox editor](/reference/editor) - Interactive editor selection
- [skybox init](/reference/init) - Initial setup wizard
