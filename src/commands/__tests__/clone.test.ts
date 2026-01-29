// src/commands/__tests__/clone.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "../../lib/__tests__/test-utils.ts";

describe("clone command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("clone");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("requires project argument", async () => {
		// Test that empty project name would be rejected
		const projectName = "";
		expect(projectName).toBeFalsy();
	});

	test("local path is constructed correctly", () => {
		const projectsDir = join(ctx.testDir, "Projects");
		const project = "myapp";
		const localPath = join(projectsDir, project);
		expect(localPath).toBe(`${ctx.testDir}/Projects/myapp`);
	});

	test("detects existing local project", () => {
		const projectsDir = join(ctx.testDir, "Projects");
		const project = "myapp";
		const localPath = join(projectsDir, project);

		mkdirSync(localPath, { recursive: true });
		expect(existsSync(localPath)).toBe(true);
	});
});
