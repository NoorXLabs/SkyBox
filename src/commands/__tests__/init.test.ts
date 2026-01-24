// src/commands/__tests__/init.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// This tests the individual pieces that init uses
describe("init command integration", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-init-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		delete process.env.DEVBOX_HOME;
	});

	test("creates required directories on save config", async () => {
		const { saveConfig } = await import("../../lib/config.ts");

		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {
				default: { host: "test", user: "root", path: "~/code", key: null },
			},
			projects: {},
		};

		saveConfig(config);

		expect(existsSync(testDir)).toBe(true);
		expect(existsSync(join(testDir, "config.yaml"))).toBe(true);
	});

	test("config file contains expected content", async () => {
		const { saveConfig } = await import("../../lib/config.ts");

		const config = {
			editor: "vim",
			defaults: { sync_mode: "two-way-resolved", ignore: ["node_modules"] },
			remotes: {
				myserver: { host: "myserver", user: "root", path: "~/projects", key: null },
			},
			projects: {},
		};

		saveConfig(config);

		const content = readFileSync(join(testDir, "config.yaml"), "utf-8");
		expect(content).toContain("myserver");
		expect(content).toContain("~/projects");
		expect(content).toContain("vim");
	});
});
