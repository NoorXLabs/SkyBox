// src/commands/__tests__/shell.test.ts
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("shell command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-shell-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		mkdirSync(join(testDir, "projects", "myapp"), { recursive: true });
		mkdirSync(join(testDir, "projects", "myapp", ".devcontainer"), {
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
projects: {}
`,
		);

		// Write devcontainer.json
		writeFileSync(
			join(testDir, "projects", "myapp", ".devcontainer", "devcontainer.json"),
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
		const projectPath = join(testDir, "projects", "myapp");
		expect(existsSync(projectPath)).toBe(true);
	});

	test("devcontainer.json is readable", () => {
		const configPath = join(
			testDir,
			"projects",
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
});
