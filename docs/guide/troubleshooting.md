# Troubleshooting

Common issues and solutions for DevBox.

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

## Lock Issues

### Project Locked by Another Machine

**Symptoms:**
- `devbox up` fails with lock error
- Message: "Project is locked by [machine]"

**Solutions:**

1. **Proper handoff:** On the other machine:
   ```bash
   devbox down myproject
   ```

2. **Force takeover (use with caution):**
   ```bash
   devbox up myproject --force
   ```

### Stale Lock

**Symptoms:**
- Lock from crashed session
- Machine listed no longer exists

**Solutions:**

1. **Force acquire lock:**
   ```bash
   devbox up myproject --force
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

1. **Check logs:**
   ```bash
   devbox status myproject --detailed
   ```

2. **Run with verbose:**
   ```bash
   DEVBOX_DEBUG=1 devbox up myproject
   ```

3. **Report an issue:**
   [GitHub Issues](https://github.com/NoorChasib/DevBox/issues)
