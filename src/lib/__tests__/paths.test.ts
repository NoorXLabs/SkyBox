// src/lib/__tests__/paths.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	getBinDir,
	getConfigPath,
	getDevboxHome,
	getLogsDir,
	getMutagenPath,
	getProjectsDir,
} from "../paths.ts";

describe("paths", () => {
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env.DEVBOX_HOME;
	});

	afterEach(() => {
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("getDevboxHome uses default when DEVBOX_HOME not set", () => {
		delete process.env.DEVBOX_HOME;
		expect(getDevboxHome()).toBe(join(homedir(), ".devbox"));
	});

	test("getDevboxHome uses DEVBOX_HOME when set", () => {
		process.env.DEVBOX_HOME = "/custom/path";
		expect(getDevboxHome()).toBe("/custom/path");
	});

	test("getDevboxHome returns fresh value after env change", () => {
		process.env.DEVBOX_HOME = "/first/path";
		expect(getDevboxHome()).toBe("/first/path");

		process.env.DEVBOX_HOME = "/second/path";
		expect(getDevboxHome()).toBe("/second/path");
	});

	test("getConfigPath returns config.yaml under DEVBOX_HOME", () => {
		process.env.DEVBOX_HOME = "/test/home";
		expect(getConfigPath()).toBe("/test/home/config.yaml");
	});

	test("getProjectsDir returns Projects under DEVBOX_HOME", () => {
		process.env.DEVBOX_HOME = "/test/home";
		expect(getProjectsDir()).toBe("/test/home/Projects");
	});

	test("getBinDir returns bin under DEVBOX_HOME", () => {
		process.env.DEVBOX_HOME = "/test/home";
		expect(getBinDir()).toBe("/test/home/bin");
	});

	test("getMutagenPath returns mutagen under bin", () => {
		process.env.DEVBOX_HOME = "/test/home";
		expect(getMutagenPath()).toBe("/test/home/bin/mutagen");
	});

	test("getLogsDir returns logs under DEVBOX_HOME", () => {
		process.env.DEVBOX_HOME = "/test/home";
		expect(getLogsDir()).toBe("/test/home/logs");
	});

	test("all paths update when DEVBOX_HOME changes", () => {
		process.env.DEVBOX_HOME = "/path/a";
		expect(getDevboxHome()).toBe("/path/a");
		expect(getConfigPath()).toBe("/path/a/config.yaml");
		expect(getProjectsDir()).toBe("/path/a/Projects");
		expect(getBinDir()).toBe("/path/a/bin");

		process.env.DEVBOX_HOME = "/path/b";
		expect(getDevboxHome()).toBe("/path/b");
		expect(getConfigPath()).toBe("/path/b/config.yaml");
		expect(getProjectsDir()).toBe("/path/b/Projects");
		expect(getBinDir()).toBe("/path/b/bin");
	});
});
