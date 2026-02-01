# Path Aliases Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all relative imports with granular path aliases (`@commands/`, `@lib/`, `@types/`) for cleaner, more readable imports.

**Architecture:** Add TypeScript path aliases in `tsconfig.json`. Bun respects `tsconfig.json` paths with `moduleResolution: "bundler"`, so no additional runtime config needed. All relative imports get rewritten to aliased forms.

**Tech Stack:** TypeScript paths, Bun runtime resolution

---

### Task 1: Add path aliases to tsconfig.json

**Files:**
- Modify: `tsconfig.json`

**Step 1: Add baseUrl and paths to tsconfig.json**

Add `baseUrl` and `paths` to `compilerOptions`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@commands/*": ["src/commands/*"],
      "@lib/*": ["src/lib/*"],
      "@types/*": ["src/types/*"]
    }
  }
}
```

**Step 2: Run typecheck to verify config is valid**

Run: `bun run typecheck`
Expected: PASS (no import changes yet, just config)

**Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "feat: add path alias configuration to tsconfig.json"
```

---

### Task 2: Rewrite imports in src/lib/ files

**Files:**
- Modify: All `.ts` files in `src/lib/` (not `__tests__/`)

Rewrite all relative imports to use aliases. The mapping:
- `"../types/index.ts"` → `"@types/index.ts"`
- `"./foo.ts"` (within lib/) → `"@lib/foo.ts"`

Files to modify and their import rewrites:

- `src/lib/config.ts`: `../types/index.ts` → `@types/index.ts`, `./migration.ts` → `@lib/migration.ts`, `./paths.ts` → `@lib/paths.ts`
- `src/lib/constants.ts`: `../types/index.ts` → `@types/index.ts`
- `src/lib/container.ts`: `./constants.ts` → `@lib/constants.ts`, `../types/index.ts` → `@types/index.ts`, `./errors.ts` → `@lib/errors.ts`
- `src/lib/download.ts`: `./constants.ts` → `@lib/constants.ts`, `./errors.ts` → `@lib/errors.ts`, `./paths.ts` → `@lib/paths.ts`
- `src/lib/encryption.ts`: `./constants.ts` → `@lib/constants.ts`
- `src/lib/lock.ts`: `../types/index.ts` → `@types/index.ts`, `./constants.ts` → `@lib/constants.ts`, `./shell.ts` → `@lib/shell.ts`, `./ssh.ts` → `@lib/ssh.ts`
- `src/lib/migration.ts`: `../types/index.ts` → `@types/index.ts`
- `src/lib/mutagen.ts`: `../types/index.ts` → `@types/index.ts`, `./errors.ts` → `@lib/errors.ts`, `./paths.ts` → `@lib/paths.ts`
- `src/lib/mutagen-extract.ts`: `./constants.ts` → `@lib/constants.ts`, `./errors.ts` → `@lib/errors.ts`, `./paths.ts` → `@lib/paths.ts`
- `src/lib/paths.ts`: `./constants.ts` → `@lib/constants.ts`
- `src/lib/project.ts`: `./paths.ts` → `@lib/paths.ts`
- `src/lib/projectTemplates.ts`: `../types/index.ts` → `@types/index.ts`, `./config.ts` → `@lib/config.ts`, `./constants.ts` → `@lib/constants.ts`
- `src/lib/remote.ts`: `./ssh.ts` → `@lib/ssh.ts`
- `src/lib/ssh.ts`: `../types/index.ts` → `@types/index.ts`, `./constants.ts` → `@lib/constants.ts`, `./errors.ts` → `@lib/errors.ts`
- `src/lib/templates.ts`: `../types/index.ts` → `@types/index.ts`, `./config.ts` → `@lib/config.ts`, `./constants.ts` → `@lib/constants.ts`, `./paths.ts` → `@lib/paths.ts`, `./ui.ts` → `@lib/ui.ts`
- `src/lib/update-check.ts`: `../types/index.ts` → `@types/index.ts`, `./constants.ts` → `@lib/constants.ts`, `./paths.ts` → `@lib/paths.ts`

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/lib/*.ts
git commit -m "refactor: use path aliases in src/lib/ imports"
```

---

### Task 3: Rewrite imports in src/commands/ files

**Files:**
- Modify: All `.ts` files in `src/commands/` (not `__tests__/`)

The mapping:
- `"../lib/foo.ts"` → `"@lib/foo.ts"`
- `"../types/index.ts"` → `"@types/index.ts"`
- `"./foo.ts"` (within commands/) → `"@commands/foo.ts"`

All command files follow the same pattern. Every command imports from `../lib/` and `../types/`.

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Run tests**

Run: `bun test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/commands/*.ts
git commit -m "refactor: use path aliases in src/commands/ imports"
```

---

### Task 4: Rewrite imports in src/index.ts

**Files:**
- Modify: `src/index.ts`

The mapping:
- `"./commands/foo.ts"` → `"@commands/foo.ts"`
- `"./lib/foo.ts"` → `"@lib/foo.ts"`
- `"../package.json"` stays as-is (outside src/, no alias applies)

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "refactor: use path aliases in src/index.ts"
```

---

### Task 5: Rewrite imports in test files

**Files:**
- Modify: All `.test.ts` and `test-utils.ts` files in `src/lib/__tests__/` and `src/commands/__tests__/`

The mapping for `src/lib/__tests__/`:
- `"../foo.ts"` → `"@lib/foo.ts"`
- `"../../types/index.ts"` → `"@types/index.ts"`
- `"./test-utils.ts"` → `"@lib/__tests__/test-utils.ts"`

The mapping for `src/commands/__tests__/`:
- `"../../lib/__tests__/test-utils.ts"` → `"@lib/__tests__/test-utils.ts"`
- `"../../lib/foo.ts"` → `"@lib/foo.ts"`
- `"../../types/index.ts"` → `"@types/index.ts"`
- `"../foo.ts"` → `"@commands/foo.ts"`

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/lib/__tests__/ src/commands/__tests__/
git commit -m "refactor: use path aliases in test files"
```

---

### Task 6: Run full validation

**Step 1: Run all checks**

Run: `bun run check:ci && bun run typecheck && bun test`
Expected: All pass

**Step 2: Verify no relative imports remain (except package.json)**

Run: `grep -rn 'from "\.\./\|from "\./' src/ --include="*.ts" | grep -v 'package.json'`
Expected: No output (no relative imports left)
