/**
 * Encryption utilities for DevBox.
 * Provides AES-256-GCM encryption for both config values (string-based)
 * and project archives (file-based).
 * Key derivation uses Argon2id (memory-hard KDF).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import argon2 from "argon2";
import {
	ARGON2_MEMORY_COST,
	ARGON2_PARALLELISM,
	ARGON2_TIME_COST,
	ENCRYPTION_ALGORITHM,
	ENCRYPTION_IV_LENGTH,
	ENCRYPTION_KEY_LENGTH,
	ENCRYPTION_TAG_LENGTH,
} from "./constants.ts";

// Re-export these constants for backward compatibility
export {
	ENCRYPTION_CHECK_CONTENT,
	ENCRYPTION_CHECK_FILENAME,
} from "./constants.ts";

/**
 * Derive a 256-bit key from a passphrase using Argon2id.
 * Memory-hard KDF for resistance to brute-force attacks.
 */
export async function deriveKey(
	passphrase: string,
	salt: string,
): Promise<Buffer> {
	return argon2.hash(passphrase, {
		type: argon2.argon2id,
		salt: Buffer.from(salt, "hex"),
		memoryCost: ARGON2_MEMORY_COST,
		timeCost: ARGON2_TIME_COST,
		parallelism: ARGON2_PARALLELISM,
		hashLength: ENCRYPTION_KEY_LENGTH,
		raw: true,
	});
}

/**
 * Encrypt a plaintext string. Returns `ENC[base64...]` format.
 * Used for encrypting individual config values.
 */
export function encrypt(plaintext: string, key: Buffer): string {
	const iv = randomBytes(ENCRYPTION_IV_LENGTH);
	const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf-8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
	return `ENC[${payload}]`;
}

/**
 * Decrypt an `ENC[base64...]` string back to plaintext.
 * Used for decrypting individual config values.
 */
export function decrypt(ciphertext: string, key: Buffer): string {
	const payload = ciphertext.slice(4, -1);
	const data = Buffer.from(payload, "base64");
	const iv = data.subarray(0, ENCRYPTION_IV_LENGTH);
	const tag = data.subarray(
		ENCRYPTION_IV_LENGTH,
		ENCRYPTION_IV_LENGTH + ENCRYPTION_TAG_LENGTH,
	);
	const encrypted = data.subarray(ENCRYPTION_IV_LENGTH + ENCRYPTION_TAG_LENGTH);
	const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
	decipher.setAuthTag(tag);
	return decipher.update(encrypted) + decipher.final("utf-8");
}

/** Check if a string is in `ENC[...]` encrypted format */
export function isEncrypted(value: string): boolean {
	return value.startsWith("ENC[") && value.endsWith("]");
}

/**
 * Encrypt a file using AES-256-GCM.
 * Output format: [IV: 16 bytes][encrypted data][auth tag: 16 bytes]
 * Used for encrypting project tar archives.
 */
export function encryptFile(
	inputPath: string,
	outputPath: string,
	key: Buffer,
): void {
	const iv = randomBytes(ENCRYPTION_IV_LENGTH);
	const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
	const plaintext = readFileSync(inputPath);
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	writeFileSync(outputPath, Buffer.concat([iv, encrypted, tag]));
}

/**
 * Decrypt a file encrypted with `encryptFile()`.
 * Reads IV from start, auth tag from end, decrypts the middle.
 * Throws on incorrect passphrase (GCM auth tag mismatch).
 */
export function decryptFile(
	inputPath: string,
	outputPath: string,
	key: Buffer,
): void {
	const data = readFileSync(inputPath);

	if (data.length < ENCRYPTION_IV_LENGTH + ENCRYPTION_TAG_LENGTH) {
		throw new Error("Encrypted file is too small to be valid");
	}

	const iv = data.subarray(0, ENCRYPTION_IV_LENGTH);
	const encrypted = data.subarray(
		ENCRYPTION_IV_LENGTH,
		data.length - ENCRYPTION_TAG_LENGTH,
	);
	const tag = data.subarray(data.length - ENCRYPTION_TAG_LENGTH);

	const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
	decipher.setAuthTag(tag);
	const decrypted = Buffer.concat([
		decipher.update(encrypted),
		decipher.final(),
	]);
	writeFileSync(outputPath, decrypted);
}
