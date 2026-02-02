# CLAUDE.md - AI Assistant Guide for DevBox

## Project Overview

DevBox is a CLI tool for managing local-first development containers with remote synchronization. It solves disk bloat, latency, and multi-machine workflow complexity by running containers locally while syncing code bidirectionally with a remote server using Mutagen.

**Version:** 0.6.0-beta
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
src/
├── index.ts              # CLI entry point (Commander.js setup)
├── commands/             # Command implementations
│   ├── init.ts           # Interactive setup wizard
│   ├── clone.ts          # Download project from remote
│   ├── push.ts           # Upload project to remote
│   ├── browse.ts         # List remote projects
│   ├── list.ts           # List local projects
│   ├── up.ts             # Start container + acquire lock
│   ├── down.ts           # Stop container + release lock
│   ├── status.ts         # Show project status
│   ├── shell.ts          # Enter container shell
│   ├── editor.ts         # Configure default editor
│   ├── rm.ts             # Remove local project
│   ├── config.ts         # View/edit configuration
│   ├── new.ts            # Create new project on remote
│   ├── logs.ts            # Show container/sync logs
│   ├── update.ts          # Update Mutagen binary
│   ├── config-devcontainer.ts # Edit/reset devcontainer.json
│   └── __tests__/        # Command unit tests
├── lib/                  # Shared libraries
│   ├── config.ts         # YAML config operations
│   ├── constants.ts      # Shared constants (Docker labels, etc.)
│   ├── container.ts      # Docker/devcontainer operations
│   ├── encryption.ts      # AES-256-GCM encryption primitives
│   ├── validation.ts      # Path safety and input validation
│   ├── mutagen.ts        # Sync session management
│   ├── ssh.ts            # SSH operations and host parsing
│   ├── lock.ts           # Multi-machine lock system (atomic acquisition)
│   ├── remote.ts         # Remote project operations
│   ├── project.ts        # Project path resolution
│   ├── download.ts       # Binary downloads (Mutagen)
│   ├── templates.ts      # Devcontainer templates
│   ├── migration.ts      # Config format migration
│   ├── paths.ts          # Path constants
│   ├── errors.ts         # Error handling utilities
│   ├── shell.ts          # Shell escaping utilities
│   ├── ui.ts             # Terminal UI (colors, spinners)
│   ├── startup.ts        # Dependency checks
│   └── __tests__/        # Library unit tests
└── types/
    └── index.ts          # TypeScript interfaces
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
| `bun run test` | Run all tests |
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
  - `@typedefs/*` → `src/types/*` (e.g., `import type { DevboxConfigV2 } from "@typedefs/index.ts"`)
  - Exception: `../package.json` in `src/index.ts` (outside `src/`, no alias)
  - Note: `@typedefs` is used instead of `@types` to avoid TypeScript TS6137 conflict
- **Unused imports:** Error (auto-removed)
- **Import organization:** Auto-sorted alphabetically

### TypeScript Conventions

- Strict mode enabled - no implicit any, strict null checks
- All types defined in `src/types/index.ts`
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
- Tests co-located in `__tests__/` directories

## Testing Guidelines

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/lib/__tests__/config.test.ts

# Run tests matching pattern
bun test --grep "config"
```

### Test Structure Pattern

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("feature name", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		// Create isolated test directory
		testDir = join(tmpdir(), `devbox-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		// Mock DEVBOX_HOME
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		// Cleanup
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
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

### Test Conventions

- Each test uses isolated temp directory with unique timestamp
- Mock `DEVBOX_HOME` via `process.env` for config isolation
- Clean up all created files in `afterEach`
- Use real filesystem operations (no mocking fs module)
- Test both success and error cases

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

1. Create `src/commands/<name>.ts`:
```typescript
import { Command } from "commander";

export function registerNameCommand(program: Command): void {
	program
		.command("name")
		.description("Command description")
		.argument("[arg]", "argument description")
		.option("-f, --flag", "flag description")
		.action(async (arg, options) => {
			// Implementation
		});
}
```

2. Register in `src/index.ts`:
```typescript
import { registerNameCommand } from "./commands/name.ts";
// ...
registerNameCommand(program);
```

3. Add tests in `src/commands/__tests__/name.test.ts`

### Adding a New Library Function

1. Add function to appropriate file in `src/lib/`
2. Export from the file
3. Add tests in `src/lib/__tests__/<file>.test.ts`
4. If new types needed, add to `src/types/index.ts`

### Modifying Configuration

Config file location: `~/.devbox/config.yaml`

Config structure (V2 - multi-remote):
```yaml
editor: cursor | code | vim | nvim | zed

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

### Lock System

Multi-machine lock prevents conflicts when same project is opened on multiple machines:
- Lock file stored on remote: `~/.devbox-locks/<project>.lock`
- Contains: machine name, user, timestamp, PID
- Acquired by `devbox up`, released by `devbox down`
- Uses atomic test-and-set (shell noclobber mode) to prevent race conditions
- See `src/lib/lock.ts` for implementation

### Sync System

Bidirectional file sync via Mutagen:
- Mutagen binary auto-downloaded during `devbox init`
- Sessions managed in `src/lib/mutagen.ts`
- Default ignore patterns in `src/lib/constants.ts` as `DEFAULT_IGNORE`

### Container Management

Uses Docker with devcontainer spec:
- Container operations in `src/lib/container.ts`
- Devcontainer templates in `src/lib/templates.ts`
- Container naming: `devbox-<project-name>`

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point, command registration |
| `src/types/index.ts` | All TypeScript interfaces |
| `src/lib/config.ts` | Config file operations |
| `src/lib/container.ts` | Docker operations |
| `src/lib/mutagen.ts` | Sync session management |
| `src/lib/lock.ts` | Multi-machine lock system |
| `src/lib/ui.ts` | Terminal output helpers |
| `src/lib/errors.ts` | Error handling utilities |
| `src/lib/encryption.ts` | AES-256-GCM encrypt/decrypt for config values |
| `src/lib/validation.ts` | Path traversal prevention, input validation |
| `src/lib/shell.ts` | Shell escaping: `escapeShellArg()`, `buildShellCommand()` |
| `.github/workflows/release.yml` | Release workflow: builds 4 platform binaries (darwin-arm64, darwin-x64, linux-x64, linux-arm64) |
| `biome.json` | Linting/formatting config |
| `lefthook.yml` | Git hooks config |
| `tsconfig.json` | TypeScript config |

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

1. **Update CLAUDE.md** — If you learned something useful (new gotchas, conventions, commands, architectural decisions), run `/claude-md-management:revise-claude-md`. Skip if the session was simple Q&A or trivial changes.
2. **Update task tracker** — If you completed tasks from a plan, mark them done with `TaskUpdate` and update `plans/IMPLEMENTATION.md` with `[x]` and commit hashes in `plans/archive/ARCHIVED-IMPLEMENTATION.md`.

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

- **Shell injection in remote commands**: Always use `escapeShellArg()` from `src/lib/shell.ts` when interpolating user input into SSH commands via `runRemoteCommand()`.
