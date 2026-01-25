# devbox remote

Manage remote server configurations.

## Usage

```bash
devbox remote <subcommand> [options]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `add [name] [user@host:path]` | Add a new remote server |
| `list` | List all configured remotes |
| `remove <name>` | Remove a remote server |
| `rename <old> <new>` | Rename a remote server |

## Description

The `remote` command manages connections to remote servers where your projects are stored and synced. DevBox supports multiple remote servers, allowing you to organize projects across different machines (e.g., work server, personal server, client servers).

### Multi-Remote Support

Each project is associated with exactly one remote. When you have multiple remotes configured, commands like `push`, `clone`, and `browse` will prompt you to select which remote to use.

## Subcommand Details

### `devbox remote add`

Add a new remote server configuration.

**Interactive mode:**
```bash
devbox remote add
```

Walks you through:
1. Remote name (identifier)
2. Server hostname or IP
3. SSH username
4. Remote projects directory
5. SSH key selection
6. Connection test
7. Directory creation (if needed)

**Direct mode:**
```bash
devbox remote add <name> <user@host:path> [--key <path>]
```

| Option | Description |
|--------|-------------|
| `-k, --key <path>` | Path to SSH private key |

### `devbox remote list`

Display all configured remotes.

```bash
devbox remote list
```

Output:
```
  production  deploy@prod.example.com:~/code
  personal    noor@home-server:~/projects
```

### `devbox remote remove`

Remove a remote configuration.

```bash
devbox remote remove <name>
```

If projects are associated with the remote, you'll be warned:

```
The following projects use this remote:
    my-app
    backend-api
Remove remote anyway? (projects will need to be reassigned) (y/N)
```

### `devbox remote rename`

Rename a remote and update all project references.

```bash
devbox remote rename <old-name> <new-name>
```

This automatically updates all projects that reference the old name.

## Examples

```bash
# Interactive wizard to add a remote
devbox remote add

# Add remote directly
devbox remote add myserver root@192.168.1.100:~/code

# Add remote with specific SSH key
devbox remote add myserver root@host:~/code --key ~/.ssh/id_ed25519

# List all remotes
devbox remote list

# Remove a remote
devbox remote remove myserver

# Rename a remote
devbox remote rename myserver production
```

### Typical Multi-Remote Setup

```bash
# Add work server
devbox remote add work deploy@work.example.com:~/projects

# Add personal server
devbox remote add personal me@home-server:~/code

# Push project to specific remote
devbox push ./my-project
# ? Select remote: work

# Clone from specific remote
devbox clone my-project
# ? Select remote: personal
```

## Remote Entry Format

Each remote is stored in the configuration with these fields:

| Field | Description |
|-------|-------------|
| `host` | SSH hostname or IP address |
| `user` | SSH username (or null to use SSH config default) |
| `path` | Base directory for projects on the remote |
| `key` | Path to SSH private key (or null to use SSH config default) |

Example in `~/.devbox/config.yaml`:

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

## SSH Key Setup

When adding a remote, if the connection test fails, you'll be offered to copy your SSH key:

```
SSH connection failed
Copy SSH key to server? (requires password) (Y/n)
```

This runs `ssh-copy-id` to install your public key on the server.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (invalid format, remote not found, connection failed) |

## See Also

- [devbox init](/reference/init) - Initial setup (creates first remote)
- [devbox config](/reference/config) - View/modify configuration
- [Configuration Reference](/reference/configuration) - Full config file format
