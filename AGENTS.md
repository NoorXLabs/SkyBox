# AGENTS.md - SkyBox Agent Guide

## Scope

Use this file as the repository-specific operating manual for coding agents in SkyBox.
It is derived from `CLAUDE.md` and should stay aligned with current source and scripts.

## Project Overview

- SkyBox is a CLI for local-first development containers with remote synchronization.
- Core value: local container performance with remote code storage and bidirectional sync.
- Current baseline in repo: version `0.8.0`, Bun runtime, TypeScript strict mode.

## Tech Stack

- Runtime: Bun 1.x
- Language: TypeScript 5.9
- CLI framework: Commander.js
- Lint/format: Biome 2.x
- Git hooks: Lefthook
- Tests: Bun native test runner
- Docs: VitePress

## Repository Structure

- `src/`: production code only
- `src/index.ts`: CLI entry point and command registration
- `src/commands/`: one command per file
- `src/lib/`: shared libraries
- `src/types/index.ts`: shared interfaces/enums/types
- `tests/helpers/`: shared test utilities
- `tests/unit/`: unit tests mirroring `src/`
- `tests/integration/`: Docker integration tests
- `tests/e2e/`: remote server end-to-end tests
- `docs/`: user docs/reference (VitePress)
- `plans/`: implementation plans and tracking
- `CHANGELOG.md`: release notes and unreleased changes

## Development Commands

```bash
bun install
bun run dev
bun run build
bun run test
bun run test:integration
bun run test:e2e
bun run test:all
bun run typecheck
bun run check
bun run check:ci
bun run format
bun run lint
bun run docs:dev
bun run docs:build
bun run docs:preview
bun run build:bundle
bun run vendor:mutagen
```

## Code Conventions

### Style And Imports

- Use tabs for indentation.
- Use double quotes for strings.
- Use path aliases with `.ts` extensions; avoid relative imports in `src/`.
- Allowed aliases:
  - `@commands/*` -> `src/commands/*`
  - `@lib/*` -> `src/lib/*`
  - `@typedefs/*` -> `src/types/*` (`@types` is intentionally not used due to TS6137 conflict)
  - `@tests/*` -> `tests/*` (tests only, never from production code)
- Exception: `../package.json` in `src/index.ts` is allowed.
- Keep imports sorted and remove unused imports.

### TypeScript And Function Patterns

- Maintain strict typing; no implicit `any`.
- Define shared types in `src/types/index.ts`.
- Use exported arrow function style for exported functions.
- Do not add JSDoc blocks in `src/`; use concise inline comments only when needed.
- JSDoc usage in `tests/` helpers is acceptable.
- Use async/await for I/O.
- Prefer `execa` for external command execution.

### Error Handling And CLI Output

- Use `getErrorMessage()` for safe user-facing error extraction.
- Use `getExecaErrorMessage()` for command execution errors.
- Never expose raw error objects in CLI output.
- Use UI helpers from `src/lib/ui.ts`:
  - `success()`, `error()`, `warning()`, `info()`
  - `spinner()`

### File Organization

- Keep one command per file in `src/commands/`.
- Keep shared logic in `src/lib/` with clear single responsibility.
- Place tests under top-level `tests/` mirrored to source structure.

## Testing Guidelines

### Test Tiers

- Unit: fast, runs on mocks/filesystem, default per commit.
- Integration: real Docker locally.
- E2E: real remote server workflows.

### Test Commands And Scope

- Use `bun run test` for unit tests.
- Do not use bare `bun test` for normal unit runs because it discovers all tiers.
- Use `bun run test:integration` and `bun run test:e2e` when relevant.
- Use `bun run test:all` for full coverage passes.

### Unit Test Conventions

- Use isolated temp directories per test run.
- Mock `SKYBOX_HOME` via environment variable for config isolation.
- Clean up all created resources in `afterEach`.
- Prefer real filesystem operations instead of fs-module mocks.
- Cover both success and error paths.
- Use `test.skipIf(!condition)` for optional external binary scenarios.

### Integration Test Conventions

- Skip gracefully if Docker is unavailable.
- Use isolated directories and unique container names.
- Apply `skybox-test=true` labels for cleanup.
- Use helpers from `@tests/integration/helpers/docker-test-utils.ts`.

### E2E Test Conventions

