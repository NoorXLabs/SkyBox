# Config Command Design

**Date:** 2026-01-23
**Status:** Approved

## Overview

Add `skybox config` and `skybox remote` commands to support multiple remote servers with per-project associations.

## Goals

1. **Visibility** - Easy way to see current configuration and validate connections
2. **Multiple remotes** - Named remote server configurations (e.g., "work-nas", "home-server")
3. **Per-project association** - Each project remembers which remote it belongs to
4. **Multi-user support** - Multiple people can use the same remote server with separate project folders

## Command Structure

### Remote Management

```
skybox remote add                              # Interactive wizard
skybox remote add <name> <user>@<host>:<path>  # Direct mode
skybox remote add <name> ... --key=<path>      # With specific SSH key
skybox remote list
skybox remote remove <name>
skybox remote rename <old> <new>
```

### Config Commands

```
skybox config                    # Show all settings including remotes
skybox config --validate         # Test SSH connection to all remotes
skybox config set <key> <value>  # Change global settings (not remotes)
```

## Interactive Flow

When running `skybox remote add` without arguments:

```
$ skybox remote add

? Remote name: work-nas
? SSH host: 192.168.1.50
? SSH user: noor
? Projects path on remote: /srv/Projects/noor

? Select SSH key:
  > Enter custom path...
    ~/.ssh/id_ed25519 (default)
    ~/.ssh/id_rsa
    ~/.ssh/work_key

Testing connection... ✓ Connected

? SSH key not found on remote. Copy your public key now? (Y/n)
Copying SSH key... ✓ Done

Remote 'work-nas' added successfully.
```

Key selection behavior:
- "Enter custom path..." appears first (user's list may be long)
- Scans `~/.ssh/` for private keys with matching `.pub` files
- Selected key is stored with the remote config

## Data Model

### Config File (`~/.skybox/config.yaml`)

```yaml
# Global settings
editor: cursor
mutagen:
  maxStagingSize: "1GB"

# Named remotes
remotes:
  work-nas:
    host: 192.168.1.50
    user: noor
    path: /srv/Projects/noor
    key: ~/.ssh/work_key

  home:
    host: home.local
    user: noor
    path: /data/Projects
    key: ~/.ssh/id_ed25519
```

### Project Metadata (`.skybox/project.yaml`)

```yaml
name: my-app
remote: work-nas        # References remote by name
container: my-app-dev
createdAt: 2024-01-15
```

## User Flows

### First-time Setup

```
$ skybox init
# Interactive wizard: deps check, Mutagen install, add first remote, editor choice

$ skybox clone my-project
? Select remote:
  > work-nas
Cloning from work-nas... ✓
```

### Adding Additional Remotes

```
$ skybox remote add home noor@home.local:/data/Projects
Remote 'home' added successfully.

$ skybox push new-project
? Select remote:
  > work-nas
    home
```

### Working with Existing Projects

```
$ cd my-project
$ skybox up
# No prompt - already knows it's on 'work-nas'

$ skybox status
Project: my-project
Remote:  work-nas (noor@192.168.1.50)
Status:  running
Sync:    ✓ up to date
```

### Checking Setup

```
$ skybox config
Remotes:
  work-nas  noor@192.168.1.50:/srv/Projects/noor
  home      noor@home.local:/data/Projects

Settings:
  editor: cursor

$ skybox config --validate
Testing remotes...
  ✓ work-nas - connected (3 projects)
  ✓ home - connected (1 project)
```

## Command Separation

- `skybox init` - First-time setup (deps, Mutagen, first remote, editor)
- `skybox remote add` - Add additional remotes later

## Push Without devcontainer.json

When pushing a project that lacks a devcontainer.json:

```
$ skybox push my-existing-app
? Select remote:
  > work-nas

No devcontainer.json found.
? Create one now?
  > Yes - Node.js
    Yes - Python
    Yes - Go
    Yes - Custom (blank template)
    No - I'll add one later
```

## Error Handling

### Missing Remote Reference

```
$ skybox up

Error: Remote 'old-server' not found.
This project was configured to use 'old-server', but that remote no longer exists.

Available remotes:
  work-nas  noor@192.168.1.50:/srv/Projects/noor

Fix with: skybox remote add old-server <user>@<host>:<path>
Or update this project: skybox config set-remote <remote-name>
```

### No Remotes Configured

```
$ skybox clone my-app

Error: No remotes configured.
Run 'skybox init' to set up your first remote, or 'skybox remote add' to add one.
```

### SSH Connection Failure

```
$ skybox remote add bad-server noor@192.168.1.999:/path

Testing connection... ✗ Failed

Error: Could not connect to 192.168.1.999
  - Check the hostname/IP is correct
  - Verify SSH key has access
  - Ensure the server is reachable

Remote was not added.
```

## Migration

Existing single-remote configs migrate automatically on first command:

**Before (old format):**
```yaml
remote:
  host: my-server
  base_path: ~/code
editor: cursor
projects:
  my-app: { ... }
```

**After (new format):**
```yaml
editor: cursor
remotes:
  my-server:
    host: my-server
    user: null
    path: ~/code
    key: null
projects:
  my-app:
    remote: my-server
    ...
```

Message shown: "Migrated config to support multiple remotes. Your existing setup is preserved as remote 'my-server'."

## Multi-User Support

Multiple people sharing a remote server:
- Each person has their own `~/.skybox/` config (isolated by OS user)
- Each defines the same server with their own credentials/paths
- Example: Person A uses `noor@server:/srv/Projects/noor`, Person B uses `alex@server:/srv/Projects/alex`
- Both work simultaneously without conflict
