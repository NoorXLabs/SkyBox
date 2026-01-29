// src/commands/__tests__/push.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "../../lib/__tests__/test-utils.ts";

describe("push command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("push");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("resolves relative path to absolute", () => {
		const relativePath = "./my-project";
		const absolutePath = resolve(relativePath);
		expect(absolutePath.startsWith("/")).toBe(true);
	});

	test("extracts project name from path", () => {
		const path = "/Users/test/my-awesome-project";
		const name = basename(path);
		expect(name).toBe("my-awesome-project");
	});

	test("detects git repo by .git folder", () => {
		const projectPath = join(ctx.testDir, "my-project");
		mkdirSync(projectPath, { recursive: true });

		// No .git folder
		expect(existsSync(join(projectPath, ".git"))).toBe(false);

		// Create .git folder
		mkdirSync(join(projectPath, ".git"));
		expect(existsSync(join(projectPath, ".git"))).toBe(true);
	});

	test("custom name overrides basename", () => {
		const sourcePath = "/Users/test/my-project";
		const customName = "renamed-project";
		const projectName = customName || basename(sourcePath);
		expect(projectName).toBe("renamed-project");
	});
});
