import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("hooks", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-hooks-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("HOOK_EVENTS should list all valid hook event names", async () => {
		const { HOOK_EVENTS } = await import("@lib/constants.ts");
		expect(HOOK_EVENTS).toContain("pre-up");
		expect(HOOK_EVENTS).toContain("post-up");
		expect(HOOK_EVENTS).toContain("pre-down");
		expect(HOOK_EVENTS).toContain("post-down");
	});
});
