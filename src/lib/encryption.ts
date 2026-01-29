import {
	createCipheriv,
	createDecipheriv,
	pbkdf2Sync,
	randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function deriveKey(passphrase: string, salt: string): Buffer {
	return pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, "sha512");
}

export function encrypt(plaintext: string, key: Buffer): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf-8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
	return `ENC[${payload}]`;
}

export function decrypt(ciphertext: string, key: Buffer): string {
	const payload = ciphertext.slice(4, -1); // strip ENC[...]
	const data = Buffer.from(payload, "base64");
	const iv = data.subarray(0, IV_LENGTH);
	const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
	const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(tag);
	return decipher.update(encrypted) + decipher.final("utf-8");
}

export function isEncrypted(value: string): boolean {
	return value.startsWith("ENC[") && value.endsWith("]");
}
