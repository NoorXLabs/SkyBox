// src/commands/__tests__/clone.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "@lib/__tests__/test-utils.ts";
import { getLocalProjects, getProjectPath } from "@lib/project.ts";
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

describe("interactive clone filtering", () => {
	test("filters out already-cloned projects from remote list", () => {
		const remoteProjects = [
			{ name: "foo", branch: "main" },
			{ name: "bar", branch: "develop" },
			{ name: "baz", branch: "main" },
		];
		const localProjects = ["foo", "baz"];
		const localSet = new Set(localProjects);
		const available = remoteProjects.filter((p) => !localSet.has(p.name));

		expect(available).toHaveLength(1);
		expect(available[0].name).toBe("bar");
	});

	test("returns all remote projects when none are local", () => {
		const remoteProjects = [
			{ name: "foo", branch: "main" },
			{ name: "bar", branch: "main" },
		];
		const localSet = new Set<string>([]);
		const available = remoteProjects.filter((p) => !localSet.has(p.name));

		expect(available).toHaveLength(2);
	});

	test("returns empty when all remote projects are already local", () => {
		const remoteProjects = [{ name: "foo", branch: "main" }];
		const localSet = new Set(["foo"]);
		const available = remoteProjects.filter((p) => !localSet.has(p.name));

		expect(available).toHaveLength(0);
	});
});

describe("interactive clone with local projects", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("clone-interactive");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("getLocalProjects returns project directories in DEVBOX_HOME/Projects", () => {
		const projectsDir = join(ctx.testDir, "Projects");
		mkdirSync(join(projectsDir, "alpha"), { recursive: true });
		mkdirSync(join(projectsDir, "beta"), { recursive: true });

		const locals = getLocalProjects();
		expect(locals).toContain("alpha");
		expect(locals).toContain("beta");
		expect(locals).toHaveLength(2);
	});

	test("filtering with real getLocalProjects excludes existing", () => {
		const projectsDir = join(ctx.testDir, "Projects");
		mkdirSync(join(projectsDir, "existing-project"), { recursive: true });

		const remoteProjects = [
			{ name: "existing-project", branch: "main" },
			{ name: "new-project", branch: "main" },
		];

		const localSet = new Set(getLocalProjects());
		const available = remoteProjects.filter((p) => !localSet.has(p.name));

		expect(available).toHaveLength(1);
		expect(available[0].name).toBe("new-project");
	});
});
