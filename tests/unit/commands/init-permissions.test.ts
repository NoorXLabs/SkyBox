import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { saveConfig } from "@lib/config.ts";
import { getConfigPath } from "@lib/paths.ts";
import { createTestConfig } from "@tests/helpers/test-utils.ts";

describe("init directory permissions", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		// Point SKYBOX_HOME to a non-existent directory so saveConfig creates it fresh
		testDir = join(tmpdir(), `skybox-init-perms-test-${Date.now()}`);
		originalEnv = process.env.SKYBOX_HOME;
		process.env.SKYBOX_HOME = testDir;
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv) {
			process.env.SKYBOX_HOME = originalEnv;
		} else {
			delete process.env.SKYBOX_HOME;
		}
	});

	test("saveConfig creates config directory with mode 0o700", () => {
		const config = createTestConfig();
		saveConfig(config);

		const configDir = dirname(getConfigPath());
		const stats = statSync(configDir);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o700);
	});

	test("saveConfig creates config file with mode 0o600", () => {
		const config = createTestConfig();
		saveConfig(config);

		const configPath = getConfigPath();
		const stats = statSync(configPath);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o600);
	});
});
