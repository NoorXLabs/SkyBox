# Phase 4: Testing Improvements - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add error path test coverage across the codebase (Task 39 from IMPLEMENTATION.md).

**Architecture:** Write focused error-path tests for modules that currently only test happy paths. Each test exercises a specific failure mode (malformed input, missing fields, filesystem errors, invalid arguments).

**Tech Stack:** Bun test runner, shared test helpers from `src/lib/__tests__/test-utils.ts`

---

## Task 39: Add Error Path Tests

### Task 39a: Error path tests for config loading

**Files:**
- Modify: `src/lib/__tests__/config.test.ts`

**Step 1: Write failing tests for config error paths**

Add a new `describe("config error paths")` block to the existing test file:

```typescript
describe("config error paths", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("config-errors");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("loadConfig throws descriptive error on malformed YAML", () => {
		writeFileSync(
			join(ctx.testDir, "config.yaml"),
			"remotes:\n  bad:\n    host: [broken: {nope\n    path: ~/code",
		);
		expect(() => loadConfig()).toThrow("Failed to parse config file");
	});

	test("loadConfig returns null for empty config file", () => {
		writeFileSync(join(ctx.testDir, "config.yaml"), "");
		expect(loadConfig()).toBeNull();
	});

	test("saveConfig creates parent directories if missing", () => {
		// SKYBOX_HOME already points to ctx.testDir which exists
		// config.yaml should be created successfully
		const config = createTestConfig({
			remotes: { test: { host: "h", path: "/p" } },
		});
		expect(() => saveConfig(config)).not.toThrow();
		expect(configExists()).toBe(true);
	});

	test("getRemote returns null for empty remotes object", () => {
		const config = createTestConfig({ remotes: {} });
		saveConfig(config);
		expect(getRemote("nonexistent")).toBeNull();
	});
});
```

Note: Import `createTestConfig` from `./test-utils.ts` and `writeFileSync` from `node:fs`, `join` from `node:path` (some may already be imported).

**Step 2: Run tests to verify they pass**

Run: `bun test src/lib/__tests__/config.test.ts`
Expected: All new tests PASS (these test existing error handling behavior)

**Step 3: Commit**

```bash
git add src/lib/__tests__/config.test.ts
git commit -m "test: add error path tests for config loading"
```

---

### Task 39b: Error path tests for errors.ts utilities

**Files:**
- Modify: `src/lib/__tests__/errors.test.ts`

**Step 1: Write tests for edge cases in error utilities**

Add tests for uncovered edge cases:

```typescript
import { describe, expect, test } from "bun:test";
import {
	getErrorMessage,
	getExecaErrorMessage,
	hasExitCode,
	isExecaError,
} from "../errors.ts";

describe("errors edge cases", () => {
	test("getErrorMessage handles null", () => {
		expect(getErrorMessage(null)).toBe("Unknown error");
	});

	test("getErrorMessage handles undefined", () => {
		expect(getErrorMessage(undefined)).toBe("Unknown error");
	});

	test("getErrorMessage handles number", () => {
		expect(getErrorMessage(42)).toBe("Unknown error");
	});

	test("getErrorMessage handles plain string", () => {
		expect(getErrorMessage("something broke")).toBe("something broke");
	});

	test("getExecaErrorMessage prefers stderr over message", () => {
		const err = { stderr: "ssh failed", message: "generic" };
		expect(getExecaErrorMessage(err)).toBe("ssh failed");
	});

	test("getExecaErrorMessage falls back to message when stderr empty", () => {
		const err = { stderr: "", message: "fallback msg" };
		expect(getExecaErrorMessage(err)).toBe("fallback msg");
	});

	test("getExecaErrorMessage handles null input", () => {
		expect(getExecaErrorMessage(null)).toBe("Unknown error");
	});

	test("getExecaErrorMessage handles primitive", () => {
		expect(getExecaErrorMessage(123)).toBe("Unknown error");
	});

	test("isExecaError returns false for null", () => {
		expect(isExecaError(null)).toBe(false);
	});

	test("isExecaError returns false for string", () => {
		expect(isExecaError("error")).toBe(false);
	});

	test("isExecaError returns true for object with exitCode", () => {
		expect(isExecaError({ exitCode: 1 })).toBe(true);
	});

	test("isExecaError returns true for object with stderr", () => {
		expect(isExecaError({ stderr: "err" })).toBe(true);
	});

	test("isExecaError returns true for object with command", () => {
		expect(isExecaError({ command: "ssh" })).toBe(true);
	});

	test("hasExitCode matches specific code", () => {
		expect(hasExitCode({ exitCode: 127 }, 127)).toBe(true);
	});

	test("hasExitCode returns false for different code", () => {
		expect(hasExitCode({ exitCode: 1 }, 127)).toBe(false);
	});

	test("hasExitCode returns false for non-execa error", () => {
		expect(hasExitCode("not an error", 1)).toBe(false);
	});
});
```

