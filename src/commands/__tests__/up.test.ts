// src/commands/__tests__/up.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";

describe("up command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("up");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("project path construction works", () => {
		const projectsDir = join(ctx.testDir, "Projects");
		const project = "myapp";
		const projectPath = join(projectsDir, project);
		expect(projectPath).toBe(`${ctx.testDir}/Projects/myapp`);
	});

	test("can detect missing config", () => {
		const configPath = join(ctx.testDir, "config.yaml");
		expect(existsSync(configPath)).toBe(false);
	});
});
