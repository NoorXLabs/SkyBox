import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("encryption", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `devbox-enc-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("deriveKey produces consistent output for same passphrase", async () => {
		const { deriveKey } = await import("../encryption.ts");
		const key1 = deriveKey("test-passphrase", "salt123");
		const key2 = deriveKey("test-passphrase", "salt123");
		expect(key1).toEqual(key2);
	});

	test("deriveKey produces different output for different passphrases", async () => {
		const { deriveKey } = await import("../encryption.ts");
		const key1 = deriveKey("passphrase-a", "salt123");
		const key2 = deriveKey("passphrase-b", "salt123");
		expect(key1).not.toEqual(key2);
	});

	test("encrypt and decrypt round-trip", async () => {
		const { decrypt, deriveKey, encrypt } = await import("../encryption.ts");
		const key = deriveKey("test-passphrase", "salt123");
		const plaintext = "sensitive SSH key content";
		const ciphertext = encrypt(plaintext, key);
		expect(ciphertext).not.toBe(plaintext);
		expect(ciphertext.startsWith("ENC[")).toBe(true);
		expect(ciphertext.endsWith("]")).toBe(true);

		const decrypted = decrypt(ciphertext, key);
		expect(decrypted).toBe(plaintext);
	});

	test("isEncrypted detects encrypted values", async () => {
		const { isEncrypted } = await import("../encryption.ts");
		expect(isEncrypted("ENC[abc123]")).toBe(true);
		expect(isEncrypted("plain text")).toBe(false);
	});
});
