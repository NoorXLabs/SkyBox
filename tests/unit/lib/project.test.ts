// tests/unit/lib/project.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getLocalProjects, resolveProjectFromCwd } from "@lib/project.ts";
import {
	createTestContext,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

describe("project resolution", () => {
	let ctx: TestContext;
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();
		ctx = createTestContext("project");
	});

	afterEach(() => {
		process.chdir(originalCwd);
		ctx.cleanup();
	});

	test("resolveProjectFromCwd returns null when not in projects dir", async () => {
		const result = resolveProjectFromCwd();
		expect(result).toBeNull();
	});

	test("resolveProjectFromCwd returns project name when in project dir", async () => {
		const projectsDir = join(ctx.testDir, "Projects");
		const projectDir = join(projectsDir, "myapp");
		mkdirSync(projectDir, { recursive: true });
		process.chdir(projectDir);

		const result = resolveProjectFromCwd();
		expect(result).toBe("myapp");
	});

	test("getLocalProjects returns empty array when no projects", async () => {
		const projects = getLocalProjects();
		expect(projects).toEqual([]);
	});

	test("getLocalProjects returns project names", async () => {
		const projectsDir = join(ctx.testDir, "Projects");
		mkdirSync(join(projectsDir, "app1"), { recursive: true });
		mkdirSync(join(projectsDir, "app2"), { recursive: true });

		const projects = getLocalProjects();
		expect(projects).toContain("app1");
		expect(projects).toContain("app2");
	});
});
