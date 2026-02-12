---
title: Troubleshooting
description: Resolve common SkyBox issues with Docker, sync, SSH connections, and container startup. Run skybox doctor for automated diagnostics.
---

# Troubleshooting

Common issues and solutions for SkyBox.

## First Step: Run Doctor

Before diving into specific issues, run the built-in diagnostic tool:

```bash
skybox doctor
```

This checks Docker, Mutagen, editor setup, SSH connectivity, and configuration in one command. It will identify most common problems and suggest fixes.

::: tip Debug Mode
For verbose output on any command, prefix with `DEBUG=1`:
```bash
DEBUG=1 skybox up myproject
```
:::

## Editor Issues

### Editor Command Not Found (for example `zed`)

**Symptoms:**
- `skybox up --editor` or `skybox open --editor` fails to launch your editor
- Error mentions command not found (`ENOENT`)

**Solutions:**

1. **Run doctor** to inspect editor setup:
   ```bash
   skybox doctor
   ```

2. **Set an explicit editor command** that works on your machine:
   ```bash
   skybox config set editor "open -a Zed"
   ```
   Other examples:
   - `skybox config set editor "code --reuse-window"`
   - `skybox config set editor "cursor"`

3. **Install editor CLI tools** if you prefer direct commands (`zed`, `code`, `cursor`) instead of `open -a`.

On macOS, SkyBox automatically tries a built-in app fallback for supported GUI editors (Cursor, VS Code, VS Code Insiders, Zed) when the CLI command is missing from `PATH`.

## Encryption Issues

### Forgotten Passphrase

**Symptoms:**
- Cannot decrypt project configuration
- `skybox` prompts for passphrase and rejects all attempts

**Solutions:**

::: danger Data Loss Warning
Encrypted data **cannot be recovered** without the passphrase. There is no reset or recovery mechanism. If you have lost your passphrase, the encrypted configuration is permanently inaccessible.
:::

1. **Re-initialize the project** from an unencrypted backup or by re-creating the configuration from scratch.

### Decryption Errors

**Symptoms:**
- `Error: Decryption failed` when running commands
- Garbled output from config operations

**Solutions:**

1. **Verify the correct passphrase** - ensure no extra whitespace or encoding issues.
2. **Check config file integrity:**
   ```bash
   skybox config --validate
   ```
3. **Re-encrypt from a clean state** if the encrypted file was corrupted (e.g., partial write during crash).

