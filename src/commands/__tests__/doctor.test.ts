// src/commands/__tests__/doctor.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	createTestContext,
	type TestContext,
} from "../../lib/__tests__/test-utils.ts";

describe("doctor command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("doctor");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("should detect missing config", async () => {
		const { configExists } = await import("../../lib/config.ts");
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

		const { configExists, loadConfig } = await import("../../lib/config.ts");
		expect(configExists()).toBe(true);

		const config = loadConfig();
		expect(config).not.toBeNull();
		expect(Object.keys(config?.remotes || {})).toHaveLength(1);
	});

	test("should throw on invalid YAML config", async () => {
		// Create invalid YAML
		writeFileSync(join(ctx.testDir, "config.yaml"), "invalid: yaml: syntax:");

		const { loadConfig } = await import("../../lib/config.ts");
		expect(() => loadConfig()).toThrow();
	});
});
