import { describe, expect, test } from "bun:test";

describe("INSTALL_METHOD", () => {
	test("defaults to source when env var is not set", async () => {
		const { INSTALL_METHOD } = await import("../constants.ts");
		// In test/dev environment, env var is not set, so it should be "source"
		expect(INSTALL_METHOD).toBe("source");
	});
});