See also: [Concepts: Encryption](/guide/concepts#encryption), [`skybox encrypt`](/reference/encryption)

## Selective Sync Issues

### Sync Path Not Syncing

**Symptoms:**
- Specified paths are not being synchronized
- No errors shown but files are missing on remote

**Solutions:**

1. **Check path format** - selective sync paths must be:
   - **Relative** to the project root (no leading `/`)
   - No `..` parent traversal
   - Example: `src/components` (correct), `/src/components` (incorrect), `../other` (incorrect)

2. **Verify configuration:**
   Open `~/.skybox/config.yaml` and check your project's configuration:
   ```bash
   skybox config
   ```
   Confirm the `sync_paths` entries use the correct relative format.

3. **Restart sync** after changing selective sync settings:
   ```bash
   skybox down myproject
   skybox up myproject
   ```

See also: [Concepts: Selective Sync](/guide/concepts#selective-sync), [Configuration: Sync Modes](/reference/configuration#sync-modes)

## Mutagen Issues

### Mutagen Binary Missing or Corrupted

**Symptoms:**
- Mutagen binary not found after setup
- Sync operations fail unexpectedly

**Solutions:**

1. **Run doctor** to diagnose and repair:
   ```bash
   skybox doctor
   ```
   Doctor will detect a missing or outdated Mutagen binary and re-extract it automatically.

2. **Re-run init** to re-extract the bundled binary:
   ```bash
   skybox init
   ```

3. **Dev mode only** — if running from source and the download fallback fails, check network connectivity:
   ```bash
   curl -I https://github.com/mutagen-io/mutagen/releases
   ```

4. **Manual installation** — download the Mutagen binary and place it at `~/.skybox/bin/mutagen`.

### Version Mismatches

**Symptoms:**
- Sync errors after updating SkyBox
- `skybox doctor` reports Mutagen version issues

**Solutions:**

1. **Run doctor** — it will detect the version mismatch and re-extract the correct bundled version:
   ```bash
   skybox doctor
   ```

2. **Upgrade SkyBox** — Mutagen is bundled with SkyBox, so upgrading SkyBox brings the correct Mutagen version automatically:
   ```bash
   skybox update
   ```

## Batch Operation Issues

### Partial Failures in `--all` Mode

**Symptoms:**
- Some projects succeed while others fail during batch operations (e.g., `skybox down --all`)
- Mixed success/error output

::: info Batch behavior
When using `--all`, SkyBox processes projects sequentially. If a project fails, the batch continues with remaining projects and reports a success/failure summary at the end.
:::

**Solutions:**

1. **Check per-project errors** - the output lists which projects failed and why. Address each failure individually.

2. **Re-run for failed projects only:**
   ```bash
   skybox up failed-project
   ```

3. **Run diagnostics on failing projects:**
   ```bash
   skybox doctor
   skybox status failed-project
   ```

## Devcontainer Issues

### Container Won't Start After Config Changes

**Symptoms:**
- Container fails to start after editing `devcontainer.json`
- Build errors or invalid configuration

**Solutions:**

1. **Reset devcontainer configuration** to regenerate from template:
   ```bash
   skybox config devcontainer reset <project>
   ```

2. **Rebuild the container:**
   ```bash
   skybox up <project> --rebuild
   ```

## Connection Issues

### SSH Connection Failed

**Symptoms:**
- `skybox init` fails to connect
- [`skybox browse`](/reference/browse) times out

**Solutions:**

1. **Test SSH manually:**
   ```bash
   ssh your-host
   ```

2. **Check SSH config:**
   ```bash
   cat ~/.ssh/config
   ```

3. **Verify host is reachable:**
   ```bash
   ping your-host
   ```

4. **Check SSH key permissions:**
   ```bash
   chmod 600 ~/.ssh/id_rsa
   chmod 644 ~/.ssh/id_rsa.pub
   ```

### Passphrase-Protected Keys

**Symptoms:**
- SkyBox prompts for a passphrase during commands
- SSH key is not loaded in `ssh-agent`

**Solutions:**

1. **On macOS** — Enable `useKeychain: true` in your remote configuration to persist the passphrase across reboots:
   ```yaml
   remotes:
     myserver:
       host: example.com
       user: deploy
       path: ~/code
       key: ~/.ssh/id_ed25519
       useKeychain: true
   ```

2. **On Linux** — Load your key into `ssh-agent` before starting SkyBox, or add it to your shell profile (e.g., `~/.bashrc`):
   ```bash
   ssh-add ~/.ssh/your_key
   ```

3. **If `ssh-add` fails** with "Could not open a connection to your authentication agent", start the agent first:
   ```bash
   eval $(ssh-agent)
   ssh-add ~/.ssh/your_key
   ```

### Permission Denied

**Symptoms:**
- `Permission denied (publickey)`

**Solutions:**

1. **Add key to SSH agent** (both passwordless and passphrase-protected keys are supported):
   ```bash
   ssh-add ~/.ssh/id_rsa
   ```

2. **Specify key in skybox config:**
   ```bash
   skybox remote add myserver user@host --key ~/.ssh/specific_key
   ```

3. **For passphrase-protected keys**, ensure the key is loaded in `ssh-agent` (see [Passphrase-Protected Keys](#passphrase-protected-keys) above).

## Container Issues

### Container Won't Start

**Symptoms:**
- `skybox up` hangs or fails
- Container status shows "error"

**Solutions:**

1. **Check Docker is running:**
   ```bash
   docker ps
   ```

2. **Rebuild container:**
   ```bash
   skybox up myproject --rebuild
   ```

3. **Check container logs for errors:**
   ```bash
   skybox logs myproject
   ```
   See [`skybox logs`](/reference/logs) for more options.

4. **Check devcontainer.json:**
   ```bash
   cat ~/.skybox/Projects/myproject/.devcontainer/devcontainer.json
   ```

### Container Not Found

**Symptoms:**
- `skybox shell` says container not found

**Solutions:**

1. **Start the container first:**
   ```bash
   skybox up myproject
   ```

2. **Check container status:**
   ```bash
   skybox status myproject
   ```

See also: [Concepts: Containers](/guide/concepts#containers), [`skybox up`](/reference/up)

## Sync Issues

### Sync Not Working

**Symptoms:**
- Files not appearing on remote
- `skybox status` shows sync errors

**Solutions:**

1. **Check Mutagen status:**
   ```bash
   ~/.skybox/bin/mutagen sync list
   ```

2. **Check container logs** for errors that may indicate sync-related issues:
   ```bash
   skybox logs myproject
   ```

3. **Restart sync session:**
   ```bash
   skybox down myproject
   skybox up myproject
   ```

4. **Check ignored files:**
   Review `defaults.ignore` in `~/.skybox/config.yaml`

### Sync Conflicts

**Symptoms:**
- Mutagen reports conflicts

**Solutions:**

1. **Check Mutagen conflicts:**
   ```bash
   ~/.skybox/bin/mutagen sync list --long
   ```

2. **Resolve manually:**
   Choose which version to keep and delete the other

See also: [Concepts: Sync](/guide/concepts#sync), [Configuration: Sync Modes](/reference/configuration#sync-modes)

## Session Issues

### Project Active on Another Machine

**Symptoms:**
- `skybox up` warns that the project is running on another machine
- Message: "This project is running on [machine]"

**Solutions:**

1. **Proper handoff:** On the other machine:
   ```bash
   skybox down myproject
   ```

2. **Continue anyway:** When prompted during `skybox up`, choose "Continue anyway" if you know the other machine is idle.

3. **Wait for expiry:** Sessions automatically expire after 24 hours if the other machine crashed without running `skybox down`.

### Stale Session

**Symptoms:**
- Session from a crashed machine
- Machine listed no longer exists or is unreachable

**Solutions:**

1. **Start the project:** Sessions expire after 24 hours automatically. If expired, `skybox up` proceeds without warning:
   ```bash
   skybox up myproject
   ```

2. **Continue past the warning:** If the session hasn't expired yet:
   ```bash
   skybox up myproject
   # Choose "Continue anyway" when prompted
   ```

3. **Bypass session check for shell access:**
   ```bash
   skybox shell myproject --force
   ```

See also: [Concepts: Session System](/guide/concepts#session-system), [Multi-Machine Workflow](/guide/workflows/multi-machine)

## Configuration Issues

### Config File Corrupted

**Symptoms:**
- YAML parse errors
- Commands fail immediately

**Solutions:**

1. **Validate config:**
   ```bash
   skybox config --validate
   ```

2. **Reset config:**
   ```bash
   rm ~/.skybox/config.yaml
   skybox init
   ```

### Missing Remote

**Symptoms:**
- "Remote 'xxx' not found"

**Solutions:**

1. **List remotes:**
   ```bash
   skybox remote list
   ```

2. **Add missing remote:**
   ```bash
   skybox remote add myremote user@host
   ```

## Input Validation Errors

SkyBox validates user input to prevent security issues. Here are common validation errors and how to resolve them.

### SSH Field Validation

When adding remotes or running `skybox init`, SSH fields (hostname, username, key path) are restricted to alphanumeric characters and `@ . _ ~ : - /`. If you see errors like:

- **"Hostname contains invalid characters"** — Remove spaces, quotes, or special characters from the hostname
- **"Username cannot contain newlines"** — Re-enter the username without line breaks

### Project Name Restrictions

Project names cannot contain:
- Path separators (`/` or `\`)
- Traversal sequences (`..`)
- Leading dashes (`-`)

If you see **"Project name cannot contain path separators"**, use a simple name like `my-app` instead.

### Remote Path Restrictions

Remote paths cannot contain shell metacharacters. If you see:

- **"Remote path cannot contain command substitution"** — Remove `$()`, `${}`, or backtick expressions from the path
- **"Remote path cannot contain shell metacharacters"** — Remove `;`, `|`, or `&` characters from the path

Use a plain path like `~/code` or `/home/user/projects`.

## Security & Integrity Issues

### Config Validation Errors

**Symptoms:**
- `skybox doctor` reports config validation failure
- Error message: `Config file exists but failed validation`

```
✗ Configuration: Config file exists but failed validation
```

This means your `~/.skybox/config.yaml` doesn't match the expected schema.

**Common causes:**

1. **Invalid field types** — e.g., `auto_up: "yes"` instead of `auto_up: true`
2. **Unknown fields** — typos in field names
3. **Missing required fields** — `host` and `path` are required for each remote

**Solutions:**

1. **Open your config and check for YAML syntax errors or invalid values:**
   ```bash
   $EDITOR ~/.skybox/config.yaml
   ```

2. **Validate config:**
   ```bash
   skybox config --validate
   ```

3. **Reset config** if the file is beyond repair:
   ```bash
   rm ~/.skybox/config.yaml
   skybox init
   ```

### Session Integrity Warning

**Symptoms:**
- Warning during `skybox up`: `Session file integrity check failed`
- Session treated as invalid despite existing session file

```
Warning: Session file integrity check failed
```

This means a session file was modified outside of SkyBox (the HMAC-SHA256 signature doesn't match). The session will be treated as invalid.

**Common causes:**
- Manual editing of `.skybox/state.lock` files
- File corruption during sync

**Solutions:**

1. **Stop and restart the project:**
   ```bash
   skybox down myproject
   skybox up myproject
   ```

2. **If the project won't stop cleanly**, the session file can be removed manually:
   ```bash
   rm ~/.skybox/Projects/myproject/.skybox/state.lock
   skybox up myproject
   ```

### Lockfile Verification Failed

**Symptoms:**
- Error message: `Lockfile integrity check failed`
- SkyBox refuses to start

This is a supply-chain security check on `bun.lock`. It means the lockfile was modified in a way that doesn't match expected integrity hashes.

**Solutions:**

1. **Reinstall dependencies from a clean state:**
   ```bash
   rm bun.lock
   bun install
   ```

2. **Verify no unexpected changes** were introduced to your dependencies after reinstalling.

See also: [Concepts: Session System](/guide/concepts#session-system), [Configuration](/reference/configuration)

## Getting Help

If these solutions don't help:

1. **Run diagnostics:**
   ```bash
   skybox doctor
   ```

2. **Check project status:**
   ```bash
   skybox status myproject
   ```

3. **Run with verbose:**
   ```bash
   DEBUG=1 skybox up myproject
   ```

4. **Report an issue:**
   [GitHub Issues](https://github.com/NoorXLabs/SkyBox/issues)

## Next Steps

- [Daily Development Workflow](/guide/workflows/daily-development) - Day-to-day patterns for working with SkyBox
- [Core Concepts](/guide/concepts) - Understand how projects, containers, and sync work together
- [`skybox doctor`](/reference/doctor) - Built-in diagnostic tool reference
