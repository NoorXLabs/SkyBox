import { describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { saveConfig } from "@lib/config.ts";
import { getConfigPath } from "@lib/paths.ts";
import {
	createTestConfig,
	setupTestContext,
} from "@tests/helpers/test-utils.ts";

describe("init directory permissions", () => {
	const getCtx = setupTestContext("init-permissions");

	const useFreshHome = (): string => {
		const freshHome = join(getCtx().testDir, "fresh-home");
		process.env.SKYBOX_HOME = freshHome;
		return freshHome;
	};

	test("saveConfig creates config directory with mode 0o700", () => {
		const freshHome = useFreshHome();
		const config = createTestConfig();
		saveConfig(config);

		const configDir = dirname(join(freshHome, "config.yaml"));
		const stats = statSync(configDir);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o700);
	});

	test("saveConfig creates config file with mode 0o600", () => {
		useFreshHome();
		const config = createTestConfig();
		saveConfig(config);

		const configPath = getConfigPath();
		const stats = statSync(configPath);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o600);
	});
});
