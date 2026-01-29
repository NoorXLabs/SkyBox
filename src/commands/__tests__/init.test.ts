// src/commands/__tests__/init.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "../../lib/__tests__/test-utils.ts";
import { saveConfig } from "../../lib/config.ts";

// This tests the individual pieces that init uses
describe("init command integration", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("init");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("creates required directories on save config", async () => {
		const config = {
			editor: "cursor",
			defaults: { sync_mode: "two-way-resolved", ignore: [] },
			remotes: {
				default: { host: "test", user: "root", path: "~/code" },
			},
			projects: {},
		};

		saveConfig(config);

		expect(existsSync(ctx.testDir)).toBe(true);
		expect(existsSync(join(ctx.testDir, "config.yaml"))).toBe(true);
	});

	test("config file contains expected content", async () => {
		const config = {
			editor: "vim",
			defaults: { sync_mode: "two-way-resolved", ignore: ["node_modules"] },
			remotes: {
				myserver: {
					host: "myserver",
					user: "root",
					path: "~/projects",
				},
			},
			projects: {},
		};

		saveConfig(config);

		const content = readFileSync(join(ctx.testDir, "config.yaml"), "utf-8");
		expect(content).toContain("myserver");
		expect(content).toContain("~/projects");
		expect(content).toContain("vim");
	});
});
