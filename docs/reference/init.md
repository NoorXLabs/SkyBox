---
title: skybox init
description: Interactive setup wizard for configuring SkyBox. Set up remotes, SSH keys, and install dependencies with skybox init.
---

# skybox init

Interactive setup wizard for configuring SkyBox.

<!-- COMMAND-SPEC:START -->
## Usage

```bash
skybox init [options]
```

## Arguments

None.

## Options

None.

## Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | display help for command |
| `-v, --version` | output the version number |
| `--dry-run` | Preview commands without executing them |
<!-- COMMAND-SPEC:END -->

## Description

The `init` command walks you through the initial SkyBox configuration:

1. **Dependency Check** - Verifies Docker and Node.js are installed
2. **Mutagen Installation** - Extracts the bundled Mutagen binary for file synchronization (if not already installed)
3. **Remote Server Configuration** - Sets up SSH connection to your remote server
4. **Editor Selection** - Configures your preferred code editor
5. **Encryption Default** - Optionally enable encryption for new projects by default

If SkyBox is already configured, you'll be asked whether to reconfigure.

### Dependency Requirements

- **Docker** - Required for running containers
- **Node.js** - Required for the SkyBox CLI and devcontainer-cli

### Mutagen Installation

Mutagen is bundled with SkyBox and extracted automatically during setup. In development mode (running from source), SkyBox falls back to downloading from GitHub if the bundled asset is not found.

When downloading (dev mode only), SkyBox verifies the binary's integrity using **SHA256 checksum** — the download is verified against the official `SHA256SUMS` file before writing to disk.

### Remote Configuration

The wizard configures your first remote server. You can add more remotes later with `skybox remote add`.

The wizard allows you to:

- Enter a name for the remote (e.g., "production", "personal")
- Select an existing SSH host from your `~/.ssh/config`
- Add a new server with hostname, username, and SSH key
- Test the SSH connection
- Optionally copy your SSH key to the server using `ssh-copy-id`
- Set the remote base path for storing projects (default: `~/code`)

SSH fields are validated as you enter them. Hostnames, usernames, key paths, and remote paths are checked for invalid characters (such as newlines or shell metacharacters) and will prompt you to re-enter if invalid.

### Editor Options

SkyBox has built-in support for these editors:

<!--@include: ../snippets/editors-list.md-->

Vim (`vim`), Neovim (`nvim`), and any custom editor command are also supported.

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
