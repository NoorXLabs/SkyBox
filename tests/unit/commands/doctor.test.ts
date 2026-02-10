// tests/unit/commands/doctor.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkEditor } from "@commands/doctor.ts";
import {
	createTestContext,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

describe("doctor command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("doctor");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("should detect missing config", async () => {
		const { configExists } = await import("@lib/config.ts");
		expect(configExists()).toBe(false);
	});

	test("should detect valid config", async () => {
		// Create minimal config
		writeFileSync(
			join(ctx.testDir, "config.yaml"),
			`editor: cursor
defaults:
  sync_mode: two-way-resolved
  ignore: []
remotes:
  work:
    host: work-server
    path: ~/code
projects: {}
`,
		);

		const { configExists, loadConfig } = await import("@lib/config.ts");
		expect(configExists()).toBe(true);

		const config = loadConfig();
		expect(config).not.toBeNull();
		expect(Object.keys(config?.remotes || {})).toHaveLength(1);
	});

	test("should throw on invalid YAML config", async () => {
		// Create invalid YAML
		writeFileSync(join(ctx.testDir, "config.yaml"), "invalid: yaml: syntax:");

		const { loadConfig } = await import("@lib/config.ts");
		expect(() => loadConfig()).toThrow();
	});

	test("checkEditor returns pass when editor command is available", async () => {
		writeFileSync(
			join(ctx.testDir, "config.yaml"),
			`editor: zed
defaults:
  sync_mode: two-way-resolved
  ignore: []
remotes: {}
projects: {}
`,
		);

		const result = await checkEditor(async () => ({
			status: "available",
			command: "zed",
		}));

		expect(result.status).toBe("pass");
		expect(result.message).toContain("'zed' is available");
	});

	test("checkEditor warns when fallback app will be used", async () => {
		writeFileSync(
			join(ctx.testDir, "config.yaml"),
			`editor: zed
defaults:
  sync_mode: two-way-resolved
  ignore: []
remotes: {}
projects: {}
`,
		);

		const result = await checkEditor(async () => ({
			status: "fallback",
			command: "zed",
			fallbackApp: "Zed",
		}));

		expect(result.status).toBe("warn");
		expect(result.message).toContain("macOS fallback app 'Zed'");
	});

	test("checkEditor warns when editor command is missing", async () => {
		writeFileSync(
			join(ctx.testDir, "config.yaml"),
			`editor: unknown-editor
defaults:
  sync_mode: two-way-resolved
  ignore: []
remotes: {}
projects: {}
`,
		);

		const result = await checkEditor(async () => ({
			status: "missing",
			command: "unknown-editor",
		}));

		expect(result.status).toBe("warn");
		expect(result.message).toContain("was not found");
	});
});
