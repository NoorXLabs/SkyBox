---
title: skybox hook
description: Output shell hook code for auto-starting containers when entering project directories with skybox hook.
---

# skybox hook

Output shell hook code for auto-starting containers when entering project directories.

## Usage

```bash
skybox hook [shell]
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `shell` | No | Shell type: `bash` or `zsh` |

## Description

The `hook` command outputs shell code that integrates SkyBox with your shell. When installed, this hook automatically starts containers when you `cd` into a SkyBox project directory.

The hook:
- Runs on every prompt (via `PROMPT_COMMAND` for bash, `precmd` for zsh)
- Only triggers when the directory actually changes
- Runs container startup in the background (doesn't block your prompt)
- Respects the `auto_up` configuration setting per project

## Installation

Add the appropriate line to your shell configuration file:

### Bash

```bash
echo 'eval "$(skybox hook bash)"' >> ~/.bashrc
source ~/.bashrc
```

### Zsh

```bash
echo 'eval "$(skybox hook zsh)"' >> ~/.zshrc
source ~/.zshrc
```

## Configuration

The hook only auto-starts containers for projects with `auto_up` enabled.

Enable it globally in `~/.skybox/config.yaml`:

```yaml
defaults:
  auto_up: true
```

Or per-project by editing `~/.skybox/config.yaml` directly:

```yaml
projects:
  my-project:
    remote: my-server
    auto_up: true
```

See [Shell Integration](/guide/shell-integration) for detailed configuration options.

## Examples

```bash
# Output bash hook code
skybox hook bash

# Output zsh hook code
skybox hook zsh

# Install for bash (one-time setup)
echo 'eval "$(skybox hook bash)"' >> ~/.bashrc

# Verify hook is active (bash)
echo "$PROMPT_COMMAND"
# Should contain: _skybox_hook
```

## Logging

Auto-up activity is logged to:

```
~/.skybox/logs/auto-up.log
```

View recent activity:

```bash
cat ~/.skybox/logs/auto-up.log
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Invalid or missing shell argument |

## See Also

- [Shell Integration Guide](/guide/shell-integration) - Detailed setup and troubleshooting
- [Configuration Reference](/reference/configuration) - `auto_up` setting documentation
- [skybox up](/reference/up) - Manual container startup
