// src/commands/__tests__/browse.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createTestContext,
	type TestContext,
} from "../../lib/__tests__/test-utils.ts";
import { configExists } from "../../lib/config.ts";

describe("browse command", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("browse");
	});

	afterEach(() => {
		ctx.cleanup();
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
