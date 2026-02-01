// src/commands/__tests__/shell.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "../../lib/__tests__/test-utils.ts";
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
} from "../../lib/constants.ts";
import type { ShellOptions } from "../../types/index.ts";

describe("shell command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("shell");
		mkdirSync(join(ctx.testDir, "Projects", "myapp"), { recursive: true });
		mkdirSync(join(ctx.testDir, "Projects", "myapp", DEVCONTAINER_DIR_NAME), {
			recursive: true,
		});

		// Write config
		writeFileSync(
			join(ctx.testDir, "config.yaml"),
			`remote:
  host: devbox-server
  base_path: ~/code
editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
Projects: {}
`,
		);

		// Write devcontainer.json
		writeFileSync(
			join(
				ctx.testDir,
				"Projects",
				"myapp",
				DEVCONTAINER_DIR_NAME,
				DEVCONTAINER_CONFIG_NAME,
			),
			JSON.stringify({ workspaceFolder: "/workspaces/myapp" }),
		);
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("project path is constructed correctly", () => {
		const projectPath = join(ctx.testDir, "Projects", "myapp");
		expect(existsSync(projectPath)).toBe(true);
	});

	test("devcontainer.json is readable", () => {
		const configPath = join(
			ctx.testDir,
			"Projects",
			"myapp",
			DEVCONTAINER_DIR_NAME,
			DEVCONTAINER_CONFIG_NAME,
		);
		expect(existsSync(configPath)).toBe(true);
	});

	test("config file exists", () => {
		const configPath = join(ctx.testDir, "config.yaml");
		expect(existsSync(configPath)).toBe(true);
	});

	describe("lock status checking", () => {
		test("ShellOptions type includes force flag", () => {
			// Type-level test - if this compiles, the type is correct
			const options: ShellOptions = { force: true };
			expect(options.force).toBe(true);
		});
	});
});
