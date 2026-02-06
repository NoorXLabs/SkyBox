# Troubleshooting

Common issues and solutions for SkyBox.

## First Step: Run Doctor

Before diving into specific issues, run the built-in diagnostic tool:

```bash
skybox doctor
```

This checks Docker, Mutagen, SSH connectivity, and configuration in one command. It will identify most common problems and suggest fixes.

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
   ```bash
   skybox config show myproject
   ```
   Confirm the `sync_paths` entries use the correct relative format.

3. **Restart sync** after changing selective sync settings:
   ```bash
   skybox down myproject
   skybox up myproject
   ```

## Update Issues

### Mutagen Download Failures

**Symptoms:**
- `skybox update` fails during Mutagen binary download
- Network timeout or checksum mismatch errors

**Solutions:**

1. **Check network connectivity:**
   ```bash
   curl -I https://github.com/mutagen-io/mutagen/releases
   ```

2. **Retry the update:**
   ```bash
   skybox update
   ```

3. **Manual download** - if automated download keeps failing, manually download the Mutagen binary and place it at `~/.skybox/bin/mutagen`.

### Version Mismatches

**Symptoms:**
- Sync errors after updating
- `skybox doctor` reports Mutagen version issues

**Solutions:**

1. **Run the update command** to get the latest compatible version:
   ```bash
   skybox update
   ```

2. **Force re-download:**
   ```bash
   skybox update --force
   ```

## Batch Operation Issues

### Partial Failures in `--all` Mode

**Symptoms:**
- Some projects succeed while others fail during batch operations (e.g., `skybox down --all`)
- Mixed success/error output

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
- `skybox browse` times out

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

### Permission Denied

**Symptoms:**
- `Permission denied (publickey)`

**Solutions:**

1. **Add key to SSH agent:**
   ```bash
   ssh-add ~/.ssh/id_rsa
   ```

2. **Specify key in skybox config:**
   ```bash
   skybox remote add myserver user@host --key ~/.ssh/specific_key
   ```

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

3. **Check devcontainer.json:**
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

2. **Restart sync session:**
   ```bash
   skybox down myproject
   skybox up myproject
   ```

3. **Check ignored files:**
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
   SKYBOX_DEBUG=1 skybox up myproject
   ```

4. **Report an issue:**
   [GitHub Issues](https://github.com/NoorXLabs/SkyBox/issues)
