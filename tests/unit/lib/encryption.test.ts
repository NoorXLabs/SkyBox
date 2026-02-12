import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	ENCRYPTION_CHECK_CONTENT,
	ENCRYPTION_CHECK_FILENAME,
} from "@lib/constants.ts";
import {
	decrypt,
	decryptFile,
	deriveKey,
	encrypt,
	encryptFile,
	isEncrypted,
	resolveProjectKdf,
} from "@lib/encryption.ts";
import type { ProjectEncryption } from "@typedefs/index.ts";

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

	test("isEncrypted detects encrypted values", () => {
		expect(isEncrypted("ENC[abc123]")).toBe(true);
		expect(isEncrypted("plain text")).toBe(false);
	});

	test("encryptFile and decryptFile round-trip", async () => {
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

	test("ENCRYPTION_CHECK constants are exported", () => {
		expect(ENCRYPTION_CHECK_FILENAME).toBe(".skybox-enc-check");
		expect(ENCRYPTION_CHECK_CONTENT).toBe("skybox-encryption-verify");
	});

	test("deriveKey returns a 32-byte buffer", async () => {
		const key = await deriveKey(
			"test-passphrase",
			"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
		);
		expect(Buffer.isBuffer(key)).toBe(true);
		expect(key.length).toBe(32);
	});

	test("resolveProjectKdf defaults to scrypt when kdf is missing", () => {
		expect(
			resolveProjectKdf({
				enabled: true,
				salt: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
			}),
		).toBe("scrypt");
	});

	test("resolveProjectKdf accepts explicit scrypt metadata", () => {
		expect(
			resolveProjectKdf({
				enabled: true,
				kdf: "scrypt",
				kdfParamsVersion: 1,
			}),
		).toBe("scrypt");
	});

	test("resolveProjectKdf throws for unsupported kdf values", () => {
		expect(() =>
			resolveProjectKdf({ enabled: true, kdf: "legacy-kdf" as "scrypt" }),
		).toThrow("Unsupported encryption KDF");
	});

	test("resolveProjectKdf throws when kdf is present but empty", () => {
		expect(() =>
			resolveProjectKdf({ enabled: true, kdf: "" as "scrypt" }),
		).toThrow("Unsupported encryption KDF");
	});

	test("resolveProjectKdf throws when kdfParamsVersion is set without kdf", () => {
		expect(() =>
			resolveProjectKdf({
				enabled: true,
				kdfParamsVersion: 1,
			} as unknown as ProjectEncryption),
		).toThrow("kdfParamsVersion is set but kdf is missing");
	});

	test("resolveProjectKdf throws when kdfParamsVersion is missing", () => {
		expect(() => resolveProjectKdf({ enabled: true, kdf: "scrypt" })).toThrow(
			"Unsupported encryption KDF params version",
		);
	});

	test("resolveProjectKdf throws when kdfParamsVersion is unsupported", () => {
		expect(() =>
			resolveProjectKdf({
				enabled: true,
				kdf: "scrypt",
				kdfParamsVersion: 2 as 1,
			}),
		).toThrow("Unsupported encryption KDF params version");
	});
});
