# skybox init

Interactive setup wizard for configuring SkyBox.

## Usage

```bash
skybox init
```

## Arguments

This command takes no arguments.

## Options

This command has no options. It runs interactively and guides you through the setup process.

## Description

The `init` command walks you through the initial SkyBox configuration:

1. **Dependency Check** - Verifies Docker and Node.js are installed
2. **Mutagen Installation** - Downloads and installs Mutagen for file synchronization (if not already installed)
3. **Remote Server Configuration** - Sets up SSH connection to your remote server
4. **Editor Selection** - Configures your preferred code editor
5. **Encryption Default** - Optionally enable encryption for new projects by default

If SkyBox is already configured, you'll be asked whether to reconfigure.

### Dependency Requirements

- **Docker** - Required for running containers
- **Node.js** - Required for the SkyBox CLI and devcontainer-cli

### Mutagen Download Verification

When Mutagen is downloaded, SkyBox verifies the binary's integrity:

1. **SHA256 checksum** — The download is verified against the official `SHA256SUMS` file before writing to disk
2. **GPG signature** — If `gpg` is available on your system, the `SHA256SUMS` file itself is verified against Mutagen's GPG signature

If GPG is not installed, SkyBox falls back to checksum-only verification. To skip GPG verification entirely (e.g., in air-gapped environments), set `SKYBOX_SKIP_GPG=1`.

### Remote Configuration

The wizard configures your first remote server. You can add more remotes later with `skybox remote add`.

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
skybox init
```

### Example Session

```
Welcome to skybox setup!

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

Setting up skybox...
  Created ~/.skybox
  Saved configuration

  skybox is ready!

Next steps:
  Push a local project: skybox push ./my-project
  Clone from remote: skybox clone <project-name>
  Browse remote projects: skybox browse
```

## Configuration File

After running `init`, SkyBox creates a configuration file at `~/.skybox/config.yaml` containing:

- Remote server configurations (supports multiple remotes)
- Default editor
- Sync settings and ignore patterns
- Registered projects with remote associations

## See Also

- [skybox remote](/reference/remote) - Add more remote servers
- [skybox config](/reference/config) - View and modify configuration
- [skybox editor](/reference/editor) - Change the default editor later
- [skybox browse](/reference/browse) - View projects on remote server
- [skybox push](/reference/push) - Push a local project to remote
