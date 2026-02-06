# Installation

This guide covers installing SkyBox and its dependencies.

## Prerequisites

SkyBox requires:

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 20.10+ | Running development containers |
| Devcontainer CLI | 0.50+ | Building and managing dev containers |
| SSH | - | Remote server connection |

::: tip Note
The devcontainer CLI requires Node.js. Make sure Node.js is installed before installing the devcontainer CLI.
:::

### Installing Prerequisites

Install the following tools from their official sources before continuing:

- **Docker Desktop** (20.10+) — [Get Docker](https://docs.docker.com/get-started/get-docker/)
- **Node.js** (LTS) — [Download Node.js](https://nodejs.org/en/download) *(required for devcontainer CLI)*
- **Devcontainer CLI** (0.50+) — [Installation instructions](https://github.com/devcontainers/cli#npm-install)
- **SSH** — Pre-installed on macOS and Linux. Windows users need [WSL 2](https://learn.microsoft.com/en-us/windows/wsl/install).

## Install SkyBox

::: code-group

```bash [Homebrew (macOS)]
brew tap NoorXLabs/homebrew-tap
brew install skybox
```

```bash [Direct Download (macOS / Linux / WSL)]
# Install with one command (auto-detects architecture)
curl -fsSL https://install.noorxlabs.com/skybox | bash
```

```bash [From Source]
# Building from source requires Bun 1.0+

# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Clone and build
git clone https://github.com/NoorXLabs/SkyBox.git
cd SkyBox
bun install
bun link
```

:::

## Verify Installation

Check that SkyBox and its dependencies are installed correctly:

```bash
# Check SkyBox
skybox --version

# Check Docker is installed and running
docker --version
docker ps

# Check devcontainer CLI
devcontainer --version
```

You should see version numbers for all three tools. If `docker ps` fails, make sure Docker Desktop is running.

## Initial Setup

Run the interactive setup wizard:

```bash
skybox init
```

The wizard will:

1. **Check dependencies** - Verify Docker and devcontainer CLI are installed
2. **Install Mutagen** - Download the file sync tool automatically
3. **Configure remote server** - Set up SSH connection to your backup server
4. **Choose editor** - Select your preferred code editor

### Example Setup Session

```
Welcome to skybox setup!

Checking dependencies...
  Docker installed
  Devcontainer CLI available

Installing mutagen...
  Mutagen installed

Configure remote server
Select SSH host:
  1) my-server (192.168.1.100)
  2) work-vps (work.example.com)
  3) + Add new server

Testing SSH connection...
  SSH connection successful

Remote code directory: ~/code
  Remote directory exists

Configure editor
Preferred editor:
  1) Cursor
  2) VS Code
  3) Zed
  4) Vim
  5) Neovim
  6) Other

Setting up skybox...
  Created ~/.skybox
  Saved configuration

skybox is ready!

Next steps:
  Push a local project: skybox push ./my-project
  Clone from remote: skybox clone <project-name>
  Browse remote projects: skybox browse
```

## Configuration Location

SkyBox stores its configuration and projects in `~/.skybox/`:

```
~/.skybox/
├── config.yaml      # Main configuration file
├── projects/        # Local project files
├── bin/             # Downloaded tools (mutagen)
└── logs/            # Log files
```

You can override this location with the `SKYBOX_HOME` environment variable:

```bash
export SKYBOX_HOME=/custom/path/.skybox
```

## Troubleshooting

### Docker Not Found

If `skybox init` reports Docker is not found:

1. Ensure Docker is installed: `docker --version`
2. Check Docker is running: `docker ps`
3. On macOS, make sure Docker Desktop is running (check the menu bar icon)
4. On Linux, ensure your user is in the docker group: `sudo usermod -aG docker $USER` (then log out and back in)

### Devcontainer CLI Not Found

If `devcontainer --version` fails:

1. Ensure Node.js is installed first (see [Prerequisites](#installing-prerequisites))
2. Install the devcontainer CLI from the [official instructions](https://github.com/devcontainers/cli)

### SSH Connection Failed

If the SSH connection test fails:

1. Verify you can connect manually: `ssh your-server`
2. Check your SSH key is added: `ssh-add -l`
3. Ensure the server is reachable: `ping your-server`

### Mutagen Installation Failed

If Mutagen fails to install automatically:

1. Check your internet connection
2. Try manual installation: [Mutagen](https://mutagen.io/documentation/introduction/installation)
3. Run `skybox init` again after installing manually

### Permission Denied Errors

If you encounter permission issues:

```bash
# Fix ownership of skybox directory
sudo chown -R $USER:$USER ~/.skybox

# Ensure SSH key has correct permissions
chmod 600 ~/.ssh/id_ed25519
chmod 700 ~/.ssh
```

## Next Steps

Once installation is complete:

- Follow the [Quick Start](/guide/quick-start) to create your first project
- Learn about [Core Concepts](/guide/concepts) to understand how SkyBox works
