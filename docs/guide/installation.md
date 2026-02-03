# Installation

This guide covers installing DevBox and its dependencies.

## Prerequisites

DevBox requires:

| Software | Version | Purpose |
|----------|---------|---------|
| Docker | 20.10+ | Running development containers |
| Devcontainer CLI | 0.50+ | Building and managing dev containers |
| SSH | - | Remote server connection |

::: tip Note
The devcontainer CLI requires Node.js, but on macOS with Homebrew this is handled automatically.
:::

### Installing Prerequisites

::: code-group

```bash [macOS (Homebrew)]
# Install Docker Desktop
brew install --cask docker

# Install devcontainer CLI (includes Node.js automatically)
brew install devcontainer
```

```bash [Linux (Ubuntu/Debian)]
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect, then:

# Install Node.js (LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install devcontainer CLI
sudo npm install -g @devcontainers/cli
```

```bash [Linux (Fedora/RHEL)]
# Install Docker
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect, then:

# Install Node.js (LTS)
sudo dnf module install -y nodejs:22

# Install devcontainer CLI
sudo npm install -g @devcontainers/cli
```

```bash [Windows (WSL 2)]
# 1. Install Docker Desktop for Windows with WSL 2 backend
#    Download from: https://docs.docker.com/desktop/install/windows-install/
#    Enable "Use WSL 2 based engine" in Docker Desktop settings

# 2. Inside your WSL 2 distribution (Ubuntu recommended):

# Install Node.js (LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install devcontainer CLI
sudo npm install -g @devcontainers/cli
```

:::

## Install DevBox

::: code-group

```bash [macOS (Homebrew)]
brew tap NoorXLabs/homebrew-tap
brew install devbox
```

```bash [Linux / WSL]
# Download the latest release for your platform
# from https://github.com/NoorXLabs/DevBox/releases

# For x64:
curl -L -o devbox https://github.com/NoorXLabs/DevBox/releases/latest/download/devbox-linux-x64
chmod +x devbox
sudo mv devbox /usr/local/bin/

# For ARM64:
curl -L -o devbox https://github.com/NoorXLabs/DevBox/releases/latest/download/devbox-linux-arm64
chmod +x devbox
sudo mv devbox /usr/local/bin/
```

```bash [From Source]
# Building from source requires Bun 1.0+

# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Clone and build
git clone https://github.com/NoorXLabs/DevBox.git
cd DevBox
bun install
bun link
```

:::

## Verify Installation

Check that DevBox and its dependencies are installed correctly:

```bash
# Check DevBox
devbox --version

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
devbox init
```

The wizard will:

1. **Check dependencies** - Verify Docker and devcontainer CLI are installed
2. **Install Mutagen** - Download the file sync tool automatically
3. **Configure remote server** - Set up SSH connection to your backup server
4. **Choose editor** - Select your preferred code editor

### Example Setup Session

```
Welcome to devbox setup!

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
3. On macOS, make sure Docker Desktop is running (check the menu bar icon)
4. On Linux, ensure your user is in the docker group: `sudo usermod -aG docker $USER` (then log out and back in)

### Devcontainer CLI Not Found

If `devcontainer --version` fails:

**macOS (Homebrew):**
```bash
brew install devcontainer
```

**Linux / WSL:**
```bash
sudo npm install -g @devcontainers/cli
```

If npm is not found, install Node.js first (see [Prerequisites](#installing-prerequisites)).

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
