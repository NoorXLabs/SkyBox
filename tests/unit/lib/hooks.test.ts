import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HOOK_EVENTS } from "@lib/constants.ts";
import { runHooks } from "@lib/hooks.ts";

describe("hooks", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `skybox-hooks-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("HOOK_EVENTS should list all valid hook event names", () => {
		expect(HOOK_EVENTS).toContain("pre-up");
		expect(HOOK_EVENTS).toContain("post-up");
		expect(HOOK_EVENTS).toContain("pre-down");
		expect(HOOK_EVENTS).toContain("post-down");
	});

	test("runHooks should execute a simple shell command", async () => {
		const markerFile = join(testDir, "hook-ran.txt");
		const hooks: Record<string, string> = {
			"post-up": `touch ${markerFile}`,
		};
		await runHooks("post-up", hooks, testDir);
		expect(existsSync(markerFile)).toBe(true);
	});

	test("runHooks should skip if no hook defined for event", async () => {
		await runHooks("pre-up", {}, testDir);
	});

	test("runHooks should handle array of hook entries", async () => {
		const markerFile1 = join(testDir, "hook1.txt");
		const markerFile2 = join(testDir, "hook2.txt");
		const hooks = {
			"pre-down": [
				{ command: `touch ${markerFile1}` },
				{ command: `touch ${markerFile2}` },
			],
		};
		await runHooks("pre-down", hooks, testDir);
		expect(existsSync(markerFile1)).toBe(true);
		expect(existsSync(markerFile2)).toBe(true);
	});

	test("runHooks should report failure without throwing", async () => {
		const hooks = { "pre-up": "exit 1" };
		const result = await runHooks("pre-up", hooks, testDir);
		expect(result.success).toBe(false);
	});
});
