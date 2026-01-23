# Installation

This guide covers installing DevBox and its dependencies.

## Prerequisites

DevBox requires the following software:

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 20.10+ | Running development containers |
| Node.js | 18+ | Required for devcontainer CLI |
| Bun | 1.0+ | JavaScript runtime |
| SSH | - | Remote server connection |

### Installing Prerequisites

::: code-group

```bash [macOS]
# Install Docker Desktop
brew install --cask docker

# Install Node.js
brew install node

# Install Bun
curl -fsSL https://bun.sh/install | bash
```

```bash [Linux]
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Node.js (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20

# Install Bun
curl -fsSL https://bun.sh/install | bash
```

:::

## Install DevBox

Install DevBox globally using Bun:

```bash
bun install -g devbox
```

Alternatively, you can install from source:

```bash
git clone https://github.com/noorchasib/DevBox.git
cd DevBox
bun install
bun link
```

## Verify Installation

Check that DevBox is installed correctly:

```bash
devbox --version
```

You should see output like:

```
0.1.0
```

Also verify the dependencies are available:

```bash
# Check Docker
docker --version

# Check Node.js
node --version

# Check that Docker is running
docker ps
```

## Initial Setup

Run the interactive setup wizard:

```bash
devbox init
```

The wizard will:

1. **Check dependencies** - Verify Docker and Node.js are installed
2. **Install Mutagen** - Download the file sync tool automatically
3. **Configure remote server** - Set up SSH connection to your backup server
4. **Choose editor** - Select your preferred code editor

### Example Setup Session

```
Welcome to devbox setup!

Checking dependencies...
  Docker installed
  Node.js available

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

Setting up devbox...
  Created ~/.devbox
  Saved configuration

devbox is ready!

Next steps:
  Push a local project: devbox push ./my-project
  Clone from remote: devbox clone <project-name>
  Browse remote projects: devbox browse
```

## Configuration Location

DevBox stores its configuration and projects in `~/.devbox/`:

```
~/.devbox/
├── config.yaml      # Main configuration file
├── projects/        # Local project files
├── bin/             # Downloaded tools (mutagen)
└── logs/            # Log files
```

You can override this location with the `DEVBOX_HOME` environment variable:

```bash
export DEVBOX_HOME=/custom/path/.devbox
```

## Troubleshooting

### Docker Not Found

If `devbox init` reports Docker is not found:

1. Ensure Docker is installed: `docker --version`
2. Check Docker is running: `docker ps`
3. On Linux, ensure your user is in the docker group: `sudo usermod -aG docker $USER`

### SSH Connection Failed

If the SSH connection test fails:

1. Verify you can connect manually: `ssh your-server`
2. Check your SSH key is added: `ssh-add -l`
3. Ensure the server is reachable: `ping your-server`

### Mutagen Installation Failed

If Mutagen fails to install automatically:

1. Check your internet connection
2. Try manual installation: https://mutagen.io/documentation/introduction/installation
3. Run `devbox init` again after installing manually

### Permission Denied Errors

If you encounter permission issues:

```bash
# Fix ownership of devbox directory
sudo chown -R $USER:$USER ~/.devbox

# Ensure SSH key has correct permissions
chmod 600 ~/.ssh/id_ed25519
chmod 700 ~/.ssh
```

## Next Steps

Once installation is complete:

- Follow the [Quick Start](/guide/quick-start) to create your first project
- Learn about [Core Concepts](/guide/concepts) to understand how DevBox works
