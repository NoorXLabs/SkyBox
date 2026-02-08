# Introduction

SkyBox is a CLI tool for local-first development containers with remote sync. It provides the best of both worlds: run your containers locally for speed and full resource access while automatically syncing your code to a remote server for backup and multi-machine workflows.

## What is SkyBox?

SkyBox manages the complete lifecycle of containerized development environments:

- **Local Development** - Run containers on your machine with native performance
- **Remote Sync** - Automatically backup code to a remote server using Mutagen
- **Multi-Machine Workflow** - Seamlessly switch between machines with session-based coordination
- **Editor Integration** - Open projects directly in Cursor, VS Code, or your preferred editor

## How It Works

```text
Your Machine                     Remote Server
┌─────────────────────┐         ┌─────────────────────┐
│  ~/.skybox/Projects │◄───────►│    ~/code/          │
│  ├── project-a/     │  Sync   │    ├── project-a/   │
│  └── project-b/     │         │    └── project-b/   │
└─────────────────────┘         └─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Docker Container   │
│  (devcontainer)     │
└─────────────────────┘
```

1. Projects are stored locally in `~/.skybox/Projects/`
2. Mutagen syncs files bidirectionally to your remote server
3. Docker containers run locally using devcontainer configurations
4. Session files prevent conflicts when switching between machines

## Why SkyBox?

### Local-First Performance

Unlike cloud-based development environments, SkyBox runs containers on your machine. This means:

- No network latency for file operations
- Full access to local resources (CPU, memory, GPU)
- Works offline after initial setup
- No per-minute cloud billing

### Seamless Remote Backup

Your code is automatically synced to remote servers:

- Never lose work due to local machine issues
- Easy to switch between work laptop and home desktop
- Built-in session system warns when a project is active on another machine
- Multi-remote support for organizing projects across different servers

### Developer Experience

SkyBox is designed for developers who want minimal friction:

- Interactive setup wizard (`skybox init`)
- Smart project detection when running commands
- Direct editor integration with devcontainer support
- Clean status views showing all your projects at a glance

## Next Steps

- [Installation](/guide/installation) - Install SkyBox on your system
- [Quick Start](/guide/quick-start) - Get your first project running
- [Concepts](/guide/concepts) - Understand how SkyBox works under the hood
