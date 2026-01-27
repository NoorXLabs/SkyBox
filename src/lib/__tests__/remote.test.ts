// src/lib/__tests__/remote.test.ts
import { describe, expect, test } from "bun:test";

describe("remote module", () => {
	test("exports checkRemoteProjectExists function", async () => {
		const { checkRemoteProjectExists } = await import("../remote.ts");
		expect(typeof checkRemoteProjectExists).toBe("function");
	});
});
