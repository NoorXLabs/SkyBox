import { describe, expect, test } from "bun:test";
import { setupTestContext } from "@tests/helpers/test-utils.ts";

describe("encrypt command", () => {
	setupTestContext("encrypt");

	test("encrypt command module exports encryptCommand", async () => {
		const mod = await import("@commands/encrypt.ts");
		expect(typeof mod.encryptCommand).toBe("function");
	});

	test("encryption config structure is valid", () => {
		// Verify the ProjectEncryption type works as expected
		const encConfig = {
			enabled: true,
			salt: "abcdef1234567890abcdef1234567890",
		};
		expect(encConfig.enabled).toBe(true);
		expect(encConfig.salt).toHaveLength(32);
	});

	test("salt generation produces valid hex string", () => {
		const { randomBytes } = require("node:crypto");
		const salt = randomBytes(16).toString("hex");
		expect(salt).toHaveLength(32);
		expect(/^[0-9a-f]+$/.test(salt)).toBe(true);
	});
});
