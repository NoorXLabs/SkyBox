# Test Infrastructure Improvements (Tasks 35-42) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify test infrastructure by migrating files to shared helpers and improving test coverage/isolation.

**Architecture:** The shared `test-utils.ts` already has `createTestContext`, `createTestConfig`, `createTestRemote`, `writeTestConfig`, and `isExecaMocked`. Most tasks involve migrating existing test files to use these helpers, adding a new `createTestGitRepo` helper, and strengthening weak test assertions.

**Tech Stack:** Bun test runner, TypeScript, execa

---

### Task 1: Migrate mock detection to shared `isExecaMocked` (Task 35)

**Files:**
- Modify: `src/lib/__tests__/container.test.ts` (remove lines 21-36 custom `isModuleMocked`)
- Modify: `src/lib/__tests__/container-id-isolated.test.ts` (remove lines 17-22 custom `isModuleMocked`)
- Modify: `src/commands/__tests__/status.test.ts` (replace env-var-based skip with `isExecaMocked`)

**Step 1: Update container.test.ts to use shared helper**

Replace the custom `isModuleMocked` function (lines 21-36) with an import from test-utils:

```typescript
import { isExecaMocked } from "./test-utils.ts";
```

Remove the entire `_moduleMocked` / `isModuleMocked` block. Replace all `isModuleMocked()` calls with `isExecaMocked()` (note: `isExecaMocked` is async, so use `await`). Since `test.skipIf` needs a boolean not a promise, add a top-level detection at the start of the describe block:

```typescript
describe("container module", () => {
	let execaMocked = false;

	beforeAll(async () => {
		execaMocked = await isExecaMocked();
	});

	// Then use: test.skipIf(execaMocked)(...)
```

**Step 2: Update container-id-isolated.test.ts**

This file already mocks execa at module level, so `isExecaMocked` from test-utils isn't the right pattern here — the file intentionally mocks execa. The existing `isModuleMocked` checks if *another* test file already replaced the module. Keep the existing pattern since it checks something different (whether the mock is from THIS file vs leaked from another). **Skip this file.**

**Step 3: Update status.test.ts**

Replace the `SKIP_EXECA_TESTS` env-var approach with the shared helper:

```typescript
import { isExecaMocked } from "../../lib/__tests__/test-utils.ts";

describe("status command", () => {
	let execaMocked = false;

	beforeAll(async () => {
		execaMocked = await isExecaMocked();
	});

	// Replace: test.skipIf(SKIP_EXECA_TESTS)(...)
	// With:    test.skipIf(execaMocked)(...)
```

Remove the `SKIP_EXECA_TESTS` constant and `realExeca` import (use regular `execa` import instead).

**Step 4: Run tests**

Run: `bun test src/lib/__tests__/container.test.ts src/commands/__tests__/status.test.ts`
Expected: All tests pass (some skipped when mocked)

**Step 5: Commit**

```bash
git add src/lib/__tests__/container.test.ts src/commands/__tests__/status.test.ts
git commit -m "refactor(test): unify mock detection using shared isExecaMocked helper"
```

---

### Task 2: Migrate test files to `createTestContext` (Task 36 partial)

**Files:**
- Modify: `src/commands/__tests__/clone.test.ts`
- Modify: `src/commands/__tests__/editor.test.ts`
- Modify: `src/lib/__tests__/projectTemplates.test.ts`

Pick 3 representative files to migrate. Each follows the same pattern.

**Step 1: Migrate clone.test.ts**

Replace the boilerplate setup/teardown:

```typescript
import { createTestContext, type TestContext } from "../../lib/__tests__/test-utils.ts";

describe("clone command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("clone");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	// Replace all `testDir` references with `ctx.testDir`
```

Remove the manual `testDir`, `originalEnv`, `beforeEach`/`afterEach` blocks and the imports they required (`existsSync`, `mkdirSync`, `rmSync`, `tmpdir`, `join` — keep `join` if still needed for path construction, keep others if used elsewhere in the file).

**Step 2: Migrate editor.test.ts with same pattern**

**Step 3: Migrate projectTemplates.test.ts with same pattern**

**Step 4: Run tests**

Run: `bun test src/commands/__tests__/clone.test.ts src/commands/__tests__/editor.test.ts src/lib/__tests__/projectTemplates.test.ts`
Expected: All pass

