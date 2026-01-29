# devbox init

Interactive setup wizard for configuring DevBox.

## Usage

```bash
devbox init
```

## Arguments

This command takes no arguments.

## Options

This command has no options. It runs interactively and guides you through the setup process.

## Description

The `init` command walks you through the initial DevBox configuration:

1. **Dependency Check** - Verifies Docker and Node.js are installed
2. **Mutagen Installation** - Downloads and installs Mutagen for file synchronization (if not already installed)
3. **Remote Server Configuration** - Sets up SSH connection to your remote server
4. **Editor Selection** - Configures your preferred code editor

If DevBox is already configured, you'll be asked whether to reconfigure.

### Dependency Requirements

- **Docker** - Required for running containers
- **Node.js** - Required for the DevBox CLI and devcontainer-cli

### Remote Configuration

The wizard configures your first remote server. You can add more remotes later with `devbox remote add`.

The wizard allows you to:

- Enter a name for the remote (e.g., "production", "personal")
- Select an existing SSH host from your `~/.ssh/config`
- Add a new server with hostname, username, and SSH key
- Test the SSH connection
- Optionally copy your SSH key to the server using `ssh-copy-id`
- Set the remote base path for storing projects (default: `~/code`)

### Editor Options

Built-in support for:

- Cursor
- VS Code
- Zed
- Vim
- Neovim
- Custom editor command

## Examples

```bash
# Run the setup wizard
devbox init
```

### Example Session

```
Welcome to devbox setup!

Checking dependencies...
  Docker installed
  Node.js available

Installing mutagen...
  Mutagen installed

Configure remote server
? Remote name: production
? Select SSH host: my-server (192.168.1.100)
  SSH connection successful

? Remote code directory: ~/code
  Remote directory exists

Configure editor
? Preferred editor: Cursor

Setting up devbox...
  Created ~/.devbox
  Saved configuration

  devbox is ready!

Next steps:
  Push a local project: devbox push ./my-project
  Clone from remote: devbox clone <project-name>
  Browse remote projects: devbox browse
```

## Configuration File

After running `init`, DevBox creates a configuration file at `~/.devbox/config.yaml` containing:

- Remote server configurations (supports multiple remotes)
- Default editor
- Sync settings and ignore patterns
- Registered projects with remote associations

## See Also

- [devbox remote](/reference/remote) - Add more remote servers
- [devbox config](/reference/config) - View and modify configuration
- [devbox editor](/reference/editor) - Change the default editor later
- [devbox browse](/reference/browse) - View projects on remote server
- [devbox push](/reference/push) - Push a local project to remote
