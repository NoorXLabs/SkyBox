# CLAUDE.md - AI Assistant Guide for SkyBox

## Project Overview

SkyBox is a CLI tool for managing local-first development containers with remote synchronization. It solves disk bloat, latency, and multi-machine workflow complexity by running containers locally while syncing code bidirectionally with a remote server using Mutagen.

**Version:** 0.8.0
**Runtime:** Bun (TypeScript)
**License:** Apache 2.0

## Tech Stack

- **Runtime:** Bun 1.x (JavaScript/TypeScript runtime)
- **Language:** TypeScript 5.9 (strict mode)
- **CLI Framework:** Commander.js 14.x
- **Linting/Formatting:** Biome 2.3
- **Git Hooks:** Lefthook
- **Testing:** Bun's native test runner
- **Documentation:** VitePress

## Directory Structure

```
src/                        # production code ONLY
├── index.ts              # CLI entry point (Commander.js setup)
├── commands/             # Command implementations
├── lib/                  # Shared libraries
└── types/
    └── index.ts          # TypeScript interfaces

tests/                      # all test code
├── helpers/              # shared test utilities (all tiers import)
│   └── test-utils.ts
├── unit/
│   ├── lib/              # mirrors src/lib/
│   └── commands/         # mirrors src/commands/
├── integration/
│   ├── helpers/
│   └── docker/
└── e2e/
    ├── helpers/
    ├── remote/
    ├── sync/
    └── workflow/
```

## Development Setup

```bash
# Install dependencies
bun install

# Run CLI in development mode
bun run dev

# Or run directly
bun run src/index.ts <command>
```

## NPM Scripts

| Script | Purpose |
|--------|---------|
| `bun run dev` | Run CLI in development mode |
| `bun run build` | Compile to standalone binary |
| `bun run test` | Run unit tests |
| `bun run test:integration` | Docker integration tests |
| `bun run test:e2e` | Remote server E2E tests |
| `bun run test:all` | Run all test tiers |
| `bun run typecheck` | TypeScript type checking |
| `bun run check` | Biome lint + format (with fixes) |
| `bun run check:ci` | Biome check (no writes, for CI) |
| `bun run format` | Format code with Biome |
| `bun run lint` | Lint code with Biome |
| `bun run docs:dev` | Start VitePress dev server |

## Code Conventions

### Style Rules (Enforced by Biome)

- **Indentation:** Tabs (not spaces)
- **Quotes:** Double quotes for strings
- **Imports:** Use path aliases with `.ts` extension — never relative paths:
  - `@commands/*` → `src/commands/*` (e.g., `import { upCommand } from "@commands/up.ts"`)
  - `@lib/*` → `src/lib/*` (e.g., `import { loadConfig } from "@lib/config.ts"`)
  - `@typedefs/*` → `src/types/*` (e.g., `import type { SkyboxConfigV2 } from "@typedefs/index.ts"`)
  - `@tests/*` → `tests/*` (e.g., `import { ... } from "@tests/helpers/test-utils.ts"`) — test code only, never from `src/`
  - Exception: `../package.json` in `src/index.ts` (outside `src/`, no alias)
  - Note: `@typedefs` is used instead of `@types` to avoid TypeScript TS6137 conflict
- **Unused imports:** Error (auto-removed)
- **Import organization:** Auto-sorted alphabetically

### TypeScript Conventions

- Strict mode enabled - no implicit any, strict null checks
- All types defined in `src/types/index.ts`
- **Arrow functions**: Use `export const fn = (...): ReturnType => { }` — not `export function fn() { }`. All exported functions use arrow syntax.
- **No JSDoc in production code**: `src/` uses inline `//` comments only where logic isn't self-evident. Do not add `/** */` blocks. Test helpers in `tests/` do use JSDoc — that's fine.
- Async/await for all I/O operations
- Use `execa` for executing external commands

### Error Handling

- Use `getErrorMessage()` from `src/lib/errors.ts` for safe error extraction
- Use `getExecaErrorMessage()` for command execution errors
- Never expose raw error objects to users

### UI Output

- Use functions from `src/lib/ui.ts` for consistent terminal output:
  - `success()`, `error()`, `warning()`, `info()` for messages
  - `spinner()` for loading states
  - Use Chalk for colors (already imported in ui.ts)

### File Organization

- One command per file in `src/commands/`
- Shared logic in `src/lib/` with single responsibility
- Tests in top-level `tests/` directory mirroring `src/` structure

## Testing Guidelines

### Test Tiers

