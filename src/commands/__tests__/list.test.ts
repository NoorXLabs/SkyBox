// src/commands/__tests__/list.test.ts
//
// NOTE: Some tests require real execa (git commands).
// They may fail if run after test files that mock execa at module level.
// In that case, run this file separately: bun test src/commands/__tests__/list.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa as realExeca } from "execa";

// Check if execa is mocked (returns undefined or wrong type)
const execaIsMocked = async (): Promise<boolean> => {
	try {
		const result = await realExeca("echo", ["test"]);
		return typeof result?.stdout !== "string";
	} catch {
		return true;
	}
};

describe("list command", () => {
	let testDir: string;
	let projectsDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-list-test-${Date.now()}`);
		projectsDir = join(testDir, "Projects");
		mkdirSync(projectsDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("returns empty array when projects dir is empty", async () => {
		const { readdirSync } = await import("node:fs");
		const entries = readdirSync(projectsDir);
		expect(entries).toEqual([]);
	});

	test("finds project directories", async () => {
		// Create a fake project
		const projectPath = join(projectsDir, "myapp");
		mkdirSync(projectPath);

		const { readdirSync } = await import("node:fs");
		const entries = readdirSync(projectsDir);
		expect(entries).toContain("myapp");
	});

	test("gets git branch from project", async () => {
		if (await execaIsMocked()) return; // Skip if execa mocked

		// Create a fake project with git
		const projectPath = join(projectsDir, "myapp");
		mkdirSync(projectPath);

		// Initialize git repo
		await realExeca("git", ["init"], { cwd: projectPath });
		await realExeca("git", ["config", "user.email", "test@test.com"], {
			cwd: projectPath,
		});
		await realExeca("git", ["config", "user.name", "Test"], {
			cwd: projectPath,
		});

		// Create initial commit to establish branch
		writeFileSync(join(projectPath, "README.md"), "# Test");
		await realExeca("git", ["add", "."], { cwd: projectPath });
		await realExeca("git", ["commit", "-m", "init"], { cwd: projectPath });

		// Get branch
		const result = await realExeca("git", [
			"-C",
			projectPath,
			"branch",
			"--show-current",
		]);
		expect(result.stdout.trim()).toBeTruthy();
	});
});
