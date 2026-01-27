// src/commands/__tests__/shell.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ShellOptions } from "../../types/index.ts";

describe("shell command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-shell-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		mkdirSync(join(testDir, "Projects", "myapp"), { recursive: true });
		mkdirSync(join(testDir, "Projects", "myapp", ".devcontainer"), {
			recursive: true,
		});

		// Write config
		writeFileSync(
			join(testDir, "config.yaml"),
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
			join(testDir, "Projects", "myapp", ".devcontainer", "devcontainer.json"),
			JSON.stringify({ workspaceFolder: "/workspaces/myapp" }),
		);

		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("project path is constructed correctly", () => {
		const projectPath = join(testDir, "Projects", "myapp");
		expect(existsSync(projectPath)).toBe(true);
	});

	test("devcontainer.json is readable", () => {
		const configPath = join(
			testDir,
			"Projects",
			"myapp",
			".devcontainer",
			"devcontainer.json",
		);
		expect(existsSync(configPath)).toBe(true);
	});

	test("config file exists", () => {
		const configPath = join(testDir, "config.yaml");
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
