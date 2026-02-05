# skybox doctor

Diagnose common issues with your SkyBox setup, dependencies, and configuration.

## Usage

```bash
skybox doctor
```

## Arguments

This command takes no arguments.

## Options

This command has no options.

## Description

The `doctor` command runs a series of health checks to verify that SkyBox and its dependencies are properly configured. It checks:

| Check | Description |
|-------|-------------|
| Docker | Verifies Docker is installed and the daemon is running |
| Mutagen | Verifies the Mutagen sync binary is installed |
| Devcontainer CLI | Verifies the devcontainer CLI is installed |
| Configuration | Verifies SkyBox config exists and is valid |
| SSH Connectivity | Tests SSH connection to all configured remotes |

Each check reports one of three statuses:

| Status | Icon | Meaning |
|--------|------|---------|
| Pass | `✓` | Check passed successfully |
| Warning | `!` | Non-critical issue, SkyBox may still work |
| Fail | `✗` | Critical issue that must be fixed |

For warnings and failures, the command suggests a fix.

## Examples

```bash
# Run all health checks
skybox doctor
```

### Example Output (All Passing)

```
SkyBox Doctor
────────────────────────────────────────

  ✓ Docker: Docker 24.0 is running
  ✓ Mutagen: Mutagen 0.17.5
  ✓ Devcontainer CLI: devcontainer 0.62.0
  ✓ Configuration: Config loaded (2 remotes)
  ✓ SSH: work: Connected to work-server
  ✓ SSH: personal: Connected to personal-server

────────────────────────────────────────
  6 passed

  All checks passed. SkyBox is ready to use!
```

### Example Output (With Issues)

```
SkyBox Doctor
────────────────────────────────────────

  ✓ Docker: Docker 24.0 is running
  ! Mutagen: Mutagen not installed (will be downloaded on first use)
      Fix: Run 'skybox init' to download Mutagen
  ✓ Devcontainer CLI: devcontainer 0.62.0
  ✓ Configuration: Config loaded (2 remotes)
  ✓ SSH: work: Connected to work-server
  ✗ SSH: personal: Cannot connect: Connection refused
      Fix: Check SSH key and host configuration for 'personal'

────────────────────────────────────────
  4 passed, 1 warnings, 1 failed

  Some checks failed. Please fix the issues above.
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed (warnings are allowed) |
| 1 | One or more checks failed |

## Common Issues and Fixes

### Docker not running

```
✗ Docker: Docker is installed but not running
    Fix: Start Docker Desktop application
```

Start Docker Desktop or run `systemctl start docker` on Linux.

### Mutagen not installed

```
! Mutagen: Mutagen not installed (will be downloaded on first use)
    Fix: Run 'skybox init' to download Mutagen
```

Run `skybox init` to download Mutagen automatically.

### Devcontainer CLI not found

```
! Devcontainer CLI: Devcontainer CLI not found
    Fix: brew install devcontainer
```

Install the devcontainer CLI. On macOS with Homebrew:
```bash
brew install devcontainer
```

Or via npm (any platform):
```bash
npm install -g @devcontainers/cli
```

### SSH connection failed

```
✗ SSH: myserver: Cannot connect: Permission denied
    Fix: Check SSH key and host configuration for 'myserver'
```

Verify:
- SSH key exists and has correct permissions (`chmod 600`)
- SSH host is reachable
- Correct user/host in SkyBox config
- SSH agent is running with key loaded

### Configuration issues

```
✗ Configuration: Config file exists but failed to load
    Fix: Check ~/.skybox/config.yaml for syntax errors
```

Check your config file for YAML syntax errors. You can validate with:
```bash
cat ~/.skybox/config.yaml
```

## See Also

- [skybox init](/reference/init) - Initial setup wizard
- [skybox config](/reference/config) - View/modify configuration
- [Troubleshooting Guide](/guide/troubleshooting) - Common issues and solutions
