// src/commands/__tests__/list.test.ts
//
// Tests for list command. Some tests require real git commands.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	createTestGitRepo,
	isExecaMocked,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";
import { execa } from "execa";

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
		await createTestGitRepo(projectPath);

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
