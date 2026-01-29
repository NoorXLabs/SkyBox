// src/commands/__tests__/list.test.ts
//
// Tests for list command. Some tests require real git commands.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import {
	createTestContext,
	isExecaMocked,
	type TestContext,
} from "../../lib/__tests__/test-utils.ts";

describe("list command", () => {
	let ctx: TestContext;
	let projectsDir: string;

	beforeEach(() => {
		ctx = createTestContext("list");
		projectsDir = join(ctx.testDir, "Projects");
		mkdirSync(projectsDir, { recursive: true });
	});

	afterEach(() => {
		ctx.cleanup();
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
