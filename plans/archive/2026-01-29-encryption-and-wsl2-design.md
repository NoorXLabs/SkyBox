# Design: Project Encryption at Rest & WSL2 Support

> **Date:** 2026-01-29
> **Status:** Approved

---

## Table of Contents

1. [Feature 1: WSL2 Support](#feature-1-wsl2-support)
2. [Feature 2: Project Encryption at Rest](#feature-2-project-encryption-at-rest)

---

## Feature 1: WSL2 Support

### Summary

SkyBox runs on Bun (TypeScript) with Unix shell semantics. WSL2 provides a full Linux kernel, so SkyBox should work as-is. This is a documentation and testing task, not a code change.

### Scope

- Verify SkyBox works on WSL2 Ubuntu (install, init, clone, up, down, sync)
- Verify Docker Desktop WSL2 backend integration
- Document any setup quirks (e.g., Docker Desktop config, Bun installation)
- Add WSL2 as a supported platform in docs

### Files Changed

| File | Changes |
|------|---------|
| `docs/guide/installation.md` | Add WSL2 setup instructions |
| `docs/guide/troubleshooting.md` | Add WSL2-specific troubleshooting |
| `plans/IMPLEMENTATION.md` | Add WSL2 testing task |

---

## Feature 2: Project Encryption at Rest

### Summary

Protect project data on the remote server by encrypting it when not in active use. On `skybox down`, the project directory is tarred, encrypted with AES-256-GCM, and the plaintext is deleted. On `skybox up` or `skybox clone`, the user provides their passphrase to decrypt and extract the archive.

### Threat Model

An unauthorized user with access to the remote server should not be able to read project files when the project is not actively being worked on. During active work, files are plaintext on the remote for Mutagen sync compatibility.

### Encryption Approach: Encrypted Archive

- **On `skybox down`:** Mutagen sync flushes and terminates. Project directory is tarred, encrypted, written as `myproject.tar.enc` inside the project directory. Plaintext files are deleted. Lock is released.
- **On `skybox up`:** User enters passphrase. Archive is decrypted, extracted into the project directory. Archive is deleted. Mutagen sync starts normally.
- **Trade-off:** Data is plaintext on the remote during active sessions. This is acceptable because the encrypted archive approach preserves Mutagen delta sync efficiency and avoids complexity of real-time encryption layers.

### Cryptographic Design

| Component | Implementation |
|-----------|---------------|
| Key derivation | `argon2Sync` from `node:crypto` (Argon2id, 32-byte key output) |
| Encryption | AES-256-GCM via `node:crypto` `createCipheriv` / `createDecipheriv` |
| Salt | Random bytes, generated once per project, stored in `config.yaml` |
| Passphrase | Never stored. Entered by user on every `skybox up` / `skybox clone` / `skybox down` |

**No new dependencies.** All crypto is built into Bun's `node:crypto`.

### Remote Directory Layout

**When not in use (encrypted):**

```
~/code/myproject/myproject.tar.enc    # encrypted archive
```

**During active work:**

```
~/code/myproject/myproject.tar.enc    # stale backup
~/code/myproject/                     # plaintext, actively synced
```

### Config Changes

Per-project encryption in `config.yaml`:

```yaml
projects:
  my-app:
    remote: work
    encryption:
      enabled: true
      salt: "a1b2c3d4..."
```

Optional global default:

```yaml
defaults:
  encryption: true
```

### CLI Integration

#### `skybox init`

After remote setup, add prompt:

```
Enable encryption for new projects by default? (y/N)
```

If yes, sets `defaults.encryption: true` in config.

#### `skybox new`

After project name and template selection:

1. If `defaults.encryption` is true (or always ask): "Enable encryption for this project? (y/N)"
2. If yes, show double confirmation warning (see below)
3. Prompt for passphrase
4. Generate salt, save to project config

#### `skybox up`

1. Check `project.encryption.enabled`
2. If true and `myproject.tar.enc` exists on remote: prompt passphrase, decrypt, extract, delete archive
3. If true and no archive exists (first run or encryption just enabled): continue normally
4. Proceed with normal flow (lock, sync, container)

#### `skybox down`

1. Normal flow: Mutagen flush and terminate
2. Check `project.encryption.enabled`
3. If true: prompt for passphrase, tar project directory on remote, encrypt, write `.tar.enc`, delete plaintext
4. Release lock

#### `skybox clone`

1. If cloning an encrypted project, prompt for passphrase to decrypt after download
2. If user doesn't know the passphrase, fail with clear message

#### `skybox encrypt enable [project]`

New top-level command replacing `skybox config encryption`:

1. If no project argument, show interactive project selection via `select()`
2. Show double confirmation warning
3. Prompt for passphrase
4. Generate salt, save to project config
5. Next `skybox down` will encrypt the remote data

#### `skybox encrypt disable [project]`

1. If no project argument, show interactive project selection
2. Prompt for passphrase (to verify access)
3. If project is currently encrypted on remote, decrypt the archive
4. Remove `encryption` from project config

### Warning & Confirmation Flow

**Step 1:**

```
⚠ Encryption Warning:
  Your passphrase is NEVER stored. If you forget it, your
  encrypted project data CANNOT be recovered. There is no
  reset or recovery mechanism.

  We recommend saving your passphrase in a password manager.

  Enable encryption? (y/N)
```

**Step 2 (only if Step 1 is yes):**

```
⚠ Please confirm you understand:
  - There is NO way to recover your data without the passphrase
  - SkyBox cannot reset or bypass encryption
  - You are solely responsible for storing your passphrase safely

  I understand the risks (y/N)
```

Only after both confirmations does it prompt for the passphrase.

### Error Handling

**Wrong passphrase:**
- AES-GCM decryption fails (auth tag mismatch)
- Show "Incorrect passphrase" error
- Allow 3 attempts max
- After 3 failures: "Failed to decrypt after 3 attempts. Run `skybox up` to try again." and exit

**Interrupted `skybox down` mid-encryption:**
- Plaintext still on remote, no archive written
- Next `skybox up` sees no archive, continues normally
- Data is safe

**Interrupted `skybox down` after archive written but before plaintext deleted:**
- Both archive and plaintext exist
- Next `skybox up` sees archive, decrypts, overwrites stale plaintext
- Data is safe

**Interrupted `skybox up` mid-decryption:**
- Archive still intact on remote
- Retry works

**No archive on remote (first run or encryption just enabled):**
- Skip decryption, proceed normally

**Cloning encrypted project without passphrase:**
- Fail with: "This project is encrypted. You need the passphrase to clone it."

**Disk space:**
- Tar + encrypt temporarily doubles remote disk usage
- Plaintext is deleted after archive is written

### Lock Interaction

- Decryption happens after lock acquisition but before Mutagen start
- Encryption happens after Mutagen flush but before lock release

### Passphrase Verification

Store a small known-plaintext marker inside the archive (`.skybox-enc-check` file) to verify correct passphrase before full extraction.

### Files Changed

| File | Changes |
|------|---------|
| `src/lib/encryption.ts` | Replace `pbkdf2Sync` with `argon2Sync`, add `encryptStream()` / `decryptStream()` for archives |
| `src/commands/up.ts` | Add passphrase prompt + decrypt archive before sync starts |
| `src/commands/down.ts` | Add passphrase prompt + tar/encrypt/delete plaintext after sync flush |
| `src/commands/clone.ts` | Add passphrase prompt for encrypted projects |
| `src/commands/new.ts` | Add encryption prompt during project creation |
| `src/commands/init.ts` | Add default encryption preference prompt |
| `src/commands/config.ts` | Remove encryption subcommand (moved to `skybox encrypt`) |
| `src/commands/encrypt.ts` | New file: `skybox encrypt enable/disable [project]` command |
| `src/index.ts` | Register new `encrypt` command |
| `src/types/index.ts` | Add `ProjectEncryption` interface to project config type |

### New Files

| File | Purpose |
|------|---------|
| `src/commands/encrypt.ts` | `skybox encrypt enable/disable [project]` command |
| `src/lib/__tests__/encryption.test.ts` | Tests for streaming encrypt/decrypt, argon2 key derivation |
| `src/commands/__tests__/encrypt.test.ts` | Tests for encrypt command |

### Documentation Updates

| File | Changes |
|------|---------|
| `docs/reference/encryption.md` | New page: how encryption works, setup, passphrase management |
| `docs/reference/commands.md` | Update `up`, `down`, `clone`, `new`, `init` entries; add `encrypt` command |
| `docs/reference/config.md` | Remove encryption subcommand, reference `skybox encrypt` instead |
| `plans/IMPLEMENTATION.md` | Add encryption integration tasks to tracker |
| `CHANGELOG.md` | Add encryption feature entry |
