# Auto-Up on Directory Enter

> **Status:** Draft
> **Author:** Claude
> **Date:** 2026-02-02
> **Priority:** Medium

## Summary

Add shell hooks (bash/zsh) that automatically start SkyBox containers when users `cd` into project directories. This provides a seamless developer experience similar to direnv, where project environments "just work" when you enter the project folder.

## Motivation

Currently users must manually run `skybox up` every time they want to work on a project. This adds friction, especially when switching between projects frequently. Auto-up eliminates this friction by detecting when the user enters a SkyBox project directory and starting the container automatically.

## Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Shell                             │
│  ┌───────────────────┐    ┌────────────────────────────────┐    │
│  │ PROMPT_COMMAND or │    │                                │    │
│  │ precmd (zsh)      │───>│ _skybox_hook() shell function  │    │
│  └───────────────────┘    │  - Check if in SkyBox project  │    │
│                           │  - Call `skybox hook-check`    │    │
│                           └───────────────┬────────────────┘    │
└──────────────────────────────────┬────────┘                     │
                                   │                              │
                                   ▼                              │
┌─────────────────────────────────────────────────────────────────┐
│  skybox hook-check (hidden subcommand)                          │
│  - Resolves project from cwd                                    │
│  - Checks container status                                      │
│  - If stopped → runs `skybox up --no-prompt`                   │
│  - Silent output (all output goes to temp log)                  │
│  - Returns exit code 0 always (don't break shell)              │
└─────────────────────────────────────────────────────────────────┘
```

### Approach: Hook via PROMPT_COMMAND (bash) / precmd (zsh)

Following the proven pattern from [direnv](https://direnv.net/docs/hook.html), we'll integrate with the shell's prompt mechanism rather than wrapping `cd`. This is more robust because:

1. Works even if user enters directory via pushd, completion, or other means
2. Doesn't interfere with other tools that might wrap cd
3. Runs after the directory change is complete
4. Standard pattern used by direnv, asdf, rtx, etc.

### New Command: `skybox hook`

```bash
skybox hook <shell>   # Generate shell hook code
skybox hook-check     # Hidden: check and auto-start (called by hook)
```

**`skybox hook bash`** outputs:
```bash
_skybox_hook() {
  local prev_dir="${_SKYBOX_PREV_DIR:-}"
  local cur_dir="$PWD"

  # Only run if directory changed
  if [[ "$prev_dir" != "$cur_dir" ]]; then
    _SKYBOX_PREV_DIR="$cur_dir"
    skybox hook-check 2>/dev/null &
  fi
}

# Append to PROMPT_COMMAND
if [[ ! "$PROMPT_COMMAND" =~ _skybox_hook ]]; then
  PROMPT_COMMAND="_skybox_hook${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
fi
```

**`skybox hook zsh`** outputs:
```zsh
_skybox_hook() {
  local prev_dir="${_SKYBOX_PREV_DIR:-}"
  local cur_dir="$PWD"

  # Only run if directory changed
  if [[ "$prev_dir" != "$cur_dir" ]]; then
    _SKYBOX_PREV_DIR="$cur_dir"
    skybox hook-check 2>/dev/null &
  fi
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd _skybox_hook
```

### Key Design Decisions

1. **Background execution (`&`)**: The hook runs `skybox hook-check` in the background so it doesn't block the prompt. Users get immediate shell responsiveness.

2. **Track previous directory**: Only trigger when directory actually changes, not on every prompt.

3. **Silent by default**: All output from hook-check goes to /dev/null. Users can check `~/.skybox/logs/auto-up.log` if needed.

4. **Non-fatal**: hook-check always exits 0 to never break the shell.

5. **Idempotent**: If container is already running, hook-check does nothing.

6. **No editor/shell prompt**: Uses `--no-prompt` mode to prevent interactive prompts from background process.

### `skybox hook-check` Implementation

This hidden subcommand (not shown in --help) does:

1. Resolve project from cwd using `resolveProjectFromCwd()`
2. If not in a project → exit silently
3. Check if auto-up is enabled for project (config option)
4. Check container status via `getContainerStatus()`
5. If container is not running → spawn `skybox up <project> --no-prompt` with output to log file
6. Exit 0 always

### Configuration

Add optional per-project and global config:

```yaml
# ~/.skybox/config.yaml
defaults:
  auto_up: false  # Global default (opt-in)

projects:
  my-app:
    remote: work
    auto_up: true  # Per-project override
```

The hierarchy is:
1. Per-project `auto_up` (if set) → use it
2. Global `defaults.auto_up` (if set) → use it
3. Neither set → default to `false` (no auto-up)

### Supported Shells

Initial support:
- **bash** (Linux, macOS)
- **zsh** (default on macOS, common on Linux)

Future consideration:
- fish (different syntax, uses functions)

## Implementation Tasks

### Phase 1: Core Hook Infrastructure

- [ ] **1.1** Add `skybox hook <shell>` command
  - New file: `src/commands/hook.ts`
  - Accepts: `bash`, `zsh`
  - Outputs shell-specific hook code to stdout
  - Register in `src/index.ts`

- [ ] **1.2** Add `skybox hook-check` hidden subcommand
  - Same file: `src/commands/hook.ts`
  - Hidden from `--help` (no `.description()`)
  - Resolve project from cwd
  - Check config for auto_up setting
  - Check container status
  - Spawn `skybox up --no-prompt` if needed
  - Log to `~/.skybox/logs/auto-up.log`
  - Always exit 0

### Phase 2: Configuration

- [ ] **2.1** Add `auto_up` config option
  - Update `SyncDefaults` in `src/types/index.ts` to add `auto_up?: boolean`
  - Update `ProjectConfigV2` in `src/types/index.ts` to add `auto_up?: boolean`
  - No constants needed (boolean with default)

- [ ] **2.2** Add helper to resolve auto_up setting
  - New function in `src/lib/config.ts`: `isAutoUpEnabled(projectName: string, config: SkyboxConfigV2): boolean`
  - Checks project config first, falls back to defaults, then to false

### Phase 3: Shell Script Generation

- [ ] **3.1** Implement bash hook generator
  - Function: `generateBashHook(): string`
  - Returns properly escaped shell script
  - Uses PROMPT_COMMAND

- [ ] **3.2** Implement zsh hook generator
  - Function: `generateZshHook(): string`
  - Uses add-zsh-hook and precmd
  - Handles Oh My Zsh compatibility

### Phase 4: Testing

- [ ] **4.1** Add unit tests for config resolution
  - Test project-level override
  - Test global default
  - Test fallback to false

- [ ] **4.2** Add unit tests for hook script generation
  - Verify bash output is valid bash
  - Verify zsh output is valid zsh
  - Test escaping

### Phase 5: Documentation

- [ ] **5.1** Add hook setup docs
  - Installation instructions for bash/zsh
  - Troubleshooting section
  - Note about log file location

## File Changes

| File | Change |
|------|--------|
| `src/commands/hook.ts` | **New** - Hook command and hook-check logic |
| `src/index.ts` | Register hook command |
| `src/types/index.ts` | Add `auto_up` to SyncDefaults and ProjectConfigV2 |
| `src/lib/config.ts` | Add `isAutoUpEnabled()` helper |
| `src/lib/constants.ts` | Add `AUTO_UP_LOG_FILE = "auto-up.log"` |
| `src/lib/paths.ts` | Add `getAutoUpLogPath()` helper |
| `src/commands/__tests__/hook.test.ts` | **New** - Unit tests |
| `docs/guides/shell-integration.md` | **New** - User documentation |

## Usage Example

After setup, the workflow becomes:

```bash
# One-time setup (add to .bashrc or .zshrc)
$ echo 'eval "$(skybox hook bash)"' >> ~/.bashrc
$ source ~/.bashrc

# Enable auto-up for a project
$ skybox config set my-app auto_up true

# Now just cd into the project
$ cd ~/.skybox/Projects/my-app
# Container starts automatically in background!
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Hook slows down shell | Background execution with `&` |
| Silent failures confuse users | Log to `~/.skybox/logs/auto-up.log` |
| Conflicts with other hook systems | Use standard PROMPT_COMMAND/precmd pattern |
| User forgets they enabled auto-up | `skybox status` shows auto_up=true in output |
| Container starts when user just passing through | Track _SKYBOX_PREV_DIR to only trigger on actual cd |

## Alternatives Considered

### 1. Wrap `cd` function
- **Rejected**: Conflicts with other tools, doesn't catch pushd/popd, fragile

### 2. Use chpwd hook (zsh only)
- **Rejected**: Not portable to bash, would need two completely different implementations

### 3. Create a daemon process
- **Rejected**: Overkill for this feature, adds complexity

### 4. Use filesystem watchers
- **Rejected**: Requires background daemon, platform-specific, high complexity

## Open Questions

1. **Should fish shell be supported in v1?**
   - Recommendation: No, add in follow-up. Focus on bash/zsh which cover 95%+ of users.

2. **Should there be a visual indicator when auto-up triggers?**
   - Recommendation: No, keep it silent. Users can check logs or status if curious.

3. **Should we add `skybox hook init` to auto-add to shell rc file?**
   - Recommendation: Maybe in v2. For now, manual setup gives users control.

## Success Criteria

- [ ] `skybox hook bash` outputs valid, working bash code
- [ ] `skybox hook zsh` outputs valid, working zsh code
- [ ] Containers auto-start when entering project directories (if enabled)
- [ ] Shell prompt is not blocked/delayed
- [ ] Failures are logged but don't break shell
- [ ] Configuration allows per-project control

## References

- [direnv hook documentation](https://direnv.net/docs/hook.html)
- [asdf shell integration](https://asdf-vm.com/guide/getting-started.html#_3-install-asdf)
- [nvm shell integration](https://github.com/nvm-sh/nvm#deeper-shell-integration)

---

*Last updated: 2026-02-02*
