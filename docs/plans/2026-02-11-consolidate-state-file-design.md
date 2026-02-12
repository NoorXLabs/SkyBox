# Consolidate `.skybox-owner` and `session.lock` into `.skybox/state.lock`

## Problem

SkyBox currently stores project metadata across two separate files with overlapping fields:

- `.skybox-owner` (project root, remote only) — ownership/authorization
- `.skybox/session.lock` (inside `.skybox/`, synced via Mutagen) — active session

Both contain `machine` and `user`/`owner`. The `.skybox-owner` file pollutes the project root. Having two files for related metadata is unnecessary complexity.

## Design

### File Format

Single file: `.skybox/state.lock`

```json
{
  "ownership": {
    "owner": "noorchasib",
    "created": "2026-02-11T20:45:28.524Z",
    "machine": "Noors-MacBook-Pro.local"
  },
  "session": {
    "machine": "Noors-MacBook-Pro.local",
    "user": "noorchasib",
    "timestamp": "2026-02-11T20:45:31.349Z",
    "pid": 36435,
    "expires": "2026-02-12T20:45:31.349Z",
    "hash": "62b5a98aaf3567f3af1efe371d20a097d4c30a19eeec5ec8557f4dd609ee2b61"
  }
}
```

Either section can exist independently. When a section is removed and the file is empty, delete the file entirely.

### Lifecycle

| Command | Action |
|---|---|
| `skybox push` | Merges `ownership` section onto remote via SSH |
| `skybox up` | Merges `session` section locally |
| `skybox down` | Removes `session` section, preserves `ownership` |
| `skybox rm --remote` | Deletes entire file on remote |

### Write Pattern

Read-merge-write: each command reads the existing file, updates only its own section, and writes back atomically. Each command never touches the other's section.

```typescript
function mergeState(projectPath: string, section: string, data: object | null) {
  const file = join(projectPath, STATE_FILE);
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, "utf-8")) : {};

  if (data === null) {
    delete existing[section];
  } else {
    existing[section] = data;
  }

  if (Object.keys(existing).length === 0) {
    rmSync(file, { force: true });
  } else {
    writeFileAtomic(file, JSON.stringify(existing, null, 2));
  }
}
```

### HMAC Hash

The session HMAC-SHA256 hash still covers only session fields. No change to the integrity model.

### Backward Compatibility

Clean break. Old `.skybox-owner` and `.skybox/session.lock` files are ignored. Users re-run `push`/`up` to regenerate in the new format.

## Code Changes

### Constants (`src/lib/constants.ts`)

- Remove `OWNERSHIP_FILE_NAME` (`.skybox-owner`)
- Remove `SESSION_FILE` (`.skybox/session.lock`)
- Add `STATE_FILE` = `.skybox/state.lock`

### New Module (`src/lib/state.ts`)

Replaces both `src/lib/ownership.ts` and `src/lib/session.ts`. Contains:

- `readState(projectPath)` — parse `.skybox/state.lock`
- `writeStateSection(projectPath, section, data)` — read-merge-write
- `removeStateSection(projectPath, section)` — remove section, delete file if empty
- Re-exports all existing public functions with same signatures:
  - `getOwnershipStatus()`, `setOwnership()`, `checkWriteAuthorization()`
  - `readSession()`, `writeSession()`, `clearSession()`, `checkSessionConflict()`
  - `computeSessionHash()`

### Deleted Modules

- `src/lib/ownership.ts` — logic moves to `state.ts`
- `src/lib/session.ts` — logic moves to `state.ts`

### Command Changes (import path only)

These commands change imports from `ownership.ts`/`session.ts` to `state.ts` but keep the same function calls:

- `src/commands/push.ts` — `setOwnership()`, `checkWriteAuthorization()`
- `src/commands/up.ts` — `writeSession()`, `checkSessionConflict()`
- `src/commands/down.ts` — `clearSession()`
- `src/commands/rm.ts` — `checkWriteAuthorization()`, `clearSession()`
- `src/commands/status.ts` — `readSession()`
- `src/commands/shell.ts` — `readSession()`
- `src/commands/dashboard.tsx` — `readSession()`

### SSH Command Changes (`src/commands/push.ts`)

The SSH commands that read/write `.skybox-owner` on the remote need to target `.skybox/state.lock` instead, using the read-merge-write pattern for the `ownership` section.

### Tests

- Update/replace tests for `ownership.ts` and `session.ts` with tests for `state.ts`
- Test section independence (writing session doesn't affect ownership and vice versa)
- Test empty-file cleanup (removing last section deletes the file)

## Documentation Updates

The following docs reference `.skybox-owner` or `session.lock` and need updating to reflect `.skybox/state.lock`:

**Guide:**
- `docs/guide/concepts.md` — session system section, project ownership section, remote directory structure
- `docs/guide/workflows/multi-machine.md` — session file references, session details
- `docs/guide/workflows/daily-development.md` — session management section
- `docs/guide/workflows/new-project.md` — push workflow ownership step

**Reference:**
- `docs/reference/push.md` — project ownership section
- `docs/reference/rm.md` — ownership check section
- `docs/reference/up.md` — session system section
- `docs/reference/status.md` — session section details
- `docs/reference/down.md` — session cleanup

**Troubleshooting:**
- `docs/guide/troubleshooting.md` — session issues, session integrity warning

**Snippets (if any):**
- Check for `session-file-format.md` snippet referenced by concepts and multi-machine docs

## Changelog

Add to `[Unreleased]` section:

### Changed

- Consolidated `.skybox-owner` and `.skybox/session.lock` into a single `.skybox/state.lock` file. Ownership and session data now live in one file with independent sections.

### Removed

- `.skybox-owner` file no longer created in project root.
- `.skybox/session.lock` file replaced by `session` section in `.skybox/state.lock`.

### Migration

- Breaking: existing `.skybox-owner` and `session.lock` files are not migrated. Run `skybox push` to re-establish ownership and `skybox up` to create a new session.