- Skip gracefully when E2E env vars are missing.
- Expected env vars: `E2E_HOST`, `E2E_USER`, optional `E2E_PATH`, optional `E2E_SSH_KEY_PATH`.
- Use retry wrappers for flaky network operations.
- Use helpers from `@tests/e2e/helpers/`.

## Git Workflow

### Pre-commit Hooks

Commits run checks in this order:

1. lockfile integrity check
2. biome check/write
3. typecheck
4. full test suite

### Branch Naming

- Features: `claude/<description>-<session-id>`
- Fixes: `fix/<description>`
- Docs: `docs/<description>`

### Commit Message Format

Use conventional commits:

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`
- `test: ...`
- `chore: ...`

## Common Implementation Workflows

### Add A New Command

1. Create `src/commands/<name>.ts` with exported action handler.
2. Register command in `src/index.ts`.
3. Add unit tests under `tests/unit/commands/<name>.test.ts`.
4. Update docs/sidebar command metadata under docs config.

### Add A New Library Function

1. Add function in appropriate `src/lib/` module.
2. Add unit tests in `tests/unit/lib/`.
3. Add/update shared types in `src/types/index.ts` as needed.

### Modify Configuration Behavior

- Config path: `~/.skybox/config.yaml`
- Config format is V2 multi-remote (defaults/remotes/projects).
- Use `src/lib/config.ts` helpers:
  - `loadConfig()`
  - `saveConfig()`
  - `getProjectConfig()`

## Architecture Notes

### Session System

- Session lock file: `<project>/.skybox/session.lock`
- Contains machine/user/timestamp/PID/expiry.
- Written on `skybox up`, removed on `skybox down`.
- Uses atomic write strategy.
- Expiry is 24h (`SESSION_TTL_MS` in constants).

### Sync System

- Mutagen handles bidirectional sync.
- Bundled binary extraction on init; download fallback in dev mode.
- Core logic in mutagen/session sync libraries.

### Container Management

- Devcontainer-backed workflow.
- Container naming convention: `skybox-<project-name>`.

## Key Files To Know

- `src/index.ts`
- `src/types/index.ts`
- `src/lib/config.ts`
- `src/lib/container.ts`
- `src/lib/mutagen.ts`
- `src/lib/session.ts`
- `src/lib/ui.ts`
- `src/lib/errors.ts`
- `src/lib/encryption.ts`
- `src/lib/git.ts`
- `src/lib/validation.ts`
- `src/lib/shell.ts`
- `src/lib/download.ts`
- `src/lib/ssh.ts`
- `src/lib/hooks.ts`
- `src/lib/audit.ts`
- `src/lib/command-guard.ts`
- `src/lib/shutdown.ts`
- `src/commands/dashboard.tsx`
- `.github/workflows/release.yml`
- `biome.json`
- `lefthook.yml`
- `tsconfig.json`
- `src/lib/config-schema.ts`
- `src/lib/migration.ts`
- `src/lib/mutagen-extract.ts`
- `src/lib/ownership.ts`
- `src/lib/paths.ts`
- `src/lib/project.ts`
- `src/lib/relative-time.ts`
- `src/lib/remote.ts`
- `src/lib/remote-encryption.ts`
- `src/lib/startup.ts`
- `src/lib/sync-session.ts`
- `src/lib/telemetry.ts`
- `src/lib/templates.ts`
- `src/lib/update-check.ts`
- `src/lib/verify-lockfile.ts`
- `src/lib/container-start.ts`
- `src/lib/project-sync.ts`
- `src/lib/projectTemplates.ts`

## Documentation And Planning Rules

- User docs live in `docs/`.
- Architecture docs live in `docs/architecture/`.
- Command reference lives in `docs/reference/`.
- Implementation plans must live in `plans/`, not `docs/`.
- Update docs for user-visible changes before marking work complete.
- For design docs in `plans/`, include a "Documentation Updates Required" section.
- Move completed plans to `plans/archive/` after merge.
- Update `plans/IMPLEMENTATION.md` and archive logs when plan tasks complete.

## Session-End Checklist

Before ending a coding session:

1. Update `CHANGELOG.md` `[Unreleased]` for user-facing code changes.
2. Skip changelog updates for docs-only/internal-only changes.
3. Update `CLAUDE.md` when durable conventions/gotchas are learned.
4. Update implementation tracker files if tracked tasks were completed.

Note: `bun run check` is enforced by a native stop hook in this project flow.

## Known Gotchas

### Architecture Decisions

- Constants must be centralized in `src/lib/constants.ts`, including single-use constants.
- `TEMPLATES` is the single built-in template constant; do not introduce `BUILT_IN_TEMPLATES`.
- `getBuiltInTemplates()` in `projectTemplates.ts` returns `TEMPLATES` directly.
- Ownership uses local OS username (`userInfo().username`), not SSH remote user.
- For single-project selection, use `resolveSingleProject()` patterns in `project.ts`.
- Multi-select resolution remains command-local in commands like `up.ts` and `down.ts`.
- Do not move command-specific multi-select logic into `project.ts`.
- Commands using `process.exit()` will terminate process; this breaks batch-style catch/retry patterns.
- `enableEncryption` passphrase prompt is not persisted at enable time by design.
- Use `promptPassphraseWithConfirmation` from `ui.ts` for passphrase set/confirm flows.
- For detached background tasks, use spawn with `detached: true` and `child.unref()`.

### Security Patterns

- Always escape user-derived shell input in remote commands.
- Use `escapeRemotePath()` for remote directory paths and any value from `remote.path`/`getRemotePath()`.
- Use `escapeShellArg()` for non-path values such as raw payloads.
- Never call `scp` directly with uncontrolled positional args; use `secureScp()` or `--` separator.
- Validate SSH config field values before `writeSSHConfigEntry()` writes entries.
- Use inquirer validator adapters from validation helpers.
- Use shared `ValidationResult` type for validator signatures.
- Audit log rotates at configured max bytes; paths and sensitive patterns are sanitized/redacted.

### API And Type Quirks

- `getLocalProjects()` returns project-name strings, not rich objects.
- `normalizePath` in `container.ts` is private.
- `isValidContainerId` in `container.ts` is private and enforces 12-64 hex chars.
- `requireConfig()` exits on failure and does not return null.
- `isMutagenInstalled()` is async and must be awaited.
- `@inquirer/prompts` is available transitively via `inquirer`.
- Do not enable `exactOptionalPropertyTypes`; known to cause many compile errors.

### Testing Pitfalls

- Use `bun run test` for unit-only scope.
- Bare `bun test` discovers integration/e2e suites too.
- `mock.module("execa")` at module scope can contaminate other tests in the same run.
- New modules needing reliable subprocess behavior in tests may need `node:child_process`.
- `@tests/*` alias must never be imported by production code.
- Biome may flag shell-style `${VAR}` literals in tests; use approved suppression comments when needed.

### Tooling And Build Pitfalls

- Normalize paths with `realpathSync()` before devcontainer/docker operations on macOS.
- Prefer `select()` from `@inquirer/prompts` or `rawlist` where list rendering issues exist.
- Dashboard command uses Ink/React and must remain `.tsx`.
- `devcontainer up` does not have `--rebuild-if-exists`; use supported flags like remove-existing/build-no-cache.
- Lefthook + `biome check --write` can rewrite files even if later hook stages fail.

## Environment Variables

- `SKYBOX_HOME`: override data directory (default `~/.skybox`)
- `SKYBOX_AUDIT`: set `1` to enable audit logging
- `SKYBOX_HOOK_WARNINGS`: set `0` to suppress one-time hook warning
- `SKYBOX_TELEMETRY`: set `0` to disable telemetry
- `RYBBIT_URL`: telemetry endpoint
- `RYBBIT_SITE_ID`: telemetry site id
- `RYBBIT_API_KEY`: telemetry API key
- `DEBUG`: enable list command debug output
- `SKYBOX_INSTALL_METHOD`: build-time install source metadata
- `EDITOR`: fallback editor for config editing

### Audit Logging

- Enabled when `SKYBOX_AUDIT=1`.
- Writes JSON Lines to `~/.skybox/audit.log`.
- Includes security-relevant actions such as `clone:*`, `push:*`, `rm:*`, `up:*`, `down`, `lock:force`, and `config:change`.
- Rotates at `AUDIT_LOG_MAX_BYTES` and renames rotated logs by date.

## Definition Of Done

Before handoff:

1. Run checks appropriate to change scope.
2. Verify tests for touched behavior.
3. Update docs for user-visible changes.
4. Update `CHANGELOG.md` when required.
5. Keep changes scoped; avoid unrelated file edits.
