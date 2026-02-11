// tests/unit/commands/status.test.ts
//
// NOTE: These tests require real execa (git, du commands) and CANNOT be run
// together with test files that mock execa at module level. Bun's mock.module()
// affects all modules in the same test process, causing these tests to fail.
//
// RUN SEPARATELY: bun test tests/unit/commands/status.test.ts
//
// When run as part of the full test suite, git/du dependent tests are skipped.
// Set STATUS_TEST_ISOLATED=1 to run them:
//   STATUS_TEST_ISOLATED=1 bun test tests/unit/commands/status.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
// Import only the helper functions that don't depend on PROJECTS_DIR
import { getDiskUsage, getGitInfo, getLastActive } from "@commands/status.ts";
import {
	createTestContext,
	createTestGitRepo,
	isExecaMocked,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

// These tests require real execa but when run in full suite, execa may be mocked
// by other test files (shell-docker-isolated.test.ts).
const execaMocked = await isExecaMocked();

describe("status command helpers", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("status");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	describe("getGitInfo", () => {
		test.skipIf(execaMocked)("returns null for non-git directory", async () => {
			const result = await getGitInfo(ctx.testDir);
			expect(result).toBeNull();
		});

		test.skipIf(execaMocked)(
			"returns branch and clean status for git repo",
			async () => {
				await createTestGitRepo(ctx.testDir);

				const result = await getGitInfo(ctx.testDir);

				expect(result).not.toBeNull();
				expect(result?.branch).toBeTruthy();
				expect(result?.status).toBe("clean");
				expect(result?.ahead).toBe(0);
				expect(result?.behind).toBe(0);
			},
		);

		test.skipIf(execaMocked)(
			"returns dirty status for uncommitted changes",
			async () => {
				await createTestGitRepo(ctx.testDir);

				// Make uncommitted change
				writeFileSync(join(ctx.testDir, "new.txt"), "new file");

				const result = await getGitInfo(ctx.testDir);

				expect(result).not.toBeNull();
				expect(result?.status).toBe("dirty");
			},
		);
	});

	describe("getDiskUsage", () => {
		test.skipIf(execaMocked)("returns size string for directory", async () => {
			// Create some files
			writeFileSync(join(ctx.testDir, "file1.txt"), "hello world");
			writeFileSync(join(ctx.testDir, "file2.txt"), "more content");

			const result = await getDiskUsage(ctx.testDir);

			// Should return something like "4.0K" or "8.0K" depending on filesystem
			expect(result).toMatch(/^\d+(\.\d+)?[KMGT]?$/i);
		});

		test.skipIf(execaMocked)("returns 'unknown' on error", async () => {
			const result = await getDiskUsage(
				"/nonexistent/path/that/does/not/exist",
			);
			expect(result).toBe("unknown");
		});
	});

	describe("getLastActive", () => {
		test.skipIf(execaMocked)(
			"returns date from git log if available",
			async () => {
				await createTestGitRepo(ctx.testDir);

				const result = await getLastActive(ctx.testDir);

				expect(result).toBeInstanceOf(Date);
				// Should be recent (within last minute)
				expect(Date.now() - (result?.getTime() ?? 0)).toBeLessThan(60000);
			},
		);

		test.skipIf(execaMocked)(
			"returns directory mtime for non-git directory",
			async () => {
				writeFileSync(join(ctx.testDir, "file.txt"), "content");

				const result = await getLastActive(ctx.testDir);

				expect(result).toBeInstanceOf(Date);
			},
		);
	});

	// statusCommand tests are skipped because they require SKYBOX_HOME to be set
	// before any module imports, which is not possible with bun's import hoisting.
	// These should be tested as integration tests instead.
});
