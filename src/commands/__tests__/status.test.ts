// src/commands/__tests__/status.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";

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
			const { getGitInfo } = await import("../status.ts");
			const result = await getGitInfo(testDir);
			expect(result).toBeNull();
		});

		test("returns branch and clean status for git repo", async () => {
			// Initialize git repo
			await execa("git", ["init"], { cwd: testDir });
			await execa("git", ["config", "user.email", "test@test.com"], {
				cwd: testDir,
			});
			await execa("git", ["config", "user.name", "Test"], { cwd: testDir });
			writeFileSync(join(testDir, "README.md"), "# Test");
			await execa("git", ["add", "."], { cwd: testDir });
			await execa("git", ["commit", "-m", "init"], { cwd: testDir });

			const { getGitInfo } = await import("../status.ts");
			const result = await getGitInfo(testDir);

			expect(result).not.toBeNull();
			expect(result?.branch).toBeTruthy();
			expect(result?.status).toBe("clean");
			expect(result?.ahead).toBe(0);
			expect(result?.behind).toBe(0);
		});

		test("returns dirty status for uncommitted changes", async () => {
			// Initialize git repo
			await execa("git", ["init"], { cwd: testDir });
			await execa("git", ["config", "user.email", "test@test.com"], {
				cwd: testDir,
			});
			await execa("git", ["config", "user.name", "Test"], { cwd: testDir });
			writeFileSync(join(testDir, "README.md"), "# Test");
			await execa("git", ["add", "."], { cwd: testDir });
			await execa("git", ["commit", "-m", "init"], { cwd: testDir });

			// Make uncommitted change
			writeFileSync(join(testDir, "new.txt"), "new file");

			const { getGitInfo } = await import("../status.ts");
			const result = await getGitInfo(testDir);

			expect(result).not.toBeNull();
			expect(result?.status).toBe("dirty");
		});
	});

	describe("getDiskUsage", () => {
		test("returns size string for directory", async () => {
			// Create some files
			writeFileSync(join(testDir, "file1.txt"), "hello world");
			writeFileSync(join(testDir, "file2.txt"), "more content");

			const { getDiskUsage } = await import("../status.ts");
			const result = await getDiskUsage(testDir);

			// Should return something like "4.0K" or "8.0K" depending on filesystem
			expect(result).toMatch(/^\d+(\.\d+)?[KMGT]?$/i);
		});

		test("returns 'unknown' on error", async () => {
			const { getDiskUsage } = await import("../status.ts");
			const result = await getDiskUsage(
				"/nonexistent/path/that/does/not/exist",
			);
			expect(result).toBe("unknown");
		});
	});

	describe("getLastActive", () => {
		test("returns date from git log if available", async () => {
			// Initialize git repo with a commit
			await execa("git", ["init"], { cwd: testDir });
			await execa("git", ["config", "user.email", "test@test.com"], {
				cwd: testDir,
			});
			await execa("git", ["config", "user.name", "Test"], { cwd: testDir });
			writeFileSync(join(testDir, "README.md"), "# Test");
			await execa("git", ["add", "."], { cwd: testDir });
			await execa("git", ["commit", "-m", "init"], { cwd: testDir });

			const { getLastActive } = await import("../status.ts");
			const result = await getLastActive(testDir);

			expect(result).toBeInstanceOf(Date);
			// Should be recent (within last minute)
			expect(Date.now() - (result?.getTime() ?? 0)).toBeLessThan(60000);
		});

		test("returns directory mtime for non-git directory", async () => {
			writeFileSync(join(testDir, "file.txt"), "content");

			const { getLastActive } = await import("../status.ts");
			const result = await getLastActive(testDir);

			expect(result).toBeInstanceOf(Date);
		});
	});

	describe("statusCommand", () => {
		let configDir: string;

		// Helper to clear module cache for fresh imports
		const clearModuleCache = () => {
			// Clear require.cache for all devbox-related modules
			for (const key of Object.keys(require.cache)) {
				if (
					key.includes("devbox") ||
					key.includes("status") ||
					key.includes("paths") ||
					key.includes("config")
				) {
					delete require.cache[key];
				}
			}
		};

		beforeEach(() => {
			configDir = join(testDir, ".devbox");
			const projectsDir = join(configDir, "Projects");
			mkdirSync(projectsDir, { recursive: true });
			process.env.DEVBOX_HOME = configDir;

			// Clear module cache so paths.ts picks up new DEVBOX_HOME
			clearModuleCache();

			// Create minimal config
			const configPath = join(configDir, "config.yaml");
			writeFileSync(
				configPath,
				`
remote:
  host: testhost
  base_path: ~/code
editor: code
defaults:
  sync_mode: two-way-resolved
  ignore: []
projects: {}
`,
			);
		});

		test("shows empty message when no projects", async () => {
			// Capture console output
			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args) => logs.push(args.join(" "));

			const { statusCommand } = await import("../status.ts");
			await statusCommand();

			console.log = originalLog;

			expect(logs.some((l) => l.includes("No projects found"))).toBe(true);
		});

		test("shows project in overview when project exists", async () => {
			// Create a project directory
			const projectsDir = join(configDir, "Projects");
			const projectPath = join(projectsDir, "myapp");
			mkdirSync(projectPath);

			// Capture console output
			const logs: string[] = [];
			const originalLog = console.log;
			console.log = (...args) => logs.push(args.join(" "));

			const { statusCommand } = await import("../status.ts");
			await statusCommand();

			console.log = originalLog;

			expect(logs.some((l) => l.includes("myapp"))).toBe(true);
		});
	});
});
