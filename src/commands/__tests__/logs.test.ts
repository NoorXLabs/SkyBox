import { describe, expect, test } from "bun:test";

describe("logs command", () => {
	test("module exports logsCommand function", async () => {
		const mod = await import("../logs.ts");
		expect(typeof mod.logsCommand).toBe("function");
	});
});
