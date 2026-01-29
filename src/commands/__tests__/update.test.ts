import { describe, expect, test } from "bun:test";

describe("update command", () => {
	test("module exports updateCommand function", async () => {
		const mod = await import("../update.ts");
		expect(typeof mod.updateCommand).toBe("function");
	});
});
