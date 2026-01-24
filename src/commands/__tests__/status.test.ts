// src/commands/__tests__/status.test.ts
//
// NOTE: These helper function tests require real execa (git, du commands).
// They may fail if run after test files that mock execa at module level
// (e.g., shell-docker-isolated.test.ts). In that case, run this file separately:
//   bun test src/commands/__tests__/status.test.ts
//
// The statusCommand tests require DEVBOX_HOME to be set before module imports,
// which is not possible with bun's import hoisting. Those should be integration tests.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa as realExeca } from "execa";

// Import only the helper functions that don't depend on PROJECTS_DIR
import { getDiskUsage, getGitInfo, getLastActive } from "../status.ts";

// Check if execa is mocked (returns undefined or wrong type)
const execaIsMocked = async (): Promise<boolean> => {
	try {
		const result = await realExeca("echo", ["test"]);
		return typeof result?.stdout !== "string";
	} catch {
		return true;
	}
};

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
		test("returns null for non-git directory", async () => {
			if (await execaIsMocked()) return; // Skip if execa mocked
			const result = await getGitInfo(testDir);
			expect(result).toBeNull();
		});

		test("returns branch and clean status for git repo", async () => {
			if (await execaIsMocked()) return; // Skip if execa mocked
			// Initialize git repo
			await realExeca("git", ["init"], { cwd: testDir });
			await realExeca("git", ["config", "user.email", "test@test.com"], {
				cwd: testDir,
			});
			await realExeca("git", ["config", "user.name", "Test"], { cwd: testDir });
			writeFileSync(join(testDir, "README.md"), "# Test");
			await realExeca("git", ["add", "."], { cwd: testDir });
			await realExeca("git", ["commit", "-m", "init"], { cwd: testDir });

			const result = await getGitInfo(testDir);

			expect(result).not.toBeNull();
			expect(result?.branch).toBeTruthy();
			expect(result?.status).toBe("clean");
			expect(result?.ahead).toBe(0);
			expect(result?.behind).toBe(0);
		});

		test("returns dirty status for uncommitted changes", async () => {
			if (await execaIsMocked()) return; // Skip if execa mocked
			// Initialize git repo
			await realExeca("git", ["init"], { cwd: testDir });
			await realExeca("git", ["config", "user.email", "test@test.com"], {
				cwd: testDir,
			});
			await realExeca("git", ["config", "user.name", "Test"], { cwd: testDir });
			writeFileSync(join(testDir, "README.md"), "# Test");
			await realExeca("git", ["add", "."], { cwd: testDir });
			await realExeca("git", ["commit", "-m", "init"], { cwd: testDir });

			// Make uncommitted change
			writeFileSync(join(testDir, "new.txt"), "new file");

			const result = await getGitInfo(testDir);

			expect(result).not.toBeNull();
			expect(result?.status).toBe("dirty");
		});
	});

	describe("getDiskUsage", () => {
		test("returns size string for directory", async () => {
			if (await execaIsMocked()) return; // Skip if execa mocked
			// Create some files
			writeFileSync(join(testDir, "file1.txt"), "hello world");
			writeFileSync(join(testDir, "file2.txt"), "more content");

			const result = await getDiskUsage(testDir);

			// Should return something like "4.0K" or "8.0K" depending on filesystem
			expect(result).toMatch(/^\d+(\.\d+)?[KMGT]?$/i);
		});

		test("returns 'unknown' on error", async () => {
			if (await execaIsMocked()) return; // Skip if execa mocked
			const result = await getDiskUsage(
				"/nonexistent/path/that/does/not/exist",
			);
			expect(result).toBe("unknown");
		});
	});

	describe("getLastActive", () => {
		test("returns date from git log if available", async () => {
			if (await execaIsMocked()) return; // Skip if execa mocked
			// Initialize git repo with a commit
			await realExeca("git", ["init"], { cwd: testDir });
			await realExeca("git", ["config", "user.email", "test@test.com"], {
				cwd: testDir,
			});
			await realExeca("git", ["config", "user.name", "Test"], { cwd: testDir });
			writeFileSync(join(testDir, "README.md"), "# Test");
			await realExeca("git", ["add", "."], { cwd: testDir });
			await realExeca("git", ["commit", "-m", "init"], { cwd: testDir });

			const result = await getLastActive(testDir);

			expect(result).toBeInstanceOf(Date);
			// Should be recent (within last minute)
			expect(Date.now() - (result?.getTime() ?? 0)).toBeLessThan(60000);
		});

		test("returns directory mtime for non-git directory", async () => {
			if (await execaIsMocked()) return; // Skip if execa mocked
			writeFileSync(join(testDir, "file.txt"), "content");

			const result = await getLastActive(testDir);

			expect(result).toBeInstanceOf(Date);
		});
	});

	// statusCommand tests are skipped because they require DEVBOX_HOME to be set
	// before any module imports, which is not possible with bun's import hoisting.
	// These should be tested as integration tests instead.
});
