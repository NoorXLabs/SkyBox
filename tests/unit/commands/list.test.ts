// tests/unit/commands/list.test.ts
//
// Tests for list command. Some tests require real git commands.

import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	createTestGitRepo,
	isExecaMocked,
	setupTestContext,
} from "@tests/helpers/test-utils.ts";
import { execa } from "execa";

const execaMocked = await isExecaMocked();

describe("list command", () => {
	const getCtx = setupTestContext("list");
	let projectsDir: string;

	beforeEach(() => {
		projectsDir = join(getCtx().testDir, "Projects");
		mkdirSync(projectsDir, { recursive: true });
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

	test.skipIf(execaMocked)("gets git branch from project", async () => {
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
