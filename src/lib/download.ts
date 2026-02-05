/** Mutagen binary download and installation. */

import { createHash } from "node:crypto";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { MUTAGEN_REPO, MUTAGEN_VERSION } from "@lib/constants.ts";
import { getErrorMessage } from "@lib/errors.ts";
import {
	fetchMutagenPublicKey,
	fetchMutagenSignature,
	isGpgAvailable,
	verifyGpgSignature,
} from "@lib/gpg.ts";
import { getBinDir, getMutagenPath } from "@lib/paths.ts";
import { extract } from "tar";

/** Whether GPG verification is preferred (evaluated at call time, not module load). */
function isGpgPreferred(): boolean {
	return process.env.DEVBOX_SKIP_GPG !== "1";
}

export function getMutagenDownloadUrl(
	platform: string,
	arch: string,
	version: string,
): string {
	const os = platform === "darwin" ? "darwin" : "linux";
	const cpu = arch === "arm64" ? "arm64" : "amd64";
	return `https://github.com/${MUTAGEN_REPO}/releases/download/v${version}/mutagen_${os}_${cpu}_v${version}.tar.gz`;
}

/**
 * Parse a SHA256SUMS file and return the hash for the given filename.
 * Returns null if the filename is not found.
 */
export function parseSHA256Sums(
	content: string,
	filename: string,
): string | null {
	for (const line of content.split("\n")) {
		const parts = line.trim().split(/\s+/);
		if (parts.length === 2 && parts[1] === filename) {
			return parts[0];
		}
	}
	return null;
}

/**
 * Verify a buffer's SHA256 hash matches the expected value.
 */
export function verifyChecksum(data: Buffer, expectedHash: string): boolean {
	const actualHash = createHash("sha256").update(data).digest("hex");
	return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Fetch the SHA256SUMS file for a given Mutagen version.
 */
export async function fetchChecksums(version: string): Promise<string | null> {
	const url = getMutagenChecksumUrl(version);
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		return await response.text();
	} catch {
		return null;
	}
}

export function getMutagenChecksumUrl(version: string): string {
	return `https://github.com/${MUTAGEN_REPO}/releases/download/v${version}/SHA256SUMS`;
}

export function isMutagenInstalled(): boolean {
	const mutagenPath = getMutagenPath();
	if (!existsSync(mutagenPath)) {
		return false;
	}

	try {
		const result = Bun.spawnSync([mutagenPath, "version"]);
		return result.exitCode === 0;
	} catch {
		return false;
	}
}

export async function getInstalledMutagenVersion(): Promise<string | null> {
	const mutagenPath = getMutagenPath();
	if (!existsSync(mutagenPath)) return null;
	try {
		const result = Bun.spawnSync([mutagenPath, "version"]);
		if (result.exitCode === 0) {
			return result.stdout.toString().trim();
		}
		return null;
	} catch {
		return null;
	}
}

export async function downloadMutagen(
	onProgress?: (message: string) => void,
): Promise<{ success: boolean; error?: string }> {
	const platform = process.platform;
	const arch = process.arch;

	if (platform !== "darwin" && platform !== "linux") {
		return { success: false, error: `Unsupported platform: ${platform}` };
	}

	const os = platform === "darwin" ? "darwin" : "linux";
	const cpu = arch === "arm64" ? "arm64" : "amd64";
	const filename = `mutagen_${os}_${cpu}_v${MUTAGEN_VERSION}.tar.gz`;
	const url = getMutagenDownloadUrl(platform, arch, MUTAGEN_VERSION);
	const binDir = getBinDir();
	const tarPath = join(binDir, "mutagen.tar.gz");

	try {
		// Create bin directory with secure permissions
		if (!existsSync(binDir)) {
			mkdirSync(binDir, { recursive: true, mode: 0o700 });
		}

		// Fetch checksums first
		onProgress?.("Fetching checksums...");
		const checksumContent = await fetchChecksums(MUTAGEN_VERSION);
		if (!checksumContent) {
			return { success: false, error: "Failed to fetch checksums" };
		}

		// Verify checksums file GPG signature BEFORE trusting checksums
		// This ensures we verify the integrity of the checksum list before using it
		if (await isGpgAvailable()) {
			onProgress?.("Verifying GPG signature...");

			const [publicKey, gpgSignature] = await Promise.all([
				fetchMutagenPublicKey(),
				fetchMutagenSignature(MUTAGEN_VERSION),
			]);

			if (!publicKey || !gpgSignature) {
				if (isGpgPreferred()) {
					return {
						success: false,
						error: "Failed to fetch GPG key or signature",
					};
				}
				onProgress?.(
					"GPG signature unavailable - checksums not cryptographically verified",
				);
			} else {
				const gpgResult = await verifyGpgSignature(
					Buffer.from(checksumContent),
					gpgSignature,
					publicKey,
				);

				if (!gpgResult.verified) {
					if (isGpgPreferred()) {
						return {
							success: false,
							error: gpgResult.error || "GPG signature verification failed",
						};
					}
					onProgress?.(
						"GPG signature invalid - checksums not cryptographically verified",
					);
				} else {
					onProgress?.("GPG signature verified");
				}
			}
		} else {
			if (isGpgPreferred()) {
				onProgress?.("GPG not available - using checksum verification only");
			}
		}

		// Parse expected hash from verified checksums file
		const expectedHash = parseSHA256Sums(checksumContent, filename);
		if (!expectedHash) {
			return { success: false, error: `No checksum found for ${filename}` };
		}

		onProgress?.(`Downloading mutagen v${MUTAGEN_VERSION}...`);

		// Download tar.gz
		const response = await fetch(url);
		if (!response.ok) {
			return { success: false, error: `Download failed: ${response.status}` };
		}

		// Read entire response into buffer for checksum verification
		const arrayBuffer = await response.arrayBuffer();
		const downloadedBuffer = Buffer.from(arrayBuffer);

		// Verify checksum BEFORE writing to disk
		onProgress?.("Verifying checksum...");
		if (!verifyChecksum(downloadedBuffer, expectedHash)) {
			return {
				success: false,
				error:
					"Checksum verification failed - download may be corrupted or tampered",
			};
		}

		// Write verified file to disk
		writeFileSync(tarPath, downloadedBuffer, { mode: 0o600 });

		onProgress?.("Extracting...");

		// Extract tar.gz
		await extract({
			file: tarPath,
			cwd: binDir,
			filter: (path) => path === "mutagen" || path === "mutagen-agents.tar.gz",
		});

		// Make executable
		chmodSync(getMutagenPath(), 0o755);

		// Clean up tar file
		unlinkSync(tarPath);

		onProgress?.(`Installed mutagen v${MUTAGEN_VERSION}`);
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}
}
