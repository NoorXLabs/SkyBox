import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("encryption", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `skybox-enc-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("deriveKey produces consistent output for same passphrase", async () => {
		const { deriveKey } = await import("@lib/encryption.ts");
		const key1 = await deriveKey(
			"test-passphrase",
			"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
		);
		const key2 = await deriveKey(
			"test-passphrase",
			"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
		);
		expect(key1).toEqual(key2);
	});

	test("deriveKey produces different output for different passphrases", async () => {
		const { deriveKey } = await import("@lib/encryption.ts");
		const key1 = await deriveKey(
			"passphrase-a",
			"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
		);
		const key2 = await deriveKey(
			"passphrase-b",
			"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
		);
		expect(key1).not.toEqual(key2);
	});

	test("encrypt and decrypt round-trip", async () => {
		const { decrypt, deriveKey, encrypt } = await import("@lib/encryption.ts");
		const key = await deriveKey(
			"test-passphrase",
			"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
		);
		const plaintext = "sensitive SSH key content";
		const ciphertext = encrypt(plaintext, key);
		expect(ciphertext).not.toBe(plaintext);
		expect(ciphertext.startsWith("ENC[")).toBe(true);
		expect(ciphertext.endsWith("]")).toBe(true);

		const decrypted = decrypt(ciphertext, key);
		expect(decrypted).toBe(plaintext);
	});

	test("isEncrypted detects encrypted values", async () => {
		const { isEncrypted } = await import("@lib/encryption.ts");
		expect(isEncrypted("ENC[abc123]")).toBe(true);
		expect(isEncrypted("plain text")).toBe(false);
	});

	test("encryptFile and decryptFile round-trip", async () => {
		const { deriveKey, encryptFile, decryptFile } = await import(
			"@lib/encryption.ts"
		);
		const { writeFileSync, readFileSync } = await import("node:fs");
		const { join } = await import("node:path");

		const key = await deriveKey(
			"test-passphrase",
			"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
		);
		const inputPath = join(testDir, "input.tar");
		const encryptedPath = join(testDir, "input.tar.enc");
		const outputPath = join(testDir, "output.tar");

		// Create a test file with known content
		const content = Buffer.from(
			"This is a test tar archive content for encryption testing",
		);
		writeFileSync(inputPath, content);

		// Encrypt
		encryptFile(inputPath, encryptedPath, key);

		// Encrypted file should be different from original
		const encryptedContent = readFileSync(encryptedPath);
		expect(encryptedContent).not.toEqual(content);
		// Should be larger (IV + tag overhead)
		expect(encryptedContent.length).toBeGreaterThan(content.length);

		// Decrypt
		decryptFile(encryptedPath, outputPath, key);

		// Should match original
		const decryptedContent = readFileSync(outputPath);
		expect(decryptedContent).toEqual(content);
	});

	test("decryptFile throws on wrong passphrase", async () => {
		const { deriveKey, encryptFile, decryptFile } = await import(
			"@lib/encryption.ts"
		);
		const { writeFileSync } = await import("node:fs");
		const { join } = await import("node:path");

		const salt = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
		const correctKey = await deriveKey("correct-passphrase", salt);
		const wrongKey = await deriveKey("wrong-passphrase", salt);

		const inputPath = join(testDir, "input.tar");
		const encryptedPath = join(testDir, "input.tar.enc");
		const outputPath = join(testDir, "output.tar");

		writeFileSync(inputPath, Buffer.from("secret content"));
		encryptFile(inputPath, encryptedPath, correctKey);

		// Decrypting with wrong key should throw
		expect(() => decryptFile(encryptedPath, outputPath, wrongKey)).toThrow();
	});

	test("decryptFile throws on corrupted file", async () => {
		const { deriveKey, decryptFile } = await import("@lib/encryption.ts");
		const { writeFileSync } = await import("node:fs");
		const { join } = await import("node:path");

		const key = await deriveKey("test", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4");
		const corruptedPath = join(testDir, "corrupted.tar.enc");
		const outputPath = join(testDir, "output.tar");

		// File too small
		writeFileSync(corruptedPath, Buffer.from("short"));
		expect(() => decryptFile(corruptedPath, outputPath, key)).toThrow(
			"too small",
		);
	});

	test("encryptFile produces different output each time (random IV)", async () => {
		const { deriveKey, encryptFile } = await import("@lib/encryption.ts");
		const { writeFileSync, readFileSync } = await import("node:fs");
		const { join } = await import("node:path");

		const key = await deriveKey("test", "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4");
		const inputPath = join(testDir, "input.tar");
		const enc1Path = join(testDir, "enc1.tar.enc");
		const enc2Path = join(testDir, "enc2.tar.enc");

		writeFileSync(inputPath, Buffer.from("same content"));
		encryptFile(inputPath, enc1Path, key);
		encryptFile(inputPath, enc2Path, key);

		const enc1 = readFileSync(enc1Path);
		const enc2 = readFileSync(enc2Path);
		// Different IVs mean different ciphertext
		expect(enc1).not.toEqual(enc2);
	});

	test("ENCRYPTION_CHECK constants are exported", async () => {
		const { ENCRYPTION_CHECK_FILENAME, ENCRYPTION_CHECK_CONTENT } =
			await import("@lib/constants.ts");
		expect(ENCRYPTION_CHECK_FILENAME).toBe(".skybox-enc-check");
		expect(ENCRYPTION_CHECK_CONTENT).toBe("skybox-encryption-verify");
	});

	test("deriveKeyLegacy produces different key from deriveKey", async () => {
		const { deriveKey, deriveKeyLegacy } = await import("@lib/encryption.ts");
		const salt = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
		const currentKey = await deriveKey("test-passphrase", salt);
		const legacyKey = await deriveKeyLegacy("test-passphrase", salt);
		expect(currentKey).not.toEqual(legacyKey);
	});

	test("decryptWithFallback decrypts data encrypted with current params", async () => {
		const { deriveKey, encrypt, decryptWithFallback } = await import(
			"@lib/encryption.ts"
		);
		const salt = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
		const passphrase = "test-passphrase";
		const plaintext = "secret value";

		// Encrypt with current params
		const currentKey = await deriveKey(passphrase, salt);
		const ciphertext = encrypt(plaintext, currentKey);

		// Decrypt with fallback should succeed on first attempt
		const result = await decryptWithFallback(ciphertext, passphrase, salt);
		expect(result).toBe(plaintext);
	});

	test("decryptWithFallback decrypts data encrypted with legacy params", async () => {
		const { deriveKeyLegacy, encrypt, decryptWithFallback } = await import(
			"@lib/encryption.ts"
		);
		const salt = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
		const passphrase = "test-passphrase";
		const plaintext = "legacy secret value";

		// Encrypt with legacy params (simulates pre-v0.7.7 data)
		const legacyKey = await deriveKeyLegacy(passphrase, salt);
		const ciphertext = encrypt(plaintext, legacyKey);

		// Decrypt with fallback should fail with current params, then succeed with legacy
		const result = await decryptWithFallback(ciphertext, passphrase, salt);
		expect(result).toBe(plaintext);
	});

	test("decryptFileWithFallback decrypts file encrypted with current params", async () => {
		const { deriveKey, encryptFile, decryptFileWithFallback } = await import(
			"@lib/encryption.ts"
		);
		const { writeFileSync, readFileSync } = await import("node:fs");
		const { join } = await import("node:path");

		const salt = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
		const passphrase = "test-passphrase";
		const content = Buffer.from("current params file content");

		const inputPath = join(testDir, "current-input.tar");
		const encryptedPath = join(testDir, "current-input.tar.enc");
		const outputPath = join(testDir, "current-output.tar");

		writeFileSync(inputPath, content);
		const currentKey = await deriveKey(passphrase, salt);
		encryptFile(inputPath, encryptedPath, currentKey);

		await decryptFileWithFallback(encryptedPath, outputPath, passphrase, salt);
		expect(readFileSync(outputPath)).toEqual(content);
	});

	test("decryptFileWithFallback decrypts file encrypted with legacy params", async () => {
		const { deriveKeyLegacy, encryptFile, decryptFileWithFallback } =
			await import("@lib/encryption.ts");
		const { writeFileSync, readFileSync } = await import("node:fs");
		const { join } = await import("node:path");

		const salt = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";
		const passphrase = "test-passphrase";
		const content = Buffer.from("legacy params file content");

		const inputPath = join(testDir, "legacy-input.tar");
		const encryptedPath = join(testDir, "legacy-input.tar.enc");
		const outputPath = join(testDir, "legacy-output.tar");

		writeFileSync(inputPath, content);
		const legacyKey = await deriveKeyLegacy(passphrase, salt);
		encryptFile(inputPath, encryptedPath, legacyKey);

		await decryptFileWithFallback(encryptedPath, outputPath, passphrase, salt);
		expect(readFileSync(outputPath)).toEqual(content);
	});

	test("decryptWithFallback throws when both params fail", async () => {
		const { deriveKey, encrypt, decryptWithFallback } = await import(
			"@lib/encryption.ts"
		);
		const salt = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";

		// Encrypt with one passphrase
		const key = await deriveKey("correct-passphrase", salt);
		const ciphertext = encrypt("secret", key);

		// Decrypt with wrong passphrase should fail with both current and legacy params
		await expect(
			decryptWithFallback(ciphertext, "wrong-passphrase", salt),
		).rejects.toThrow();
	});
});
