# Export / Import — Full SkyBox Backup & Restore

> **Status:** Planned
> **Priority:** Medium
> **Replaces:** "Export/Import Config" entry in IMPLEMENTATION.md

---

## Problem

When moving to a new machine, users must manually recreate their SkyBox configuration — remotes, projects, editor preferences, sync defaults, encryption settings, and custom templates. This is tedious and error-prone, especially with encrypted config values.

## Solution

Two commands — `skybox export` and `skybox import <file>` — that produce a single password-protected encrypted file containing all SkyBox settings. On a new machine, import restores the config so the user can immediately `skybox clone` their projects.

## What Gets Backed Up

| Item | Source Path | Included |
|------|-------------|----------|
| Config file | `~/.skybox/config.yaml` | Yes |
| Custom templates | `~/.skybox/templates/*` | Yes |
| Mutagen binary | `~/.skybox/bin/` | No (re-extracted on first run) |
| Logs | `~/.skybox/logs/` | No (ephemeral) |
| Local project files | `~/.skybox/Projects/` | No (re-cloneable from remote) |
| Audit log | `~/.skybox/audit.log` | No (machine-specific) |
| Update check cache | `~/.skybox/.update-check.json` | No (ephemeral) |
| Install marker | `~/.skybox/.installed` | No (ephemeral) |

## UX Design

### `skybox export`

```
$ skybox export
✔ Export passphrase: ••••••••
✔ Confirm passphrase: ••••••••

Backing up SkyBox configuration...
  ✓ Config (3 remotes, 7 projects)
  ✓ Custom templates (2 templates)

Exported to: skybox-backup-2026-02-09.json.enc
Restore on a new machine with: skybox import skybox-backup-2026-02-09.json.enc
```

Options:
- `--output <path>` / `-o <path>` — Custom output file path (default: `skybox-backup-YYYY-MM-DD.json.enc` in current directory)

### `skybox import <file>`

```
$ skybox import skybox-backup-2026-02-09.json.enc
✔ Import passphrase: ••••••••

Restoring SkyBox configuration...
  ✓ Config (3 remotes, 7 projects)
  ✓ Custom templates (2 templates)

SkyBox restored. Run 'skybox clone' to pull your projects.
```

Behavior when config already exists:
```
⚠ SkyBox is already configured on this machine.
? Overwrite existing config? (y/N)
```

Options:
- `--force` / `-f` — Overwrite existing config without prompting

## Encrypted File Format

The export file is a JSON payload encrypted with AES-256-GCM using a password-derived key (same encryption primitives as existing `src/lib/encryption.ts`).

### Plaintext structure (before encryption)

```json
{
  "version": 1,
  "created_at": "2026-02-09T12:00:00Z",
  "skybox_version": "0.8.0",
  "config": { /* full config.yaml contents as object */ },
  "templates": {
    "my-custom-template/devcontainer.json": "{ ... file contents ... }",
    "my-custom-template/Dockerfile": "FROM node:20\n..."
  }
}
```

- `version` — Backup format version for future compatibility
- `created_at` — ISO timestamp for user reference
- `skybox_version` — SkyBox version that created the backup (for migration awareness)
- `config` — The parsed config.yaml object (not raw YAML string, so it can be validated on import)
- `templates` — Map of relative file paths to file contents within `~/.skybox/templates/`

### Encrypted file structure (on disk)

Uses the existing `encryptFile()` / `decryptFile()` pattern from `src/lib/encryption.ts`:

```
[salt: 32 bytes][IV: 16 bytes][encrypted JSON][auth tag: 16 bytes]
```

The salt is prepended (unlike per-config encryption where salt is stored in config.yaml) because the backup file must be self-contained.

## Implementation Plan

### Step 1: Add constants

**File:** `src/lib/constants.ts`

```typescript
// backup file format version
export const BACKUP_FORMAT_VERSION = 1;

// default backup file name pattern
export const BACKUP_FILE_PREFIX = "skybox-backup";

// backup file extension
export const BACKUP_FILE_EXTENSION = ".json.enc";

// salt length for backup file encryption
export const BACKUP_SALT_LENGTH = 32;
```

### Step 2: Create backup library

**File:** `src/lib/backup.ts`

Functions:
- `createBackupPayload()` — Reads config + templates, assembles JSON payload
- `encryptBackup(payload: string, passphrase: string): Buffer` — Derives key from passphrase with fresh salt, encrypts payload, returns `[salt][iv][encrypted][tag]`
- `decryptBackup(data: Buffer, passphrase: string): string` — Extracts salt from header, derives key, decrypts and returns JSON string
- `validateBackupPayload(payload: unknown): BackupPayload` — Validates the parsed JSON structure and config schema
- `restoreFromBackup(payload: BackupPayload, force: boolean): void` — Writes config.yaml and template files to disk

