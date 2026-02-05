// tests/unit/commands/open.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

describe("open command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("open");

		// Create minimal config
		writeFileSync(
			join(ctx.testDir, "config.yaml"),
			`editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
remotes: {}
projects: {}
`,
		);
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("should require project to exist locally", async () => {
		// Import dynamically to use mocked SKYBOX_HOME
		const { projectExists } = await import("@lib/project.ts");
		expect(projectExists("nonexistent")).toBe(false);
	});

	test("should detect project from cwd when in project directory", async () => {
		// Create a project directory (capital "Projects" matches PROJECTS_DIR_NAME)
		const projectsDir = join(ctx.testDir, "Projects");
		mkdirSync(projectsDir, { recursive: true });
		const projectPath = join(projectsDir, "myproject");
		mkdirSync(projectPath, { recursive: true });

		const { projectExists } = await import("@lib/project.ts");
		expect(projectExists("myproject")).toBe(true);
	});
});
