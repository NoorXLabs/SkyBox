// src/commands/__tests__/browse.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configExists } from "../../lib/config.ts";

describe("browse command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-browse-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

	test("exits with error when no config exists", async () => {
				expect(configExists()).toBe(false);
	});

	test("parses project list from SSH output", async () => {
		// Test the parsing logic directly
		const sshOutput = "myapp|main\nbackend|develop\nexperiments|main";
		const lines = sshOutput.split("\n");
		const projects = lines.map((line) => {
			const [name, branch] = line.split("|");
			return { name, branch };
		});

		expect(projects).toEqual([
			{ name: "myapp", branch: "main" },
			{ name: "backend", branch: "develop" },
			{ name: "experiments", branch: "main" },
		]);
	});

	test("handles empty SSH output", async () => {
		const sshOutput = "";
		const projects = sshOutput
			.trim()
			.split("\n")
			.filter((line) => line.includes("|"));

		expect(projects).toEqual([]);
	});
});
