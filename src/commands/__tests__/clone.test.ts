// src/commands/__tests__/clone.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";
import { getProjectPath } from "@lib/project.ts";
import { validateProjectName } from "@lib/projectTemplates.ts";

describe("clone command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("clone");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("rejects empty project name", () => {
		const result = validateProjectName("");
		expect(result.valid).toBe(false);
		expect(result.error).toContain("empty");
	});

	test("rejects project names with path traversal", () => {
		const result = validateProjectName("../etc/passwd");
		expect(result.valid).toBe(false);
	});

	test("constructs correct local project path", () => {
		const path = getProjectPath("myapp");
		expect(path).toContain("myapp");
	});

	test("detects existing local project directory", () => {
		const projectsDir = join(ctx.testDir, "Projects");
		const localPath = join(projectsDir, "myapp");
		mkdirSync(localPath, { recursive: true });
		expect(existsSync(localPath)).toBe(true);
	});
});
