// src/lib/project.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("project resolution", () => {
	let testDir: string;
	let originalCwd: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-project-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalCwd = process.cwd();
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("resolveProjectFromCwd returns null when not in projects dir", async () => {
		const { resolveProjectFromCwd } = await import("./project.ts");
		const result = resolveProjectFromCwd();
		expect(result).toBeNull();
	});

	test("resolveProjectFromCwd returns project name when in project dir", async () => {
		const projectsDir = join(testDir, "projects");
		const projectDir = join(projectsDir, "myapp");
		mkdirSync(projectDir, { recursive: true });
		process.chdir(projectDir);

		const { resolveProjectFromCwd } = await import("./project.ts");
		const result = resolveProjectFromCwd();
		expect(result).toBe("myapp");
	});

	test("getLocalProjects returns empty array when no projects", async () => {
		const { getLocalProjects } = await import("./project.ts");
		const projects = getLocalProjects();
		expect(projects).toEqual([]);
	});

	test("getLocalProjects returns project names", async () => {
		const projectsDir = join(testDir, "projects");
		mkdirSync(join(projectsDir, "app1"), { recursive: true });
		mkdirSync(join(projectsDir, "app2"), { recursive: true });

		const { getLocalProjects } = await import("./project.ts");
		const projects = getLocalProjects();
		expect(projects).toContain("app1");
		expect(projects).toContain("app2");
	});
});