**Step 2: Run tests**

Run: `bun test src/lib/__tests__/errors.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/errors.test.ts
git commit -m "test: add edge case tests for error utilities"
```

---

### Task 39c: Error path tests for shell.ts

**Files:**
- Modify: `src/lib/__tests__/shell.test.ts`

**Step 1: Check existing tests, then add edge cases**

Read the existing shell test file first. Then add tests for edge cases:

```typescript
test("escapeShellArg handles empty string", () => {
	expect(escapeShellArg("")).toBe("''");
});

test("escapeShellArg handles string with spaces", () => {
	expect(escapeShellArg("hello world")).toBe("'hello world'");
});

test("escapeShellArg handles string with dollar sign", () => {
	expect(escapeShellArg("$HOME")).toBe("'$HOME'");
});

test("escapeShellArg handles string with backticks", () => {
	expect(escapeShellArg("`whoami`")).toBe("'`whoami`'");
});

test("escapeShellArg handles string with single quotes", () => {
	expect(escapeShellArg("it's")).toBe("'it'\\''s'");
});

test("escapeShellArg handles string with multiple single quotes", () => {
	expect(escapeShellArg("it's a 'test'")).toBe("'it'\\''s a '\\''test'\\'''");
});
```

**Step 2: Run tests**

Run: `bun test src/lib/__tests__/shell.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/shell.test.ts
git commit -m "test: add edge case tests for shell escaping"
```

---

### Task 39d: Error path tests for paths.ts

**Files:**
- Modify: `src/lib/__tests__/paths.test.ts`

**Step 1: Check existing tests, then add edge cases**

Read the existing paths test file first. Add tests for when `SKYBOX_HOME` is unset:

```typescript
test("getSkyboxHome falls back to ~/.skybox when SKYBOX_HOME unset", () => {
	const original = process.env.SKYBOX_HOME;
	delete process.env.SKYBOX_HOME;
	try {
		const result = getSkyboxHome();
		expect(result).toContain(".skybox");
		expect(result).not.toBe("");
	} finally {
		if (original) process.env.SKYBOX_HOME = original;
	}
});
```

**Step 2: Run tests**

Run: `bun test src/lib/__tests__/paths.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/paths.test.ts
git commit -m "test: add fallback path test for paths.ts"
```

---

### Task 39e: Error path tests for download.ts

**Files:**
- Modify: `src/lib/__tests__/download.test.ts`

**Step 1: Check existing tests, then add edge cases**

Read the existing download test file first. Add tests for URL construction edge cases and platform checks:

```typescript
test("getMutagenDownloadUrl handles linux platform", () => {
	const url = getMutagenDownloadUrl("linux", "amd64", "0.17.5");
	expect(url).toContain("linux_amd64");
});

test("getMutagenDownloadUrl handles darwin arm64", () => {
	const url = getMutagenDownloadUrl("darwin", "arm64", "0.17.5");
	expect(url).toContain("darwin_arm64");
});

test("getMutagenChecksumUrl returns valid URL", () => {
	const url = getMutagenChecksumUrl("0.17.5");
	expect(url).toContain("SHA256SUMS");
	expect(url).toContain("v0.17.5");
});
```

**Step 2: Run tests**

Run: `bun test src/lib/__tests__/download.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/download.test.ts
git commit -m "test: add error path tests for download utilities"
```

---

## Pre-Implementation Notes

- **Test helpers:** Use `createTestContext`, `createTestConfig`, `createTestRemote` from `src/lib/__tests__/test-utils.ts`
- **Pattern:** Each test file uses `beforeEach`/`afterEach` for setup/teardown with isolated temp directories
- **Run all tests after each commit:** `bun test` to ensure no regressions
- **Check existing tests first:** Before adding to a test file, read it to avoid duplicating existing coverage
