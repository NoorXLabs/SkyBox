/** GPG signature verification utilities. */

import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { getErrorMessage } from "@lib/errors.ts";

const execFileAsync = promisify(execFile);

export interface GpgVerifyResult {
	verified: boolean;
	error?: string;
	gpgUnavailable?: boolean;
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

	// Create a temporary directory for GPG operations
	const tempDir = mkdtempSync(join(tmpdir(), "devbox-gpg-"));

	try {
		const dataPath = join(tempDir, "data");
		const sigPath = join(tempDir, "data.sig");
		const keyPath = join(tempDir, "key.asc");
		const keyringPath = join(tempDir, "keyring.gpg");

		// Write files with restricted permissions (owner-only read/write)
		writeFileSync(dataPath, data, { mode: 0o600 });
		writeFileSync(sigPath, signature, { mode: 0o600 });
		writeFileSync(keyPath, publicKey, { mode: 0o600 });

		// Import the key to a temporary keyring
		await execFileAsync("gpg", [
			"--no-default-keyring",
			"--keyring",
			keyringPath,
			"--batch",
			"--quiet",
			"--import",
			keyPath,
		]);

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
 * Fetch Mutagen's public GPG key from GitHub.
 *
 * TRUST MODEL: This fetches the key from GitHub's key hosting service.
 * Users implicitly trust that GitHub's infrastructure hasn't been compromised.
 * For higher security requirements, the key could be embedded in the codebase,
 * though this trades off the ability to rotate keys without code updates.
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
