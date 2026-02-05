# Hoist All Constants to constants.ts

## Goal

Consolidate all constants across the codebase into `src/lib/constants.ts` as the single source of truth. Every hardcoded value — even single-use private ones — lives in this file, organized by domain.

## Organization

Groups within `constants.ts`, separated by comment headers:

```
// ── App & GitHub ──
// ── Paths & Directories ──
// ── Docker & Containers ──
// ── Editors ──
// ── Sync & Mutagen ──
// ── Encryption ──
// ── SSH ──
// ── Templates ──
// ── Update Check ──
```

Large structured data (TEMPLATES, BUILT_IN_TEMPLATES, SUPPORTED_EDITORS, etc.) goes at the bottom since they reference other constants.

## What Moves

### App & GitHub (existing + 1 new)
- `GITHUB_OWNER`, `GITHUB_REPO`, `CTRL_C_EXIT_CODE`, `INSTALL_METHOD` — already in constants.ts
- `GITHUB_API_URL` — hoist from `update-check.ts`

### Paths & Directories (existing + 9 new)
- `CONFIG_FILENAME`, `LOCKS_DIR_NAME` — already in constants.ts
- `SKYBOX_HOME_DIR` = `".skybox"` — extract from `paths.ts`
- `PROJECTS_DIR_NAME` = `"Projects"` — extract from `paths.ts`
- `BIN_DIR_NAME` = `"bin"` — extract from `paths.ts`
- `LOGS_DIR_NAME` = `"logs"` — extract from `paths.ts`
- `TEMPLATES_DIR_NAME` = `"templates"` — extract from `paths.ts`
- `MUTAGEN_VERSION_FILE` = `".mutagen-version"` — extract from `paths.ts`
- `UPDATE_CHECK_FILE` = `".update-check.json"` — extract from `paths.ts`
- `DEVCONTAINER_DIR_NAME` = `".devcontainer"` — new, replaces 25+ raw strings
- `DEVCONTAINER_CONFIG_NAME` = `"devcontainer.json"` — new, replaces 50+ raw strings
- `WORKSPACE_PATH_PREFIX` = `"/workspaces"` — extract from `container.ts`/`templates.ts`

### Docker & Containers
- `DOCKER_LABEL_KEY` — already in constants.ts

### Editors (existing + 2 new)
- `DEFAULT_EDITOR` — already in constants.ts
- `SUPPORTED_EDITORS` — move from `container.ts`
- `VSCODE_REMOTE_URI_PREFIX` = `"vscode-remote://dev-container+"` — extract from `container.ts`

### Sync & Mutagen (existing + 4 new)
- `MUTAGEN_VERSION` — already in constants.ts
- `MUTAGEN_BINARY_NAME` = `"mutagen"` — extract from `paths.ts`
- `MUTAGEN_REPO` = `"mutagen-io/mutagen"` — move from `download.ts`
- `DEFAULT_SYNC_MODE` = `"two-way-resolved"` — extract from `mutagen.ts`
- `DEFAULT_IGNORE` — move from `types/index.ts`
- Remove `BUNDLED_MUTAGEN_VERSION` re-export in `mutagen-extract.ts`; consumers import `MUTAGEN_VERSION` directly

### Encryption (9 new)
- `ENCRYPTION_ALGORITHM` = `"aes-256-gcm"` — move from `encryption.ts`
- `ENCRYPTION_KEY_LENGTH` = `32` — move from `encryption.ts`
- `ENCRYPTION_IV_LENGTH` = `16` — move from `encryption.ts`
- `ENCRYPTION_TAG_LENGTH` = `16` — move from `encryption.ts`
- `ARGON2_MEMORY_COST` = `65536` — move from `encryption.ts`
- `ARGON2_TIME_COST` = `2` — move from `encryption.ts`
- `ARGON2_PARALLELISM` = `1` — move from `encryption.ts`
- `ENCRYPTION_CHECK_FILENAME` — move from `encryption.ts`
- `ENCRYPTION_CHECK_CONTENT` — move from `encryption.ts`

### SSH (4 new)
- `SSH_TIMEOUT_MS` = `10_000` — move from `ssh.ts`
- `SSH_KEYWORDS` — move from `ssh.ts`
- `SSH_CONFIG_MOUNT_PATH` = `"/var/ssh-config"` — extract from `templates.ts`
- `SSH_SYMLINK_COMMAND` — move from `templates.ts`

### Templates (4 new)
- `COMMON_FEATURES` — move from `templates.ts`
- `COMMON_MOUNTS` — move from `templates.ts`
- `COMMON_VSCODE_SETTINGS` — move from `templates.ts`
- `TEMPLATES` — move from `templates.ts`
- `BUILT_IN_TEMPLATES` — move from `projectTemplates.ts`

### Update Check (1 new)
- `CHECK_INTERVAL_MS` = `86_400_000` — move from `update-check.ts`

## What Stays Put

- **Enums** (`ContainerStatus`) stay in `src/types/index.ts` — they are type definitions, not constants
- **TypeScript interfaces/types** stay in `src/types/index.ts`

## Implementation Steps

1. Expand `src/lib/constants.ts` with all constants organized by group
2. Update every importing file to use `constants.ts` imports
3. Replace raw magic strings (`.devcontainer`, `devcontainer.json`, etc.) with constants — including test files
4. Remove `BUNDLED_MUTAGEN_VERSION` re-export from `mutagen-extract.ts`
5. Update `CLAUDE.md` — strengthen the constants rule to require ALL constants in `constants.ts`
6. Run typecheck, lint, and tests

## CLAUDE.md Update

Add/strengthen the existing gotcha to say:

> **Single source of truth for constants**: ALL constants — including single-use, private, and structured data — must be defined in `src/lib/constants.ts`. Never define constants in other files. Import from `constants.ts` always.
