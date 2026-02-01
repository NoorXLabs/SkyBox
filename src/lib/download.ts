/** Mutagen binary download and installation. */

import {
	chmodSync,
	createWriteStream,
	existsSync,
	mkdirSync,
	unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { MUTAGEN_REPO, MUTAGEN_VERSION } from "@lib/constants.ts";
import { getErrorMessage } from "@lib/errors.ts";
import { getBinDir, getMutagenPath } from "@lib/paths.ts";
import { extract } from "tar";

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

	const url = getMutagenDownloadUrl(platform, arch, MUTAGEN_VERSION);
	const binDir = getBinDir();
	const tarPath = join(binDir, "mutagen.tar.gz");

	try {
		// Create bin directory
		if (!existsSync(binDir)) {
			mkdirSync(binDir, { recursive: true });
		}

		onProgress?.(`Downloading mutagen v${MUTAGEN_VERSION}...`);

		// Download tar.gz
		const response = await fetch(url);
		if (!response.ok) {
			return { success: false, error: `Download failed: ${response.status}` };
		}

		// Write to file with proper error handling
		const reader = response.body?.getReader();

		if (!reader) {
			return { success: false, error: "Failed to read response body" };
		}

		await new Promise<void>((resolve, reject) => {
			const fileStream = createWriteStream(tarPath);

			fileStream.on("error", (err) => {
				reject(new Error(`Failed to write file: ${err.message}`));
			});

			fileStream.on("finish", () => {
				resolve();
			});

			(async () => {
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							fileStream.end();
							break;
						}
						fileStream.write(value);
					}
				} catch (err) {
					fileStream.destroy();
					reject(err);
				}
			})();
		});

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
