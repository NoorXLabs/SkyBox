# devbox hook

Output shell hook code for auto-starting containers when entering project directories.

## Usage

```bash
devbox hook <shell>
```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `shell` | Yes | Shell type: `bash` or `zsh` |

## Description

The `hook` command outputs shell code that integrates DevBox with your shell. When installed, this hook automatically starts containers when you `cd` into a DevBox project directory.

The hook:
- Runs on every prompt (via `PROMPT_COMMAND` for bash, `precmd` for zsh)
- Only triggers when the directory actually changes
- Runs container startup in the background (doesn't block your prompt)
- Respects the `auto_up` configuration setting per project

## Installation

Add the appropriate line to your shell configuration file:

### Bash

```bash
echo 'eval "$(devbox hook bash)"' >> ~/.bashrc
source ~/.bashrc
```

### Zsh

```bash
echo 'eval "$(devbox hook zsh)"' >> ~/.zshrc
source ~/.zshrc
```

## Configuration

The hook only auto-starts containers for projects with `auto_up` enabled. Enable it per-project:

```bash
devbox config set my-project auto_up true
```

Or globally in `~/.devbox/config.yaml`:

```yaml
defaults:
  auto_up: true
```

See [Shell Integration](/guide/shell-integration) for detailed configuration options.

## Examples

```bash
# Output bash hook code
devbox hook bash

# Output zsh hook code
devbox hook zsh

# Install for bash (one-time setup)
echo 'eval "$(devbox hook bash)"' >> ~/.bashrc

# Verify hook is active (bash)
echo "$PROMPT_COMMAND"
# Should contain: _devbox_hook
```

## Logging

Auto-up activity is logged to:

```
~/.devbox/logs/auto-up.log
```

View recent activity:

```bash
cat ~/.devbox/logs/auto-up.log
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Invalid or missing shell argument |

## See Also

- [Shell Integration Guide](/guide/shell-integration) - Detailed setup and troubleshooting
- [Configuration Reference](/reference/configuration) - `auto_up` setting documentation
- [devbox up](/reference/up) - Manual container startup
