// src/lib/download.ts
import {
	chmodSync,
	createWriteStream,
	existsSync,
	mkdirSync,
	unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { extract } from "tar";
import { getErrorMessage } from "./errors.ts";
import { BIN_DIR, MUTAGEN_PATH } from "./paths.ts";

const MUTAGEN_VERSION = "0.17.5";
const MUTAGEN_REPO = "mutagen-io/mutagen";

export function getMutagenDownloadUrl(
	platform: string,
	arch: string,
	version: string,
): string {
	const os = platform === "darwin" ? "darwin" : "linux";
	const cpu = arch === "arm64" ? "arm64" : "amd64";
	return `https://github.com/${MUTAGEN_REPO}/releases/download/v${version}/mutagen_${os}_${cpu}_v${version}.tar.gz`;
}

export function getMutagenChecksumUrl(version: string): string {
	return `https://github.com/${MUTAGEN_REPO}/releases/download/v${version}/SHA256SUMS`;
}

export function isMutagenInstalled(): boolean {
	if (!existsSync(MUTAGEN_PATH)) {
		return false;
	}

	try {
		const result = Bun.spawnSync([MUTAGEN_PATH, "version"]);
		return result.exitCode === 0;
	} catch {
		return false;
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
	const tarPath = join(BIN_DIR, "mutagen.tar.gz");

	try {
		// Create bin directory
		if (!existsSync(BIN_DIR)) {
			mkdirSync(BIN_DIR, { recursive: true });
		}

		onProgress?.(`Downloading mutagen v${MUTAGEN_VERSION}...`);

		// Download tar.gz
		const response = await fetch(url);
		if (!response.ok) {
			return { success: false, error: `Download failed: ${response.status}` };
		}

		// Write to file
		const fileStream = createWriteStream(tarPath);
		const reader = response.body?.getReader();

		if (!reader) {
			return { success: false, error: "Failed to read response body" };
		}

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			fileStream.write(value);
		}
		fileStream.close();

		onProgress?.("Extracting...");

		// Extract tar.gz
		await extract({
			file: tarPath,
			cwd: BIN_DIR,
			filter: (path) => path === "mutagen" || path === "mutagen-agents.tar.gz",
		});

		// Make executable
		chmodSync(MUTAGEN_PATH, 0o755);

		// Clean up tar file
		unlinkSync(tarPath);

		onProgress?.(`Installed mutagen v${MUTAGEN_VERSION}`);
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}
}
