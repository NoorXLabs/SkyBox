# devbox encrypt

Manage project encryption at rest.

## Usage

```bash
devbox encrypt <subcommand> [project]
```

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `enable [project]` | Enable encryption for a project |
| `disable [project]` | Disable encryption for a project |

## Description

The `encrypt` command manages per-project encryption at rest. When encryption is enabled for a project, `devbox down` encrypts the project directory on the remote server, and `devbox up` decrypts it before syncing.

This protects project files on the remote server when not actively working. During active sessions, files are plaintext for Mutagen sync compatibility.

### How It Works

- **On `devbox down`:** Project files are tarred, encrypted with AES-256-GCM, and plaintext is deleted from the remote
- **On `devbox up`:** The encrypted archive is decrypted and extracted before sync starts
- **Key derivation:** Argon2id (memory-hard KDF) derives a 256-bit key from your passphrase
- **Passphrase:** Never stored. You must enter it on every `devbox up` and `devbox down`

### Enable Encryption

```bash
devbox encrypt enable [project]
```

If no project is specified, an interactive selection is shown.

Enabling encryption requires a double confirmation:

1. Warning about passphrase-only recovery
2. Confirmation that you understand the risks

After confirmation, you set your passphrase. A random salt is generated and stored in the project config.

### Disable Encryption

```bash
devbox encrypt disable [project]
```

If no project is specified, only projects with encryption enabled are shown.

You must enter your passphrase to disable encryption. If an encrypted archive exists on the remote, it is automatically decrypted and extracted.

### Encryption Details

| Component | Implementation |
|-----------|---------------|
| Key derivation | Argon2id (64 MiB memory, 2 passes) |
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
| Interrupted `devbox down` | Plaintext remains on remote, safe to retry |
| Interrupted `devbox up` | Archive remains intact, safe to retry |

## Examples

```bash
# Enable encryption for a project
devbox encrypt enable my-app

# Enable with interactive project selection
devbox encrypt enable

# Disable encryption
devbox encrypt disable my-app
```

### Workflow Example

```bash
# Enable encryption
devbox encrypt enable my-app

# Work on the project (passphrase required to decrypt)
devbox up my-app
# Enter passphrase...

# Done working (passphrase required to encrypt)
devbox down my-app
# Enter passphrase...
# Project is now encrypted on remote
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (no config, passphrase required, decryption failed) |

## See Also

- [devbox up](/reference/up) - Decrypts project on start
- [devbox down](/reference/down) - Encrypts project on stop
- [devbox config](/reference/config) - View configuration
- [Configuration Reference](/reference/configuration) - Full config format