### Step 3: Create export command

**File:** `src/commands/export.ts`

```typescript
export const exportCommand = async (options: { output?: string }): Promise<void> => {
    requireLoadedConfigOrExit();
    // 1. Prompt for passphrase (with confirmation)
    // 2. Call createBackupPayload()
    // 3. Call encryptBackup()
    // 4. Write to output file
    // 5. Print summary
};
```

### Step 4: Create import command

**File:** `src/commands/import.ts`

```typescript
export const importCommand = async (file: string, options: { force?: boolean }): Promise<void> => {
    // 1. Check if file exists
    // 2. Check if config already exists (prompt or --force)
    // 3. Prompt for passphrase
    // 4. Call decryptBackup()
    // 5. Call validateBackupPayload()
    // 6. Call restoreFromBackup()
    // 7. Print summary
};
```

### Step 5: Wire up in CLI

**File:** `src/index.ts`

```typescript
import { exportCommand } from "@commands/export.ts";
import { importCommand } from "@commands/import.ts";

program
    .command("export")
    .description("Export SkyBox settings to an encrypted backup file")
    .option("-o, --output <path>", "output file path")
    .action(exportCommand);

program
    .command("import")
    .description("Import SkyBox settings from an encrypted backup file")
    .argument("<file>", "path to backup file")
    .option("-f, --force", "overwrite existing config without prompting")
    .action(importCommand);
```

### Step 6: Add types

**File:** `src/types/index.ts`

```typescript
export interface BackupPayload {
    version: number;
    created_at: string;
    skybox_version: string;
    config: SkyboxConfigV2;
    templates: Record<string, string>;
}
```

### Step 7: Tests

**File:** `tests/unit/lib/backup.test.ts`

- Test `createBackupPayload()` with config + templates
- Test `createBackupPayload()` with config only (no custom templates)
- Test `encryptBackup()` / `decryptBackup()` round-trip
- Test `decryptBackup()` with wrong passphrase throws
- Test `validateBackupPayload()` accepts valid payload
- Test `validateBackupPayload()` rejects missing fields
- Test `validateBackupPayload()` rejects invalid config schema
- Test `restoreFromBackup()` writes config and templates
- Test `restoreFromBackup()` creates templates directory if missing

**File:** `tests/unit/commands/export.test.ts`

- Test export creates encrypted file at default path
- Test export with `--output` custom path
- Test export fails if not configured

**File:** `tests/unit/commands/import.test.ts`

- Test import restores config and templates
- Test import prompts when config exists
- Test import with `--force` skips prompt
- Test import fails on nonexistent file
- Test import fails on wrong passphrase
- Test import fails on corrupted file

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/lib/constants.ts` | Modify | Add backup format constants |
| `src/lib/backup.ts` | Create | Backup create/encrypt/decrypt/restore logic |
| `src/commands/export.ts` | Create | Export command handler |
| `src/commands/import.ts` | Create | Import command handler |
| `src/index.ts` | Modify | Register export and import commands |
| `src/types/index.ts` | Modify | Add `BackupPayload` interface |
| `tests/unit/lib/backup.test.ts` | Create | Unit tests for backup library |
| `tests/unit/commands/export.test.ts` | Create | Unit tests for export command |
| `tests/unit/commands/import.test.ts` | Create | Unit tests for import command |

## Dependencies

None — uses existing `src/lib/encryption.ts` primitives and `argon2` (already installed).

## Documentation Updates Required

- `docs/reference/export.md` — New command reference page
- `docs/reference/import.md` — New command reference page
- `docs/.vitepress/config.ts` — Add to sidebar under Commands
- `docs/guide/workflows/multi-machine.md` — Add backup/restore workflow section

## Edge Cases

- **Encrypted config values**: The config may contain `ENC[...]` values (encrypted remote passwords). These are preserved as-is in the backup. The user's original encryption passphrase is separate from the backup passphrase. On import, the `ENC[...]` values carry over and work with the same project encryption passphrase.
- **Config migration**: If a backup was created with an older config format, the import should run the existing migration logic (`needsMigration()` / `migrateConfig()`) before saving.
- **Large custom templates**: Templates are stored as file content strings in JSON. This is fine for devcontainer configs (small files). If a template directory contains large binaries, they'd bloat the backup. Consider adding a size warning or limit.
- **Template directory structure**: Templates may be nested (`templates/my-template/.devcontainer/devcontainer.json`). The backup must preserve the full relative path structure.

---

*Last updated: 2026-02-09*
