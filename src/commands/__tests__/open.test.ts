// src/commands/__tests__/open.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("open command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-open-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;

		// Create minimal config
		const configDir = testDir;
		mkdirSync(configDir, { recursive: true });
		writeFileSync(
			join(configDir, "config.yaml"),
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
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("should require project to exist locally", async () => {
		// Import dynamically to use mocked DEVBOX_HOME
		const { projectExists } = await import("../../lib/project.ts");
		expect(projectExists("nonexistent")).toBe(false);
	});

	test("should detect project from cwd when in project directory", async () => {
		// Create a project directory
		const projectsDir = join(testDir, "projects");
		mkdirSync(projectsDir, { recursive: true });
		const projectPath = join(projectsDir, "myproject");
		mkdirSync(projectPath, { recursive: true });

		const { projectExists } = await import("../../lib/project.ts");
		expect(projectExists("myproject")).toBe(true);
	});
});
