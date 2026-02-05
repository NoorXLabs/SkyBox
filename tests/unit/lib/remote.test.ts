// tests/unit/lib/remote.test.ts
import { describe, expect, test } from "bun:test";

describe("remote module", () => {
	test("exports checkRemoteProjectExists function", async () => {
		const { checkRemoteProjectExists } = await import("@lib/remote.ts");
		expect(typeof checkRemoteProjectExists).toBe("function");
	});
});
