# Shell Integration

Automatically start DevBox containers when you `cd` into a project directory.

## Overview

The DevBox shell hook integrates with your shell to detect when you navigate into a DevBox project directory. When enabled, it automatically starts the container in the background, so your development environment is ready by the time you need it.

**Benefits:**

- No manual `devbox up` needed
- Container starts silently in the background
- Does not block your shell prompt
- Only triggers on actual directory changes

## Installation

### Bash

Add the hook to your `~/.bashrc`:

```bash
echo 'eval "$(devbox hook bash)"' >> ~/.bashrc
source ~/.bashrc
```

### Zsh

Add the hook to your `~/.zshrc`:

```bash
echo 'eval "$(devbox hook zsh)"' >> ~/.zshrc
source ~/.zshrc
```

## Configuration

The shell hook only auto-starts containers for projects with `auto_up` enabled. By default, this is disabled (opt-in).

### Enable for a Specific Project

```bash
devbox config set my-project auto_up true
```

Or edit `~/.devbox/config.yaml` directly:

```yaml
projects:
  my-project:
    remote: work
    auto_up: true
```

### Enable Globally

To auto-start all projects by default:

```yaml
defaults:
  auto_up: true

projects:
  my-project:
    remote: work
```

Per-project settings override the global default:

```yaml
defaults:
  auto_up: true  # Enable for all projects

projects:
  my-project:
    remote: work
    auto_up: false  # Disable for this specific project
```

## How It Works

1. **Hook Registration**
   - Bash: Appends to `PROMPT_COMMAND`
   - Zsh: Registers a `precmd` hook via `add-zsh-hook`

2. **Directory Change Detection**
   - Tracks the previous directory in `_DEVBOX_PREV_DIR`
   - Only triggers when `$PWD` differs from the previous directory

3. **Project Resolution**
   - Checks if the current directory is inside `~/.devbox/Projects/`
   - Extracts the project name from the path

4. **Auto-Start Logic**
   - Verifies `auto_up` is enabled for the project
   - Checks if the container is already running
   - If not running, spawns `devbox up <project> --no-prompt` in the background

5. **Background Execution**
   - The `devbox up` process runs detached from your shell
   - Output is logged to `~/.devbox/logs/auto-up.log`
   - Your shell prompt returns immediately

## Troubleshooting

### Check the Log File

All auto-up activity is logged:

```bash
cat ~/.devbox/logs/auto-up.log
```

Example output:

```
[2024-01-15T10:30:00.000Z] [my-project] Auto-starting container...
[2024-01-15T10:30:05.000Z] [my-project] Container started successfully
```

### Verify the Hook Is Active

**Bash:**

```bash
echo "$PROMPT_COMMAND"
# Should contain: _devbox_hook
```

**Zsh:**

```bash
typeset -f _devbox_hook
# Should output the function definition
```

### Container Not Starting?

1. **Check if auto_up is enabled:**

   ```bash
   devbox config show my-project
   ```

   Look for `auto_up: true` in the output.

2. **Verify you are in a DevBox project directory:**

   ```bash
   pwd
   # Should be inside ~/.devbox/Projects/<project-name>
   ```

3. **Check if devbox is in your PATH:**

   ```bash
   which devbox
   ```

4. **Try running the check manually:**

   ```bash
   devbox hook-check
   ```

   This is the hidden command the hook calls. It should exit silently if everything is working.

### Disable the Hook Temporarily

To disable shell integration without removing it:

```bash
unset -f _devbox_hook
```

This lasts until you open a new shell.

## See Also

- [Daily Development](/guide/workflows/daily-development) - Manual startup workflow
- [devbox up](/reference/up) - Start a development container
- [Configuration](/reference/configuration) - DevBox config reference
