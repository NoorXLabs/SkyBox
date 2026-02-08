// encryption utilities for SkyBox.
// provides AES-256-GCM encryption for both config values (string-based)
// and project archives (file-based).
// key derivation uses Argon2id (memory-hard KDF).

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
	ARGON2_LEGACY_PARALLELISM,
	ARGON2_LEGACY_TIME_COST,
	ARGON2_MEMORY_COST,
	ARGON2_PARALLELISM,
	ARGON2_TIME_COST,
	ENCRYPTION_ALGORITHM,
	ENCRYPTION_IV_LENGTH,
	ENCRYPTION_KEY_LENGTH,
	ENCRYPTION_TAG_LENGTH,
} from "@lib/constants.ts";
import argon2 from "argon2";

// derive a 256-bit key from a passphrase using Argon2id.
// memory-hard KDF for resistance to brute-force attacks.
export const deriveKey = async (
	passphrase: string,
	salt: string,
): Promise<Buffer> => {
	return argon2.hash(passphrase, {
		type: argon2.argon2id,
		salt: Buffer.from(salt, "hex"),
		memoryCost: ARGON2_MEMORY_COST,
		timeCost: ARGON2_TIME_COST,
		parallelism: ARGON2_PARALLELISM,
		hashLength: ENCRYPTION_KEY_LENGTH,
		raw: true,
	});
};

// derive a 256-bit key using legacy Argon2 parameters (pre-v0.7.7).
// used as a fallback when decryption with current parameters fails,
// indicating the data was encrypted before the OWASP parameter hardening.
export const deriveKeyLegacy = async (
	passphrase: string,
	salt: string,
): Promise<Buffer> => {
	return argon2.hash(passphrase, {
		type: argon2.argon2id,
		salt: Buffer.from(salt, "hex"),
		memoryCost: ARGON2_MEMORY_COST,
		timeCost: ARGON2_LEGACY_TIME_COST,
		parallelism: ARGON2_LEGACY_PARALLELISM,
		hashLength: ENCRYPTION_KEY_LENGTH,
		raw: true,
	});
};

// encrypt a plaintext string. Returns `ENC[base64...]` format.
// used for encrypting individual config values.
export const encrypt = (plaintext: string, key: Buffer): string => {
	const iv = randomBytes(ENCRYPTION_IV_LENGTH);
	const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf-8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
	return `ENC[${payload}]`;
};

// decrypt an `ENC[base64...]` string back to plaintext.
// used for decrypting individual config values.
export const decrypt = (ciphertext: string, key: Buffer): string => {
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
};

// check if a string is in `ENC[...]` encrypted format
export const isEncrypted = (value: string): boolean => {
	return value.startsWith("ENC[") && value.endsWith("]");
};

// encrypt a file using AES-256-GCM.
// output format: [IV: 16 bytes][encrypted data][auth tag: 16 bytes]
// used for encrypting project tar archives.
export const encryptFile = (
	inputPath: string,
	outputPath: string,
	key: Buffer,
): void => {
	const iv = randomBytes(ENCRYPTION_IV_LENGTH);
	const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
	const plaintext = readFileSync(inputPath);
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	writeFileSync(outputPath, Buffer.concat([iv, encrypted, tag]));
};

// decrypt a file encrypted with `encryptFile()`.
// reads IV from start, auth tag from end, decrypts the middle.
// throws on incorrect passphrase (GCM auth tag mismatch).
export const decryptFile = (
	inputPath: string,
	outputPath: string,
	key: Buffer,
): void => {
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
};

// decrypt an `ENC[base64...]` string with automatic legacy parameter fallback.
// first attempts decryption with the current key. If that fails (e.g., data was
// encrypted with pre-v0.7.7 Argon2 parameters), re-derives the key using legacy
// parameters and retries.
export const decryptWithFallback = async (
	ciphertext: string,
	passphrase: string,
	salt: string,
): Promise<string> => {
	const currentKey = await deriveKey(passphrase, salt);
	try {
		return decrypt(ciphertext, currentKey);
	} catch {
		const legacyKey = await deriveKeyLegacy(passphrase, salt);
		return decrypt(ciphertext, legacyKey);
	}
};

// decrypt a file with automatic legacy parameter fallback.
// first attempts decryption with the current key. If that fails (e.g., file was
// encrypted with pre-v0.7.7 Argon2 parameters), re-derives the key using legacy
// parameters and retries. Re-throws if both attempts fail.
export const decryptFileWithFallback = async (
	inputPath: string,
	outputPath: string,
	passphrase: string,
	salt: string,
): Promise<void> => {
	const currentKey = await deriveKey(passphrase, salt);
	try {
		decryptFile(inputPath, outputPath, currentKey);
	} catch {
		const legacyKey = await deriveKeyLegacy(passphrase, salt);
		decryptFile(inputPath, outputPath, legacyKey);
	}
};
