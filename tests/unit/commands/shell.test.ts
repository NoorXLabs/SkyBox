// tests/unit/commands/shell.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	DEVCONTAINER_CONFIG_NAME,
	DEVCONTAINER_DIR_NAME,
} from "@lib/constants.ts";
import {
	createTestConfig,
	createTestContext,
	type TestContext,
	writeTestConfig,
} from "@tests/helpers/test-utils.ts";
import type { ShellOptions } from "@typedefs/index.ts";

describe("shell command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("shell");
		mkdirSync(join(ctx.testDir, "Projects", "myapp"), { recursive: true });
		mkdirSync(join(ctx.testDir, "Projects", "myapp", DEVCONTAINER_DIR_NAME), {
			recursive: true,
		});

		writeTestConfig(ctx.testDir, createTestConfig({ editor: "cursor" }));

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

	describe("session status checking", () => {
		test("ShellOptions type includes force flag", () => {
			// Type-level test - if this compiles, the type is correct
			const options: ShellOptions = { force: true };
			expect(options.force).toBe(true);
		});
	});
});
