// Mutagen binary download and installation.

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
import { getMutagenPlatformInfo } from "@lib/mutagen-platform.ts";
import { getBinDir, getMutagenPath } from "@lib/paths.ts";
import { execa } from "execa";
import { extract } from "tar";

export { getMutagenPlatformInfo } from "@lib/mutagen-platform.ts";

// get mutagen download url
export const getMutagenDownloadUrl = (
	platform: string,
	arch: string,
	version: string,
): string => {
	const { os, cpu } = getMutagenPlatformInfo(platform, arch, version);
	return `https://github.com/${MUTAGEN_REPO}/releases/download/v${version}/mutagen_${os}_${cpu}_v${version}.tar.gz`;
};

// parse a SHA256SUMS file and return the hash for the given filename.
// returns null if the filename is not found.
export const parseSHA256Sums = (
	content: string,
	filename: string,
): string | null => {
	for (const line of content.split("\n")) {
		const parts = line.trim().split(/\s+/);
		if (parts.length === 2 && parts[1] === filename) {
			return parts[0];
		}
	}
	return null;
};

// verify a buffer's SHA256 hash matches the expected value.
export const verifyChecksum = (data: Buffer, expectedHash: string): boolean => {
	const actualHash = createHash("sha256").update(data).digest("hex");
	return actualHash.toLowerCase() === expectedHash.toLowerCase();
};

// fetch the SHA256SUMS file for a given Mutagen version.
export const fetchChecksums = async (
	version: string,
): Promise<string | null> => {
	const url = getMutagenChecksumUrl(version);
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		return await response.text();
	} catch {
		return null;
	}
};

// get mutagen checksum url
export const getMutagenChecksumUrl = (version: string): string => {
	return `https://github.com/${MUTAGEN_REPO}/releases/download/v${version}/SHA256SUMS`;
};

const probeInstalledMutagenVersion = async (): Promise<string | null> => {
	const mutagenPath = getMutagenPath();
	if (!existsSync(mutagenPath)) return null;

	try {
		const result = await execa(mutagenPath, ["version"]);
		return result.stdout.trim();
	} catch {
		return null;
	}
};

// is mutagen installed
export const isMutagenInstalled = async (): Promise<boolean> => {
	return (await probeInstalledMutagenVersion()) !== null;
};

// get installed mutagen version
export const getInstalledMutagenVersion = async (): Promise<string | null> => {
	return probeInstalledMutagenVersion();
};

// download and install the Mutagen binary with checksum verification
export const downloadMutagen = async (
	onProgress?: (message: string) => void,
): Promise<{ success: boolean; error?: string }> => {
	const platform = process.platform;
	const arch = process.arch;

	if (platform !== "darwin" && platform !== "linux") {
		return { success: false, error: `Unsupported platform: ${platform}` };
	}

	const { filename } = getMutagenPlatformInfo(platform, arch, MUTAGEN_VERSION);
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

		// Parse expected hash from checksums file
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
};
