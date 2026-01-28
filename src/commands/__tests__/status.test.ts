// src/commands/__tests__/status.test.ts
//
// NOTE: These tests require real execa (git, du commands) and CANNOT be run
// together with test files that mock execa at module level. Bun's mock.module()
// affects all modules in the same test process, causing these tests to fail.
//
// RUN SEPARATELY: bun test src/commands/__tests__/status.test.ts
//
// When run as part of the full test suite, git/du dependent tests are skipped.
// Set STATUS_TEST_ISOLATED=1 to run them:
//   STATUS_TEST_ISOLATED=1 bun test src/commands/__tests__/status.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa as realExeca } from "execa";

// Import only the helper functions that don't depend on PROJECTS_DIR
import { getDiskUsage, getGitInfo, getLastActive } from "../status.ts";

// These tests require real execa but when run in full suite, execa may be mocked
// by other test files (shell-docker-isolated.test.ts). Skip unless explicitly enabled.
const SKIP_EXECA_TESTS = !process.env.STATUS_TEST_ISOLATED;

describe("status command helpers", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-status-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	describe("getGitInfo", () => {
		test.skipIf(SKIP_EXECA_TESTS)(
			"returns null for non-git directory",
			async () => {
				const result = await getGitInfo(testDir);
				expect(result).toBeNull();
			},
		);

		test.skipIf(SKIP_EXECA_TESTS)(
			"returns branch and clean status for git repo",
			async () => {
				// Initialize git repo
				await realExeca("git", ["init"], { cwd: testDir });
				await realExeca("git", ["config", "user.email", "test@test.com"], {
					cwd: testDir,
				});
				await realExeca("git", ["config", "user.name", "Test"], {
					cwd: testDir,
				});
				writeFileSync(join(testDir, "README.md"), "# Test");
				await realExeca("git", ["add", "."], { cwd: testDir });
				await realExeca("git", ["commit", "-m", "init"], { cwd: testDir });

				const result = await getGitInfo(testDir);

				expect(result).not.toBeNull();
				expect(result?.branch).toBeTruthy();
				expect(result?.status).toBe("clean");
				expect(result?.ahead).toBe(0);
				expect(result?.behind).toBe(0);
			},
		);

		test.skipIf(SKIP_EXECA_TESTS)(
			"returns dirty status for uncommitted changes",
			async () => {
				// Initialize git repo
				await realExeca("git", ["init"], { cwd: testDir });
				await realExeca("git", ["config", "user.email", "test@test.com"], {
					cwd: testDir,
				});
				await realExeca("git", ["config", "user.name", "Test"], {
					cwd: testDir,
				});
				writeFileSync(join(testDir, "README.md"), "# Test");
				await realExeca("git", ["add", "."], { cwd: testDir });
				await realExeca("git", ["commit", "-m", "init"], { cwd: testDir });

				// Make uncommitted change
				writeFileSync(join(testDir, "new.txt"), "new file");

				const result = await getGitInfo(testDir);

				expect(result).not.toBeNull();
				expect(result?.status).toBe("dirty");
			},
		);
	});

	describe("getDiskUsage", () => {
		test.skipIf(SKIP_EXECA_TESTS)(
			"returns size string for directory",
			async () => {
				// Create some files
				writeFileSync(join(testDir, "file1.txt"), "hello world");
				writeFileSync(join(testDir, "file2.txt"), "more content");

				const result = await getDiskUsage(testDir);

				// Should return something like "4.0K" or "8.0K" depending on filesystem
				expect(result).toMatch(/^\d+(\.\d+)?[KMGT]?$/i);
			},
		);

		test.skipIf(SKIP_EXECA_TESTS)("returns 'unknown' on error", async () => {
			const result = await getDiskUsage(
				"/nonexistent/path/that/does/not/exist",
			);
			expect(result).toBe("unknown");
		});
	});

	describe("getLastActive", () => {
		test.skipIf(SKIP_EXECA_TESTS)(
			"returns date from git log if available",
			async () => {
				// Initialize git repo with a commit
				await realExeca("git", ["init"], { cwd: testDir });
				await realExeca("git", ["config", "user.email", "test@test.com"], {
					cwd: testDir,
				});
				await realExeca("git", ["config", "user.name", "Test"], {
					cwd: testDir,
				});
				writeFileSync(join(testDir, "README.md"), "# Test");
				await realExeca("git", ["add", "."], { cwd: testDir });
				await realExeca("git", ["commit", "-m", "init"], { cwd: testDir });

				const result = await getLastActive(testDir);

				expect(result).toBeInstanceOf(Date);
				// Should be recent (within last minute)
				expect(Date.now() - (result?.getTime() ?? 0)).toBeLessThan(60000);
			},
		);

		test.skipIf(SKIP_EXECA_TESTS)(
			"returns directory mtime for non-git directory",
			async () => {
				writeFileSync(join(testDir, "file.txt"), "content");

				const result = await getLastActive(testDir);

				expect(result).toBeInstanceOf(Date);
			},
		);
	});

	// statusCommand tests are skipped because they require DEVBOX_HOME to be set
	// before any module imports, which is not possible with bun's import hoisting.
	// These should be tested as integration tests instead.
});
