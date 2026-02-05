# Test Directory Restructure Design

**Date:** 2026-02-04
**Status:** Approved
**Scope:** Move all test files from co-located `__tests__/` directories inside `src/` to a top-level `tests/` directory alongside `src/`.

## Problem

1. **Import inconsistency**: Integration and E2E test files use relative imports (`../helpers/`) for tier-specific helpers because no `@` alias covers their directories. Unit tests use `@lib/__tests__/test-utils.ts` which conflates test utilities with production library code.
2. **Scattered test infrastructure**: Shared test utilities live inside `src/lib/__tests__/`, integration helpers in `src/__integration__/helpers/`, and E2E helpers in `src/__e2e__/helpers/`. No single home for shared test code.
3. **Source/test boundary**: `src/` mixes production and test code. While this doesn't affect the binary (bun tree-shakes from entry point), the organizational intent is unclear.

## Decision

Move all test code to a top-level `tests/` directory. Add a `@tests/*` path alias. Keep `src/` exclusively for production code.

## Target Structure

```
src/                        # production code ONLY
├── commands/
├── lib/
├── types/
└── index.ts

tests/                      # all test code
├── helpers/                # shared test utilities (all tiers import)
│   └── test-utils.ts
├── unit/
│   ├── lib/                # mirrors src/lib/ — one test file per module
│   │   ├── config.test.ts
│   │   ├── container.test.ts
│   │   ├── config-auto-up.test.ts
│   │   ├── constants.test.ts
│   │   ├── container-id-isolated.test.ts
│   │   ├── download.test.ts
│   │   ├── encryption.test.ts
│   │   ├── errors.test.ts
│   │   ├── hooks.test.ts
│   │   ├── migration.test.ts
│   │   ├── mutagen.test.ts
│   │   ├── mutagen-extract.test.ts
│   │   ├── mutagen-selective.test.ts
│   │   ├── paths.test.ts
│   │   ├── project.test.ts
│   │   ├── projectTemplates.test.ts
│   │   ├── remote.test.ts
│   │   ├── session.test.ts
│   │   ├── shell.test.ts
│   │   ├── ssh.test.ts
│   │   ├── templates.test.ts
│   │   ├── update-check.test.ts
│   │   └── validation.test.ts
│   └── commands/           # mirrors src/commands/
│       ├── browse.test.ts
│       ├── clone.test.ts
│       ├── config-cmd.test.ts
│       ├── config-devcontainer.test.ts
│       ├── dashboard.test.ts
│       ├── doctor.test.ts
│       ├── editor.test.ts
│       ├── encrypt.test.ts
│       ├── hook.test.ts
│       ├── init.test.ts
│       ├── list.test.ts
│       ├── logs.test.ts
│       ├── new.test.ts
│       ├── open.test.ts
│       ├── push.test.ts
│       ├── remote.test.ts
│       ├── shell.test.ts
│       ├── shell-docker-isolated.test.ts
│       ├── status.test.ts
│       ├── up.test.ts
│       └── update.test.ts
├── integration/
│   ├── helpers/
│   │   └── docker-test-utils.ts
│   └── docker/
│       ├── container-lifecycle.test.ts
│       ├── devcontainer-templates.test.ts
│       └── shell-entry.test.ts
└── e2e/
    ├── helpers/
    │   ├── e2e-test-utils.ts
    │   └── test-config.ts
    ├── remote/
    │   ├── browse-list.test.ts
    │   ├── lock-system.test.ts
    │   └── push-clone.test.ts
    ├── sync/
    │   └── mutagen-sync.test.ts
    └── workflow/
        └── full-lifecycle.test.ts
```

## File Inventory

| Current Location | New Location | Count |
|-----------------|--------------|-------|
| `src/lib/__tests__/*.test.ts` | `tests/unit/lib/` | 23 |
| `src/commands/__tests__/*.test.ts` | `tests/unit/commands/` | 21 |
| `src/__integration__/docker/*.test.ts` | `tests/integration/docker/` | 3 |
| `src/__e2e__/**/*.test.ts` | `tests/e2e/` (preserving subdirs) | 5 |
| `src/lib/__tests__/test-utils.ts` | `tests/helpers/test-utils.ts` | 1 |
| `src/__integration__/helpers/docker-test-utils.ts` | `tests/integration/helpers/docker-test-utils.ts` | 1 |
| `src/__e2e__/helpers/e2e-test-utils.ts` | `tests/e2e/helpers/e2e-test-utils.ts` | 1 |
| `src/__e2e__/helpers/test-config.ts` | `tests/e2e/helpers/test-config.ts` | 1 |
| **Total** | | **56** |

## Config Changes

### tsconfig.json

Add `@tests/*` path alias and include tests directory:

```json
{
  "compilerOptions": {
    "paths": {
      "@commands/*": ["src/commands/*"],
      "@lib/*": ["src/lib/*"],
      "@typedefs/*": ["src/types/*"],
      "@tests/*": ["tests/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

### package.json

Update test scripts:

```json
{
  "scripts": {
    "test": "bun test --preload ./tests/helpers/test-utils.ts tests/unit",
    "test:integration": "bun test tests/integration",
    "test:e2e": "bun test tests/e2e",
    "test:all": "bun test tests"
  }
}
```

### biome.json

Add tests to includes:

```json
{
  "files": {
    "includes": [
      "**/src/**/*",
      "**/tests/**/*",
      "**/.vscode/**/*",
      "**/index.html",
      "**/vite.config.js",
      "!**/src/routeTree.gen.ts",
      "!**/src/styles.css"
    ]
  }
}
```

### lefthook.yml

Update test glob:

```yaml
test:
  priority: 3
  glob: "{src,tests}/**/*.{ts,test.ts}"
  run: bun run test
```

## Import Changes

### New alias usage

| Old Import | New Import |
|-----------|-----------|
| `@lib/__tests__/test-utils.ts` | `@tests/helpers/test-utils.ts` |
| `../helpers/docker-test-utils.ts` | `@tests/integration/helpers/docker-test-utils.ts` |
| `../helpers/e2e-test-utils.ts` | `@tests/e2e/helpers/e2e-test-utils.ts` |
| `../helpers/test-config.ts` | `@tests/e2e/helpers/test-config.ts` |

### Unchanged imports

All production code imports (`@lib/*`, `@commands/*`, `@typedefs/*`) remain exactly the same in test files. Only test-to-test imports change.

## CLAUDE.md Updates

### New Known Gotcha

> **`@tests/*` alias is test-only**: The `@tests/*` path alias must NEVER be imported from production code in `src/`. It exists solely for test-to-test imports. Biome cannot enforce this, so treat it as a convention.

### Updated sections

- **Directory Structure**: Add `tests/` tree, remove `__tests__/` from `src/` subtrees
- **Test File Locations** table: Update all paths to `tests/` prefix
- **Test Structure Pattern**: Update example imports to use `@tests/*`
- **Running Tests**: Verify script names still match

## Documentation Updates Required

- `CLAUDE.md` — directory structure, test sections, known gotchas (detailed above)
- No VitePress user docs affected (tests are internal tooling)

## Migration Steps

1. Create `tests/` directory structure
2. Move all 56 files to new locations
3. Update all imports in moved files (test-to-test imports only)
4. Update config files (tsconfig, package.json, biome.json, lefthook.yml)
5. Delete empty `__tests__/`, `__integration__/`, `__e2e__/` directories from `src/`
6. Update CLAUDE.md
7. Run `bun run check` to verify biome is happy
8. Run `bun run typecheck` to verify TypeScript resolves all paths
9. Run `bun run test` to verify unit tests pass
10. Commit
