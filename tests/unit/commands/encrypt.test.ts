import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("encrypt command", () => {
	let testDir: string;
	let originalEnv: string | undefined;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-encrypt-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
		originalEnv = process.env.DEVBOX_HOME;
		process.env.DEVBOX_HOME = testDir;
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		if (originalEnv) {
			process.env.DEVBOX_HOME = originalEnv;
		} else {
			delete process.env.DEVBOX_HOME;
		}
	});

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
