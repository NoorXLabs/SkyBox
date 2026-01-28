// src/commands/__tests__/doctor.test.ts

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("doctor command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-doctor-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });

		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("should detect missing config", async () => {
		const { configExists } = await import("../../lib/config.ts");
		expect(configExists()).toBe(false);
	});

	test("should detect valid config", async () => {
		// Create minimal config
		writeFileSync(
			join(testDir, "config.yaml"),
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
		writeFileSync(join(testDir, "config.yaml"), "invalid: yaml: syntax:");

		const { loadConfig } = await import("../../lib/config.ts");
		expect(() => loadConfig()).toThrow();
	});
});
