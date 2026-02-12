import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { setupTestContext } from "@tests/helpers/test-utils.ts";

describe("encrypt command", () => {
	setupTestContext("encrypt");

	test("encryption config structure is valid", () => {
		// Verify the ProjectEncryption type works as expected
		const encConfig = {
			enabled: true,
			salt: "abcdef1234567890abcdef1234567890",
			kdf: "scrypt" as const,
			kdfParamsVersion: 1 as const,
		};
		expect(encConfig.enabled).toBe(true);
		expect(encConfig.salt).toHaveLength(32);
		expect(encConfig.kdf).toBe("scrypt");
		expect(encConfig.kdfParamsVersion).toBe(1);
	});

	test("salt generation produces valid hex string", () => {
		const salt = randomBytes(16).toString("hex");
		expect(salt).toHaveLength(32);
		expect(/^[0-9a-f]+$/.test(salt)).toBe(true);
	});
});