**Step 5: Commit**

```bash
git add src/commands/__tests__/clone.test.ts src/commands/__tests__/editor.test.ts src/lib/__tests__/projectTemplates.test.ts
git commit -m "refactor(test): migrate 3 test files to createTestContext helper"
```

---

### Task 3: Migrate remaining test files to `createTestContext` (Task 36 continued)

**Files:** All remaining test files using the manual `testDir`/`originalEnv` pattern. Check each of these:
- `src/commands/__tests__/init.test.ts`
- `src/commands/__tests__/config-cmd.test.ts`
- `src/commands/__tests__/new.test.ts`
- `src/lib/__tests__/config.test.ts`
- `src/lib/__tests__/migration.test.ts`
- `src/commands/__tests__/list.test.ts`
- `src/commands/__tests__/status.test.ts`
- Any others found via `grep -r "originalEnv" src/`

**Step 1: Migrate each file using the same pattern from Task 2**

For files that also create config objects inline, replace with `createTestConfig()` and `createTestRemote()` where the default values match. Only use the factory when the defaults are appropriate — if a test needs specific values, pass overrides.

**Step 2: Run full test suite**

Run: `bun test`
Expected: All pass

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(test): migrate remaining test files to shared test helpers"
```

---

### Task 4: Add `createTestGitRepo` helper (Task 37)

**Files:**
- Modify: `src/lib/__tests__/test-utils.ts`
- Modify: `src/commands/__tests__/status.test.ts`
- Modify: `src/commands/__tests__/list.test.ts`

**Step 1: Add helper to test-utils.ts**

```typescript
/**
 * Creates an initialized git repository in the given directory.
 * Includes an initial commit so branches are established.
 */
export async function createTestGitRepo(dir: string): Promise<void> {
	await execa("git", ["init"], { cwd: dir });
	await execa("git", ["config", "user.email", "test@test.com"], { cwd: dir });
	await execa("git", ["config", "user.name", "Test"], { cwd: dir });
	writeFileSync(join(dir, "README.md"), "# Test");
	await execa("git", ["add", "."], { cwd: dir });
	await execa("git", ["commit", "-m", "init"], { cwd: dir });
}
```

Add `join` import from `node:path` if not already present (it is).

**Step 2: Migrate status.test.ts git setup**

Replace the repeated git init blocks (lines 52-62, 77-87, 127-137) with:

```typescript
await createTestGitRepo(testDir);
```

**Step 3: Migrate list.test.ts git setup**

Replace lines 59-68 with:

```typescript
await createTestGitRepo(projectPath);
```

**Step 4: Run tests**

Run: `bun test src/commands/__tests__/status.test.ts src/commands/__tests__/list.test.ts`
Expected: Pass (git-dependent tests may be skipped in full suite)

**Step 5: Commit**

```bash
git add src/lib/__tests__/test-utils.ts src/commands/__tests__/status.test.ts src/commands/__tests__/list.test.ts
git commit -m "refactor(test): add createTestGitRepo helper and migrate git setup"
```

---

### Task 5: Strengthen clone.test.ts assertions (Task 38)

**Files:**
- Modify: `src/commands/__tests__/clone.test.ts`

The current tests are trivial — they test string operations, not actual command behavior. Since `cloneCommand` requires SSH and remote server, we can't integration-test it easily. Instead, test the validation and path logic that clone uses.

**Step 1: Write meaningful tests**

Replace the 3 trivial tests with tests that actually exercise clone logic:

```typescript
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createTestContext, type TestContext } from "../../lib/__tests__/test-utils.ts";
import { validateProjectName } from "../../lib/projectTemplates.ts";
import { getProjectPath } from "../../lib/project.ts";

