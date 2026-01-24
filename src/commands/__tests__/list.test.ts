// src/commands/__tests__/list.test.ts
//
// Tests for list command. Some tests require real git commands.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { isExecaMocked } from "../../lib/__tests__/test-utils.ts";

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
		// Skip if execa is mocked by another test file
		if (await isExecaMocked()) return;

		// Create a fake project with git
		const projectPath = join(projectsDir, "myapp");
		mkdirSync(projectPath);

		// Initialize git repo
		await execa("git", ["init"], { cwd: projectPath });
		await execa("git", ["config", "user.email", "test@test.com"], {
			cwd: projectPath,
		});
		await execa("git", ["config", "user.name", "Test"], { cwd: projectPath });

		// Create initial commit to establish branch
		writeFileSync(join(projectPath, "README.md"), "# Test");
		await execa("git", ["add", "."], { cwd: projectPath });
		await execa("git", ["commit", "-m", "init"], { cwd: projectPath });

		// Get branch
		const result = await execa("git", [
			"-C",
			projectPath,
			"branch",
			"--show-current",
		]);
		expect(result.stdout.trim()).toBeTruthy();
	});
});
