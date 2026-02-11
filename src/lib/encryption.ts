// encryption utilities for SkyBox.
// provides AES-256-GCM encryption for both config values (string-based)
// and project archives (file-based).
// key derivation uses scrypt (memory-hard KDF).

import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scrypt as scryptCallback,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
	ENCRYPTION_ALGORITHM,
	ENCRYPTION_IV_LENGTH,
	ENCRYPTION_KEY_LENGTH,
	ENCRYPTION_TAG_LENGTH,
	SCRYPT_MAXMEM,
	SCRYPT_N,
	SCRYPT_P,
	SCRYPT_R,
} from "@lib/constants.ts";
import type { ProjectEncryption } from "@typedefs/index.ts";

const deriveKeyWithScrypt = async (
	passphrase: string,
	salt: Buffer,
): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		scryptCallback(
			passphrase,
			salt,
			ENCRYPTION_KEY_LENGTH,
			{
				N: SCRYPT_N,
				r: SCRYPT_R,
				p: SCRYPT_P,
				maxmem: SCRYPT_MAXMEM,
			},
			(err, derivedKey) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(Buffer.from(derivedKey));
			},
		);
	});
};

// resolve KDF metadata for a project config.
// missing kdf defaults to scrypt for backward compatibility.
export const resolveProjectKdf = (encryption?: ProjectEncryption): "scrypt" => {
	const metadata = encryption as
		| { kdf?: string; kdfParamsVersion?: number }
		| undefined;
	const configuredKdf = metadata?.kdf;
	const configuredKdfParamsVersion = metadata?.kdfParamsVersion;

	if (configuredKdf === undefined) {
		if (configuredKdfParamsVersion !== undefined) {
			throw new Error(
				"Invalid encryption metadata: kdfParamsVersion is set but kdf is missing. Disable and re-enable encryption for this project.",
			);
		}
		return "scrypt";
	}

	if (configuredKdf !== "scrypt") {
		throw new Error(
			`Unsupported encryption KDF '${configuredKdf}'. This version supports only 'scrypt'. Disable and re-enable encryption for this project.`,
		);
	}

	if (configuredKdfParamsVersion !== 1) {
		throw new Error(
			`Unsupported encryption KDF params version '${String(configuredKdfParamsVersion)}'. This version supports only kdfParamsVersion=1 for 'scrypt'. Disable and re-enable encryption for this project.`,
		);
	}

	return "scrypt";
};

// derive a 256-bit key from a passphrase using scrypt.
// memory-hard KDF for resistance to brute-force attacks.
export const deriveKey = async (
	passphrase: string,
	salt: string,
): Promise<Buffer> => {
	return deriveKeyWithScrypt(passphrase, Buffer.from(salt, "hex"));
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
