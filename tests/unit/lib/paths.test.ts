// tests/unit/lib/paths.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	getBinDir,
	getConfigPath,
	getLogsDir,
	getMutagenPath,
	getProjectsDir,
	getSkyboxHome,
} from "@lib/paths.ts";

describe("paths", () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.SKYBOX_HOME;
	});

	afterEach(() => {
		if (originalEnv) {
			process.env.SKYBOX_HOME = originalEnv;
		} else {
			delete process.env.SKYBOX_HOME;
		}
	});

	test("getSkyboxHome uses default when SKYBOX_HOME not set", () => {
		delete process.env.SKYBOX_HOME;
		expect(getSkyboxHome()).toBe(join(homedir(), ".skybox"));
	});

	test("getSkyboxHome uses SKYBOX_HOME when set", () => {
		process.env.SKYBOX_HOME = "/custom/path";
		expect(getSkyboxHome()).toBe("/custom/path");
	});

	test("getSkyboxHome returns fresh value after env change", () => {
		process.env.SKYBOX_HOME = "/first/path";
		expect(getSkyboxHome()).toBe("/first/path");

		process.env.SKYBOX_HOME = "/second/path";
		expect(getSkyboxHome()).toBe("/second/path");
	});

	test("getConfigPath returns config.yaml under SKYBOX_HOME", () => {
		process.env.SKYBOX_HOME = "/test/home";
		expect(getConfigPath()).toBe("/test/home/config.yaml");
	});

	test("getProjectsDir returns Projects under SKYBOX_HOME", () => {
		process.env.SKYBOX_HOME = "/test/home";
		expect(getProjectsDir()).toBe("/test/home/Projects");
	});

	test("getBinDir returns bin under SKYBOX_HOME", () => {
		process.env.SKYBOX_HOME = "/test/home";
		expect(getBinDir()).toBe("/test/home/bin");
	});

	test("getMutagenPath returns mutagen under bin", () => {
		process.env.SKYBOX_HOME = "/test/home";
		expect(getMutagenPath()).toBe("/test/home/bin/mutagen");
	});

	test("getLogsDir returns logs under SKYBOX_HOME", () => {
		process.env.SKYBOX_HOME = "/test/home";
		expect(getLogsDir()).toBe("/test/home/logs");
	});

	test("getSkyboxHome returns non-empty string when env unset", () => {
		delete process.env.SKYBOX_HOME;
		const result = getSkyboxHome();
		expect(result).toBeTruthy();
		expect(result.length).toBeGreaterThan(0);
		expect(result).toContain(".skybox");
	});

	test("getConfigPath uses fallback when SKYBOX_HOME unset", () => {
		delete process.env.SKYBOX_HOME;
		const result = getConfigPath();
		expect(result).toContain(".skybox");
		expect(result).toEndWith("config.yaml");
	});

	test("all paths update when SKYBOX_HOME changes", () => {
		process.env.SKYBOX_HOME = "/path/a";
		expect(getSkyboxHome()).toBe("/path/a");
		expect(getConfigPath()).toBe("/path/a/config.yaml");
		expect(getProjectsDir()).toBe("/path/a/Projects");
		expect(getBinDir()).toBe("/path/a/bin");

		process.env.SKYBOX_HOME = "/path/b";
		expect(getSkyboxHome()).toBe("/path/b");
		expect(getConfigPath()).toBe("/path/b/config.yaml");
		expect(getProjectsDir()).toBe("/path/b/Projects");
		expect(getBinDir()).toBe("/path/b/bin");
	});
});
