<h1>
	<img
		src="docs/public/skybox-logo-grey.svg"
		alt="SkyBox logo"
		width="52"
		align="absmiddle"
		style="vertical-align: middle; margin-right: 10px;"
	/>
	<span style="vertical-align: middle;">SkyBox</span>
</h1>

Local-first development containers with remote sync and multi-machine support.

## The Problem

- **Disk bloat**: `node_modules`, virtual envs, and build artifacts consume gigabytes of local storage
- **Latency**: Remote dev containers introduce network lag that makes tools like Claude Code frustrating
- **Multi-machine chaos**: Switching between machines means manual syncing or risking conflicts

## The Solution

SkyBox stores your code on a remote server while running containers locally. You get:

- **Zero latency** - Containers run on your machine
- **Minimal disk usage** - Code lives on the server, synced on-demand
- **Safe multi-machine workflow** - Lock system prevents conflicts when switching computers
- **Offline capable** - Work locally, changes sync when you're back online

## How It Works

```
┌──────────────────┐        ┌──────────────────┐
│  Your Machine    │        │  Remote Server   │
│                  │ Mutagen│                  │
│  ~/.skybox/      │◄──────►│  ~/code/         │
│   projects/      │  sync  │   myproject/     │
│    myproject/    │        │                  │
│                  │        │  Lock files:     │
│  Docker          │        │  .skybox-locks/  │
│   Container      │        │                  │
└──────────────────┘        └──────────────────┘
```

## Requirements

- Docker
- SSH access to a remote server

Mutagen is bundled and extracted automatically during setup.

## Documentation

For installation, quick start, commands, and configuration:

**[Please visit the documentation](https://skybox.noorxlabs.com)**

## Contributing

If you want to contribute to SkyBox, start here:

- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Support Guidelines](SUPPORT.md)
- [GitHub Discussions](https://github.com/NoorXLabs/SkyBox/discussions)

## License

Apache License 2.0