| Tier | Runs Against | When | Speed |
|------|--------------|------|-------|
| **Unit** | Mocks/filesystem | Every commit, pre-commit | ~5s |
| **Integration** | Real Docker locally | CI + manual | ~60s |
| **E2E** | Real remote server | CI nightly or pre-release | ~3-5min |

### Running Tests

```bash
bun test              # Unit tests only (default)
bun test:integration  # Docker integration tests (requires Docker)
bun test:e2e          # Remote server tests (requires E2E env vars)
bun test:all          # Run all test tiers
```

### Test File Locations

| Location | Type |
|----------|------|
| `tests/unit/lib/` | Unit tests for libraries |
| `tests/unit/commands/` | Unit tests for commands |
| `tests/integration/` | Docker integration tests |
| `tests/e2e/` | Remote server E2E tests |
| `tests/helpers/` | Shared test utilities |

### Test Structure Pattern

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
// Note: test-utils is auto-loaded via --preload, no import needed

describe("feature name", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		// Create isolated test directory
		testDir = join(tmpdir(), `skybox-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		// Mock SKYBOX_HOME
		originalEnv = process.env.SKYBOX_HOME;
		process.env.SKYBOX_HOME = testDir;
	});

	afterEach(() => {
		// Cleanup
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv) {
			process.env.SKYBOX_HOME = originalEnv;
		} else {
			delete process.env.SKYBOX_HOME;
		}
	});

	test("should do something", async () => {
		// Arrange
		// Act
		// Assert
		expect(result).toBe(expected);
	});
});
```

### Unit Test Conventions

- Each test uses isolated temp directory with unique timestamp
- Mock `SKYBOX_HOME` via `process.env` for config isolation
- Clean up all created files in `afterEach`
- Use real filesystem operations (no mocking fs module)
- Test both success and error cases
- Use `test.skipIf(!condition)` for tests requiring optional external binaries (SCP)

### Integration Test Conventions

- Tests skip gracefully if Docker isn't running: `describe.skipIf(!await isDockerAvailable())`
- Each test uses isolated temp directory and unique container names
- Containers are labeled with `skybox-test=true` for cleanup
- Import helpers from `@tests/integration/helpers/docker-test-utils.ts`

### E2E Test Conventions

- Tests skip if environment not configured: `describe.skipIf(!isE2EConfigured())`
- Required environment variables:
  - `E2E_HOST`: Remote server hostname
  - `E2E_USER`: SSH username
  - `E2E_PATH`: Base path for test data (optional, defaults to `~/skybox-e2e-tests`)
  - `E2E_SSH_KEY_PATH`: Path to SSH key (optional)
- Use `withRetry()` wrapper for flaky network operations
- Import helpers from `@tests/e2e/helpers/`

## Git Workflow

### Pre-commit Hooks (Lefthook)

Commits automatically run these checks in order:
1. **check** (priority 1): Biome format + lint on `*.{js,ts,json}`
2. **typecheck** (priority 2): TypeScript strict checking
3. **test** (priority 3): Full test suite

All checks must pass before commit succeeds.

### Branch Naming

- Feature branches: `claude/<description>-<session-id>`
- Bug fixes: `fix/<description>`
- Documentation: `docs/<description>`

### Commit Messages

Follow conventional commits:
- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `refactor: code restructuring`
- `test: add or update tests`
- `chore: maintenance tasks`

## Common Tasks

### Adding a New Command

1. Create `src/commands/<name>.ts` with an exported action handler:
```typescript
import { requireLoadedConfigOrExit } from "@lib/command-guard.ts";
import { error, header } from "@lib/ui.ts";

export const nameCommand = async (arg: string, options: { flag?: boolean }): Promise<void> => {
	requireLoadedConfigOrExit();
	header("Name");
	// Implementation
};
```

2. Wire up in `src/index.ts`:
```typescript
import { nameCommand } from "@commands/name.ts";

program
	.command("name")
	.description("Command description")
	.argument("[arg]", "argument description")
	.option("-f, --flag", "flag description")
	.action(nameCommand);
```

3. Add tests in `tests/unit/commands/name.test.ts`

4. Add to `docs/.vitepress/commands.ts` for sidebar and command overview

### Adding a New Library Function

1. Add function to appropriate file in `src/lib/`
2. Export from the file
3. Add tests in `tests/unit/lib/<file>.test.ts`
4. If new types needed, add to `src/types/index.ts`

### Modifying Configuration

Config file location: `~/.skybox/config.yaml`

Config structure (V2 - multi-remote):
```yaml
editor: cursor | code | code-insiders | zed | <custom>

defaults:
  sync_mode: two-way-resolved
  ignore:
    - .git/index.lock
    - node_modules

remotes:
  work:
    host: work-server
    user: deploy
    path: ~/code
    key: ~/.ssh/work_key

projects:
  my-app:
    remote: work
```

Use `src/lib/config.ts` functions:
- `loadConfig()` - Load and validate config
- `saveConfig()` - Save config to disk
- `getProjectConfig()` - Get project-specific config

## Architecture Notes

### Session System

Local session files detect multi-machine conflicts:
- Session file stored locally: `<project>/.skybox/session.lock`
- Contains: machine name, user, timestamp, PID, expires (24h TTL)
- Written by `skybox up`, deleted by `skybox down`
- Uses atomic write (temp file + rename) to prevent corruption
- Sessions expire after 24 hours (`SESSION_TTL_MS` in constants.ts) — expired sessions ignored
- See `src/lib/session.ts` for implementation

### Sync System

Bidirectional file sync via Mutagen:
- Mutagen binary bundled and extracted during `skybox init` (falls back to download in dev mode)
- Sessions managed in `src/lib/mutagen.ts`
- Default ignore patterns in `src/lib/constants.ts` as `DEFAULT_IGNORE`

### Container Management

Uses Docker with devcontainer spec:
- Container operations in `src/lib/container.ts`
- Devcontainer templates in `src/lib/templates.ts`
- Container naming: `skybox-<project-name>`

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point, command registration |
| `src/types/index.ts` | All TypeScript interfaces |
| `src/lib/config.ts` | Config file operations; `requireConfig()` loads config or exits with error |
| `src/lib/container.ts` | Docker operations |
| `src/lib/mutagen.ts` | Sync session management |
| `src/lib/session.ts` | Local session management (conflict detection) |
| `src/lib/ui.ts` | Terminal output helpers |
| `src/lib/errors.ts` | Error handling utilities |
| `src/lib/encryption.ts` | AES-256-GCM encrypt/decrypt for config values |
| `src/lib/git.ts` | Git operations for status, push, and project creation |
| `src/lib/validation.ts` | Path traversal prevention, input validation, SSH field validation, inquirer validator adapters |
| `src/lib/shell.ts` | Shell escaping: `escapeShellArg()`, `escapeRemotePath()`, `buildShellCommand()` |
| `src/lib/download.ts` | Mutagen binary download fallback (dev mode) with checksum verification |
| `src/lib/ssh.ts` | SSH operations: `runRemoteCommand()`, `secureScp()`, `writeSSHConfigEntry()` |
| `src/lib/hooks.ts` | Hook runner for pre/post lifecycle events |
| `src/lib/audit.ts` | Audit logging (JSON Lines to `~/.skybox/audit.log`) |
| `src/lib/command-guard.ts` | Config guards for commands (requireLoadedConfigOrExit) |
| `src/lib/shutdown.ts` | Graceful shutdown and signal handling |
| `src/commands/dashboard.tsx` | Ink/React TUI dashboard |
| `.github/workflows/release.yml` | Release workflow: builds 4 platform binaries (darwin-arm64, darwin-x64, linux-x64, linux-arm64) |
| `biome.json` | Linting/formatting config |
| `lefthook.yml` | Git hooks config |
| `tsconfig.json` | TypeScript config |
| `src/lib/config-schema.ts` | Runtime schema validation for config objects |
| `src/lib/migration.ts` | Config format migration from V1 to V2 |
| `src/lib/mutagen-extract.ts` | Bundled Mutagen binary extraction and versioning |
| `src/lib/ownership.ts` | Resource ownership verification for remote projects |
| `src/lib/paths.ts` | Centralized path computation for SkyBox directories |
| `src/lib/project.ts` | Local project path resolution and validation |
| `src/lib/relative-time.ts` | Human-readable relative timestamps for status and dashboard |
| `src/lib/remote.ts` | Operations for interacting with remote servers |
| `src/lib/remote-encryption.ts` | Remote encryption/decryption workflow for up, down, and encrypt commands |
| `src/lib/startup.ts` | Dependency checks run at CLI startup |
| `src/lib/sync-session.ts` | Sync session lifecycle (creates standard or selective sync sessions) |
| `src/lib/telemetry.ts` | First-run install tracking (Rybbit analytics, fire-and-forget) |
| `src/lib/templates.ts` | Template selection UI for up, new, and config devcontainer |
| `src/lib/update-check.ts` | Version update check with 24h cache via GitHub API |
| `src/lib/verify-lockfile.ts` | Verify bun.lock integrity (supply chain security) |

## Documentation

- **User docs:** `docs/` (VitePress) - do NOT use for plans or internal docs
- **Architecture:** `docs/architecture/`
- **Command reference:** `docs/reference/`
- **Implementation plans:** `plans/` - all implementation plans go here, NOT in docs/
- **Implementation tracker:** `plans/IMPLEMENTATION.md` - future features, pre-production checklist, and release tasks
- **Archived implementation:** `plans/archive/ARCHIVED-IMPLEMENTATION.md` - all completed phases, tasks, and commits log
- **Changelog:** `CHANGELOG.md`

**Post-implementation checklist:**
- Move completed plan from `plans/` to `plans/archive/` after merge
- Update `plans/IMPLEMENTATION.md` to check off completed tasks and log commit hashes in `plans/archive/ARCHIVED-IMPLEMENTATION.md`

**Important:** When implementing or planning new features, always identify which docs pages in `docs/` need to be created or updated. For design docs in `plans/`, include a "Documentation Updates Required" section listing affected docs. When implementing, update the relevant docs before considering the feature complete.

## Session End Checklist

Before ending a session where code was written or modified:

1. **Update CHANGELOG.md** — Add entries to the `[Unreleased]` section for any user-facing changes (features, fixes, breaking changes, removals). Follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format with categories: Added, Changed, Fixed, Removed. Skip for docs-only or internal-only changes (CI tweaks, plan archiving, skill edits).
2. **Update CLAUDE.md** — If you learned something useful (new gotchas, conventions, commands, architectural decisions), run `/claude-md-management:revise-claude-md`. Skip if the session was simple Q&A or trivial changes.
3. **Update task tracker** — If you completed tasks from a plan, mark them done with `TaskUpdate` and update `plans/IMPLEMENTATION.md` with `[x]` and commit hashes in `plans/archive/ARCHIVED-IMPLEMENTATION.md`.

Note: `bun run check` is enforced automatically by a native Stop hook — no manual step needed.

## Known Gotchas

- **Single source of truth for constants**: ALL constants — including single-use, private, and structured data — must be defined in `src/lib/constants.ts`. Never define constants in other files. Import from `constants.ts` always. Enums stay in `src/types/index.ts` (they are type definitions). Duplicates drift and cause subtle bugs.

- **macOS path normalization**: Always normalize paths with `realpathSync()` BEFORE passing to `devcontainer` CLI or Docker queries. macOS symlinks (e.g., `/var` → `/private/var`) cause label mismatches between container creation and lookup.

- **Inquirer v13 list prompts**: The legacy `inquirer.prompt()` with `type: "list"` doesn't render choices. Use `select()` from `@inquirer/prompts` or `type: "rawlist"` instead.

- **`getLocalProjects()` returns `string[]`**: Project names only, not objects. No `.name` property.

- **`normalizePath` in container.ts is private**: Cannot be imported. Define locally if needed in other modules.

- **`TEMPLATES` is the single built-in template constant**: Defined in `src/lib/constants.ts`, includes all templates (node, bun, python, go, generic) with inline devcontainer configs. There is no separate `BUILT_IN_TEMPLATES` — it was consolidated. `projectTemplates.ts` `getBuiltInTemplates()` returns `TEMPLATES` directly.

- **Dashboard uses Ink (React)**: `src/commands/dashboard.tsx` uses `ink` for TUI rendering, not `blessed`. File must be `.tsx` for JSX support.

- **`@inquirer/prompts` is transitive**: Available via `inquirer` dependency. Exports: `select`, `checkbox`, `password`, `confirm`, `input`.

- **`exactOptionalPropertyTypes` not viable**: Causes 70+ errors across the codebase. Do not enable in tsconfig.json.

- **`process.exit()` in commands breaks batch patterns**: Commands call `process.exit(1)` on errors, which kills the entire process. `try/catch` won't catch it. Known limitation for batch iteration (`--all`).

- **Shell injection in remote commands**: Always use `escapeShellArg()` from `src/lib/shell.ts` when interpolating user input into SSH commands via `runRemoteCommand()`. For remote directory paths that may start with `~/`, use `escapeRemotePath()` instead — it preserves tilde expansion while quoting the rest.

- **`mock.module("execa")` is global in bun test**: Several test files (`shell-docker-isolated`, `rm-remote`, `container-id-isolated`) mock `execa` at module level. This contaminates all test files in the same `bun test` run. New modules that need reliable subprocess execution in tests should use `node:child_process` instead of `execa`.

- **Lefthook `biome check --write` reverts edits on failed commits**: When a pre-commit hook fails after the `check` stage, biome has already rewritten staged files. The working tree ends up with biome's version, not yours. Re-apply edits after any failed commit.

- **Biome lint for shell variable strings**: When testing shell scripts containing `${VAR}` syntax, biome reports `noTemplateCurlyInString`. Add `// biome-ignore lint/suspicious/noTemplateCurlyInString: <reason>` before the string literal.

- **Background process spawning**: For detached background processes, use `spawn("cmd", args, { detached: true, stdio: [...] })` followed by `child.unref()` to allow parent to exit. See `src/commands/hook.ts` for example.

- **`@tests/*` alias is test-only**: The `@tests/*` path alias must NEVER be imported from production code in `src/`. It exists solely for test-to-test imports. Biome cannot enforce this, so treat it as a convention.

- **Ownership uses local OS username**: The `.skybox-owner` system uses `userInfo().username` (local OS username), not the SSH remote user. This means ownership is consistent for a user across machines but could conflict if different people share the same local username. This is a deliberate trade-off for simplicity.

- **`ValidationResult` type for all validators**: All validation functions must return `ValidationResult` (from `src/types/index.ts`), not inline `{ valid: true } | { valid: false; error: string }`. Use the shared type for consistency.

- **SCP calls must use `secureScp()` or `--` separator**: Never call `execa("scp", [source, dest])` directly. Use `secureScp()` from `src/lib/ssh.ts` or manually add `"--"` before positional args to prevent option injection via crafted hostnames.

- **SSH config fields must be validated**: All values written to `~/.ssh/config` via `writeSSHConfigEntry()` must pass `validateSSHField()`. This prevents SSH config injection via newlines or metacharacters. Init and remote prompts use `sshFieldValidator()` for inquirer validation.

- **Inquirer validator adapter**: Use `toInquirerValidator()` from `src/lib/validation.ts` to convert any `(input: string) => ValidationResult` function into inquirer's `(input: string) => true | string` format. Use `sshFieldValidator(fieldName)` for SSH-specific fields.

- **`isValidContainerId` in container.ts is private**: Like `normalizePath`, it cannot be imported. Validates Docker container IDs as 12-64 hex chars. Applied in both `getContainerId()` and `getContainerInfo()`.

- **Audit log auto-rotates at 10 MB**: `AUDIT_LOG_MAX_BYTES` in constants.ts. Rotation renames to `audit.log.YYYY-MM-DD`. Details are sanitized: home paths replaced with `~`, credential patterns redacted.

- **`requireConfig()` never returns null**: It calls `process.exit(1)` on failure. All commands should use `requireConfig()` instead of the manual `configExists()` + `loadConfig()` + null-check pattern.

- **`isMutagenInstalled()` is async**: Returns `Promise<boolean>`, not `boolean`. All callers must `await` it. Changed during security audit to use `execa` instead of `Bun.spawnSync`.

## Environment Variables

SkyBox respects the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SKYBOX_HOME` | `~/.skybox` | Override SkyBox data directory location |
| `SKYBOX_AUDIT` | `0` | Set to `1` to enable audit logging to `~/.skybox/audit.log` |
| `SKYBOX_HOOK_WARNINGS` | `1` | Set to `0` to suppress one-time hook security warning |
| `SKYBOX_TELEMETRY` | `1` | Set to `0` to disable first-run install tracking |
| `RYBBIT_URL` | unset | Rybbit analytics endpoint for first-run telemetry (set at build time) |
| `RYBBIT_SITE_ID` | unset | Rybbit site identifier for first-run telemetry (set at build time) |
| `RYBBIT_API_KEY` | unset | Rybbit API key for authenticating telemetry requests (set at build time) |
| `DEBUG` | unset | Set to any value to enable debug output in list command |

### Audit Logging

When `SKYBOX_AUDIT=1`, security-relevant operations are logged to `~/.skybox/audit.log` in JSON Lines format:

```json
{"timestamp":"2026-02-04T12:00:00Z","action":"push:success","user":"john","machine":"macbook","details":{"project":"myapp"}}
```

Logged actions: `clone:start`, `clone:success`, `clone:fail`, `push:start`, `push:success`, `push:fail`, `rm:local`, `rm:remote`, `up:start`, `up:success`, `down`, `lock:force`, `config:change`.

**Log rotation:** Auto-rotates at 10 MB (see `AUDIT_LOG_MAX_BYTES` in constants.ts). Rotated files are renamed to `audit.log.YYYY-MM-DD`.
