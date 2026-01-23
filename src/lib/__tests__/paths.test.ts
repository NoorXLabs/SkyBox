// src/lib/__tests__/paths.test.ts
import { afterEach, describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { BIN_DIR, CONFIG_PATH, MUTAGEN_PATH, PROJECTS_DIR } from "../paths.ts";

describe("paths", () => {
	const originalEnv = process.env.DEVBOX_HOME;

	afterEach(() => {
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("uses default home when DEVBOX_HOME not set", () => {
		delete process.env.DEVBOX_HOME;
		// Re-import to get fresh values
		const paths = require("../paths.ts");
		expect(paths.DEVBOX_HOME).toBe(`${homedir()}/.devbox`);
	});

	test("CONFIG_PATH is under DEVBOX_HOME", () => {
		expect(CONFIG_PATH).toContain("config.yaml");
	});

	test("PROJECTS_DIR is under DEVBOX_HOME", () => {
		expect(PROJECTS_DIR).toContain("Projects");
	});

	test("BIN_DIR is under DEVBOX_HOME", () => {
		expect(BIN_DIR).toContain("bin");
	});

	test("MUTAGEN_PATH is under BIN_DIR", () => {
		expect(MUTAGEN_PATH).toContain("mutagen");
	});
});
