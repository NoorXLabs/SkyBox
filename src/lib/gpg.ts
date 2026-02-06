/** GPG signature verification utilities. */

import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getErrorMessage } from "@lib/errors.ts";
import type { GpgVerifyResult, KeyFingerprintResult } from "@typedefs/index.ts";

const execFileAsync = promisify(execFile);

/** Import a GPG public key into a temporary keyring. */
async function importKeyToTempKeyring(
	publicKey: string,
): Promise<{ tempDir: string; keyringPath: string }> {
	const tempDir = mkdtempSync(join(tmpdir(), "skybox-gpg-"));
	const keyPath = join(tempDir, "key.asc");
	const keyringPath = join(tempDir, "keyring.gpg");
	writeFileSync(keyPath, publicKey, { mode: 0o600 });
	await execFileAsync("gpg", [
		"--no-default-keyring",
		"--keyring",
		keyringPath,
		"--batch",
		"--quiet",
		"--import",
		keyPath,
	]);
	return { tempDir, keyringPath };
}

/**
 * Check if GPG is available on the system.
 */
export async function isGpgAvailable(): Promise<boolean> {
	try {
		await execFileAsync("gpg", ["--version"]);
		return true;
	} catch {
		return false;
	}
}

/**
 * Verify a detached GPG signature.
 *
 * @param data - The data that was signed
 * @param signature - The detached signature
 * @param publicKey - The armored public key to verify against
 */
export async function verifyGpgSignature(
	data: Buffer,
	signature: Buffer,
	publicKey: string,
): Promise<GpgVerifyResult> {
	// Check if GPG is available
	if (!(await isGpgAvailable())) {
		return {
			verified: false,
			error:
				"GPG is not installed. Install GPG to enable signature verification.",
			gpgUnavailable: true,
		};
	}

	// Create a temporary directory for GPG operations and import key
	const { tempDir, keyringPath } = await importKeyToTempKeyring(publicKey);

	try {
		const dataPath = join(tempDir, "data");
		const sigPath = join(tempDir, "data.sig");

		// Write files with restricted permissions (owner-only read/write)
		writeFileSync(dataPath, data, { mode: 0o600 });
		writeFileSync(sigPath, signature, { mode: 0o600 });

		// Verify the signature
		await execFileAsync("gpg", [
			"--no-default-keyring",
			"--keyring",
			keyringPath,
			"--batch",
			"--quiet",
			"--verify",
			sigPath,
			dataPath,
		]);

		return { verified: true };
	} catch (err) {
		return {
			verified: false,
			error: `GPG verification failed: ${getErrorMessage(err)}`,
		};
	} finally {
		// Clean up temp directory
		rmSync(tempDir, { recursive: true, force: true });
	}
}

/**
 * Verify that a GPG public key matches the expected fingerprint.
 * Imports the key into a temporary keyring and checks the fingerprint.
 */
export async function verifyKeyFingerprint(
	publicKey: string,
	expectedFingerprint: string,
): Promise<KeyFingerprintResult> {
	if (!(await isGpgAvailable())) {
		return { matches: false, error: "GPG is not available" };
	}

	const { tempDir, keyringPath } = await importKeyToTempKeyring(publicKey);

	try {
		// List key fingerprints from the keyring
		const { stdout } = await execFileAsync("gpg", [
			"--no-default-keyring",
			"--keyring",
			keyringPath,
			"--batch",
			"--with-colons",
			"--fingerprint",
		]);

		// Parse fingerprint from colon-delimited output
		// Format: fpr:::::::::FINGERPRINT:
		const fprLines = stdout.split("\n").filter((l) => l.startsWith("fpr:"));
		const fingerprints = fprLines.map((l) => l.split(":")[9]);

		const normalizedExpected = expectedFingerprint
			.replace(/\s/g, "")
			.toUpperCase();
		const matches = fingerprints.some(
			(fp) => fp?.toUpperCase() === normalizedExpected,
		);

		return {
			matches,
			actualFingerprint: fingerprints[0] || "unknown",
		};
	} catch (err) {
		return {
			matches: false,
			error: `Failed to verify key fingerprint: ${getErrorMessage(err)}`,
		};
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}

/**
 * Fetch Mutagen's public GPG key from GitHub.
 *
 * TRUST MODEL: This fetches the key from GitHub's key hosting service.
 * The fetched key is verified against the pinned fingerprint (MUTAGEN_GPG_FINGERPRINT)
 * before use, preventing trust-on-first-use attacks.
 * @see MUTAGEN_GPG_FINGERPRINT in constants.ts
 */
export async function fetchMutagenPublicKey(): Promise<string | null> {
	try {
		const response = await fetch("https://github.com/mutagen-io.gpg");
		if (!response.ok) return null;
		return await response.text();
	} catch {
		return null;
	}
}

/**
 * Fetch the GPG signature for Mutagen checksums.
 */
export async function fetchMutagenSignature(
	version: string,
): Promise<Buffer | null> {
	try {
		const url = `https://github.com/mutagen-io/mutagen/releases/download/v${version}/SHA256SUMS.sig`;
		const response = await fetch(url);
		if (!response.ok) return null;
		const arrayBuffer = await response.arrayBuffer();
		return Buffer.from(arrayBuffer);
	} catch {
		return null;
	}
}
