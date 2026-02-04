# Troubleshooting

Common issues and solutions for DevBox.

## First Step: Run Doctor

Before diving into specific issues, run the built-in diagnostic tool:

```bash
devbox doctor
```

This checks Docker, Mutagen, SSH connectivity, and configuration in one command. It will identify most common problems and suggest fixes.

## Encryption Issues

### Forgotten Passphrase

**Symptoms:**
- Cannot decrypt project configuration
- `devbox` prompts for passphrase and rejects all attempts

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
   devbox config --validate
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
   devbox config show myproject
   ```
   Confirm the `sync_paths` entries use the correct relative format.

3. **Restart sync** after changing selective sync settings:
   ```bash
   devbox down myproject
   devbox up myproject
   ```

## Update Issues

### Mutagen Download Failures

**Symptoms:**
- `devbox update` fails during Mutagen binary download
- Network timeout or checksum mismatch errors

**Solutions:**

1. **Check network connectivity:**
   ```bash
   curl -I https://github.com/mutagen-io/mutagen/releases
   ```

2. **Retry the update:**
   ```bash
   devbox update
   ```

3. **Manual download** - if automated download keeps failing, manually download the Mutagen binary and place it at `~/.devbox/bin/mutagen`.

### Version Mismatches

**Symptoms:**
- Sync errors after updating
- `devbox doctor` reports Mutagen version issues

**Solutions:**

1. **Run the update command** to get the latest compatible version:
   ```bash
   devbox update
   ```

2. **Force re-download:**
   ```bash
   devbox update --force
   ```

## Batch Operation Issues

### Partial Failures in `--all` Mode

**Symptoms:**
- Some projects succeed while others fail during batch operations (e.g., `devbox down --all`)
- Mixed success/error output

**Solutions:**

1. **Check per-project errors** - the output lists which projects failed and why. Address each failure individually.

2. **Re-run for failed projects only:**
   ```bash
   devbox up failed-project
   ```

3. **Run diagnostics on failing projects:**
   ```bash
   devbox doctor
   devbox status failed-project
   ```

## Devcontainer Issues

### Container Won't Start After Config Changes

**Symptoms:**
- Container fails to start after editing `devcontainer.json`
- Build errors or invalid configuration

**Solutions:**

1. **Reset devcontainer configuration** to regenerate from template:
   ```bash
   devbox config devcontainer reset <project>
   ```

2. **Rebuild the container:**
   ```bash
   devbox up <project> --rebuild
   ```

## Connection Issues

### SSH Connection Failed

**Symptoms:**
- `devbox init` fails to connect
- `devbox browse` times out

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

2. **Specify key in devbox config:**
   ```bash
   devbox remote add myserver user@host --key ~/.ssh/specific_key
   ```

## Container Issues

### Container Won't Start

**Symptoms:**
- `devbox up` hangs or fails
- Container status shows "error"

**Solutions:**

1. **Check Docker is running:**
   ```bash
   docker ps
   ```

2. **Rebuild container:**
   ```bash
   devbox up myproject --rebuild
   ```

3. **Check devcontainer.json:**
   ```bash
   cat ~/.devbox/Projects/myproject/.devcontainer/devcontainer.json
   ```

### Container Not Found

**Symptoms:**
- `devbox shell` says container not found

**Solutions:**

1. **Start the container first:**
   ```bash
   devbox up myproject
   ```

2. **Check container status:**
   ```bash
   devbox status myproject
   ```

## Sync Issues

### Sync Not Working

**Symptoms:**
- Files not appearing on remote
- `devbox status` shows sync errors

**Solutions:**

1. **Check Mutagen status:**
   ```bash
   ~/.devbox/bin/mutagen sync list
   ```

2. **Restart sync session:**
   ```bash
   devbox down myproject
   devbox up myproject
   ```

3. **Check ignored files:**
   Review `defaults.ignore` in `~/.devbox/config.yaml`

### Sync Conflicts

**Symptoms:**
- Mutagen reports conflicts

**Solutions:**

1. **Check Mutagen conflicts:**
   ```bash
   ~/.devbox/bin/mutagen sync list --long
   ```

2. **Resolve manually:**
   Choose which version to keep and delete the other

## Session Issues

### Project Active on Another Machine

**Symptoms:**
- `devbox up` warns that the project is running on another machine
- Message: "This project is running on [machine]"

**Solutions:**

1. **Proper handoff:** On the other machine:
   ```bash
   devbox down myproject
   ```

2. **Continue anyway:** When prompted during `devbox up`, choose "Continue anyway" if you know the other machine is idle.

3. **Wait for expiry:** Sessions automatically expire after 24 hours if the other machine crashed without running `devbox down`.

### Stale Session

**Symptoms:**
- Session from a crashed machine
- Machine listed no longer exists or is unreachable

**Solutions:**

1. **Start the project:** Sessions expire after 24 hours automatically. If expired, `devbox up` proceeds without warning:
   ```bash
   devbox up myproject
   ```

2. **Continue past the warning:** If the session hasn't expired yet:
   ```bash
   devbox up myproject
   # Choose "Continue anyway" when prompted
   ```

3. **Bypass session check for shell access:**
   ```bash
   devbox shell myproject --force
   ```

## Configuration Issues

### Config File Corrupted

**Symptoms:**
- YAML parse errors
- Commands fail immediately

**Solutions:**

1. **Validate config:**
   ```bash
   devbox config --validate
   ```

2. **Reset config:**
   ```bash
   rm ~/.devbox/config.yaml
   devbox init
   ```

### Missing Remote

**Symptoms:**
- "Remote 'xxx' not found"

**Solutions:**

1. **List remotes:**
   ```bash
   devbox remote list
   ```

2. **Add missing remote:**
   ```bash
   devbox remote add myremote user@host
   ```

## Getting Help

If these solutions don't help:

1. **Run diagnostics:**
   ```bash
   devbox doctor
   ```

2. **Check project status:**
   ```bash
   devbox status myproject
   ```

3. **Run with verbose:**
   ```bash
   DEVBOX_DEBUG=1 devbox up myproject
   ```

4. **Report an issue:**
   [GitHub Issues](https://github.com/NoorChasib/DevBox/issues)
