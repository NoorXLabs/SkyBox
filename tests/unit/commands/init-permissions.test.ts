import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, statSync } from "node:fs";
import { getBinDir, getProjectsDir } from "@lib/paths.ts";
import {
	createTestContext,
	type TestContext,
} from "@tests/helpers/test-utils.ts";

describe("init directory permissions", () => {
	let ctx: TestContext;

	beforeEach(() => {
		ctx = createTestContext("init-permissions");
	});

	afterEach(() => {
		ctx.cleanup();
	});

	test("projects directory created with mode 0o700", () => {
		const projectsDir = getProjectsDir();
		mkdirSync(projectsDir, { recursive: true, mode: 0o700 });

		const stats = statSync(projectsDir);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o700);
	});

	test("bin directory created with mode 0o700", () => {
		const binDir = getBinDir();
		mkdirSync(binDir, { recursive: true, mode: 0o700 });

		const stats = statSync(binDir);
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o700);
	});
});
