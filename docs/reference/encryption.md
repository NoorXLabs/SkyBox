---
title: skybox encrypt
description: Manage project encryption at rest with skybox encrypt. Encrypt and decrypt remote project files using AES-256-GCM.
---

# skybox encrypt

Manage project encryption at rest.

<!-- COMMAND-SPEC:START -->
## Usage

```bash
skybox encrypt [options] [subcommand] [project]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `[subcommand]` | Encryption subcommand (enable or disable). |
| `[project]` | Optional project name. If omitted, interactive selection is used. |

## Options

None.

## Global Options

| Option | Description |
|--------|-------------|
| `-h, --help` | display help for command |
| `-v, --version` | output the version number |
| `--dry-run` | Preview commands without executing them |
<!-- COMMAND-SPEC:END -->

## Description

The `encrypt` command manages per-project encryption at rest. When encryption is enabled for a project, `skybox down` encrypts the project directory on the remote server, and `skybox up` decrypts it before syncing.

This protects project files on the remote server when not actively working. During active sessions, files are plaintext for Mutagen sync compatibility.

### How It Works

- **On `skybox down`:** Project files are tarred, encrypted with AES-256-GCM, and plaintext is deleted from the remote
- **On `skybox up`:** The encrypted archive is decrypted and extracted before sync starts
- **Key derivation:** Argon2id (memory-hard KDF) derives a 256-bit key from your passphrase
- **Passphrase:** Never stored. You must enter it on every `skybox up` and `skybox down`

### Enable Encryption

```bash
skybox encrypt enable [project]
```

If no project is specified, an interactive selection is shown.

Enabling encryption requires a double confirmation:

1. Warning about passphrase-only recovery
2. Confirmation that you understand the risks

After confirmation, you set your passphrase. A random salt is generated and stored in the project config.

### Disable Encryption

```bash
skybox encrypt disable [project]
```

If no project is specified, only projects with encryption enabled are shown.

You must enter your passphrase to disable encryption. If an encrypted archive exists on the remote, it is automatically decrypted and extracted.

### Encryption Details

| Component | Implementation |
|-----------|---------------|
| Key derivation | Argon2id (64 MiB memory, 3 iterations, parallelism 4) |
| Encryption | AES-256-GCM via `node:crypto` |
| Salt | Random 16 bytes per project, stored in config |
| Passphrase | Never stored — entered on every operation |

### Remote Directory Layout

**When encrypted (project not in use):**

```
~/code/myproject/myproject.tar.enc    # encrypted archive
```

**During active work:**

```
~/code/myproject/                     # plaintext, actively synced
```

### Config Format

Per-project encryption in `config.yaml`:

```yaml
projects:
  my-app:
    remote: work
    encryption:
      enabled: true
      salt: "a1b2c3d4..."
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Wrong passphrase | 3 attempts allowed, then exits |
| Forgot passphrase | Data cannot be recovered — no reset mechanism |
| Interrupted `skybox down` | Plaintext remains on remote, safe to retry |
| Interrupted `skybox up` | Archive remains intact, safe to retry |

## Examples

```bash
# Enable encryption for a project
skybox encrypt enable my-app

# Enable with interactive project selection
skybox encrypt enable

# Disable encryption
skybox encrypt disable my-app
```

### Workflow Example

```bash
# Enable encryption
skybox encrypt enable my-app

# Work on the project (passphrase required to decrypt)
skybox up my-app
# Enter passphrase...

# Done working (passphrase required to encrypt)
skybox down my-app
# Enter passphrase...
# Project is now encrypted on remote
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (no config, passphrase required, decryption failed) |

## See Also

- [skybox up](/reference/up) - Decrypts project on start
- [skybox down](/reference/down) - Encrypts project on stop
- [skybox config](/reference/config) - View configuration
- [Configuration Reference](/reference/configuration) - Full config format