describe("clone command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("clone");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("rejects empty project name", () => {
		const result = validateProjectName("");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("empty");
	});

	test("rejects project names with path traversal", () => {
		const result = validateProjectName("../etc/passwd");
		expect(result.valid).toBe(false);
	});

	test("constructs correct local project path", () => {
		const projectsDir = join(ctx.testDir, "Projects");
		mkdirSync(projectsDir, { recursive: true });
		const path = getProjectPath("myapp");
		expect(path).toContain("myapp");
	});

	test("detects existing local project directory", () => {
		const projectsDir = join(ctx.testDir, "Projects");
		const localPath = join(projectsDir, "myapp");
		mkdirSync(localPath, { recursive: true });
		expect(existsSync(localPath)).toBe(true);
	});
});
```

Check that `getProjectPath` and `validateProjectName` are importable from those paths. Adjust imports as needed.

**Step 2: Run test**

Run: `bun test src/commands/__tests__/clone.test.ts`
Expected: All pass

**Step 3: Commit**

```bash
git add src/commands/__tests__/clone.test.ts
git commit -m "test(clone): strengthen assertions to test actual validation logic"
```

---

### Task 6: Add invalid YAML config test (Task 41)

**Files:**
- Modify: `src/lib/__tests__/config.test.ts`

**Step 1: Add test for malformed YAML**

```typescript
test("throws user-friendly error on invalid YAML", () => {
	const configPath = join(testDir, "config.yaml");
	writeFileSync(configPath, "invalid: yaml: [broken: {nope");

	expect(() => loadConfig()).toThrow();
});
```

Verify that `loadConfig` is imported and the function throws on invalid YAML (Task 19 added this handling).

**Step 2: Run test**

Run: `bun test src/lib/__tests__/config.test.ts`
Expected: Pass

**Step 3: Commit**

```bash
git add src/lib/__tests__/config.test.ts
git commit -m "test(config): add test for invalid YAML error handling"
```

---

### Task 7: Add projectTemplates coverage (Task 40)

**Files:**
- Modify: `src/lib/__tests__/projectTemplates.test.ts`

**Step 1: Verify existing coverage**

Looking at the file — it already tests `BUILT_IN_TEMPLATES`, `getBuiltInTemplates()`, `getUserTemplates()`, `getAllTemplates()`, and `validateProjectName()`. Task 40 says "Only validateProjectName tested" but the file already has coverage for all exported functions. Mark Task 40 as already complete in the tracker.

**Step 2: Update IMPLEMENTATION.md**

Mark Task 40 as complete with a note that coverage already exists.

**Step 3: Commit**

```bash
git add plans/IMPLEMENTATION.md
git commit -m "docs: mark Task 40 as already complete"
```

---

### Task 8: Document module-level mock issue (Task 42)

**Files:**
- Modify: `src/lib/__tests__/container-id-isolated.test.ts`
- Modify: `src/lib/__tests__/lock.test.ts`
- Modify: `src/commands/__tests__/shell-docker-isolated.test.ts`

Task 42 says "Fix module-level mock pollution" with "Reset mocks in afterEach or use dependency injection." However, Bun's `mock.module()` is permanent per process — it cannot be reset in `afterEach`. The current approach (isolated test files with `skipIf` guards) is the correct workaround for Bun's test runner.

**Step 1: Ensure all mock-heavy files have `afterEach` that resets mock call history**

In each file, add/verify:

```typescript
afterEach(() => {
	mockExeca.mockClear();
	// clear other mocks too
});
```

This doesn't fix module-level pollution (Bun limitation) but ensures mock call counts don't leak between tests within the same file.

**Step 2: Add header comments to all isolated test files explaining the constraint**

Ensure `container-id-isolated.test.ts` and `lock.test.ts` have the same style header comment that `status.test.ts` already has, explaining why they use module-level mocks and the isolation requirement.

**Step 3: Run full test suite**

Run: `bun test`
Expected: All pass

**Step 4: Commit**

```bash
git add src/lib/__tests__/container-id-isolated.test.ts src/lib/__tests__/lock.test.ts src/commands/__tests__/shell-docker-isolated.test.ts
git commit -m "test: add mock cleanup and document module-level mock constraints"
```

---

## Summary

| Task | Tracker ID | Description |
|------|-----------|-------------|
| 1 | 35 | Unify mock detection → shared `isExecaMocked` |
| 2-3 | 36 | Migrate test files to `createTestContext`/`createTestConfig` |
| 4 | 37 | Add `createTestGitRepo` helper |
| 5 | 38 | Strengthen clone.test.ts assertions |
| 6 | 41 | Add invalid YAML config test |
| 7 | 40 | Already complete — update tracker |
| 8 | 42 | Add mock cleanup + document Bun limitation |

**Not included:** Tasks 39 (add error path tests) — too broad, needs its own plan with specific error scenarios identified per command.
