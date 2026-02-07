/** Bundled Mutagen binary extraction and version management. */
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { MUTAGEN_VERSION } from "@lib/constants.ts";
import { getErrorMessage } from "@lib/errors.ts";
import {
	getBinDir,
	getMutagenPath,
	getMutagenVersionPath,
} from "@lib/paths.ts";
import { extract } from "tar";

/**
 * Check if Mutagen needs to be extracted from the bundle.
 * Returns true if binary is missing or version doesn't match.
 */
export const needsMutagenExtraction = (): boolean => {
	const mutagenPath = getMutagenPath();
	const versionPath = getMutagenVersionPath();

	if (!existsSync(mutagenPath)) return true;
	if (!existsSync(versionPath)) return true;

	try {
		const recorded = readFileSync(versionPath, "utf-8").trim();
		return recorded !== MUTAGEN_VERSION;
	} catch {
		return true;
	}
};

/**
 * Record the currently extracted Mutagen version.
 */
export const recordMutagenVersion = (): void => {
	const binDir = getBinDir();
	if (!existsSync(binDir)) {
		mkdirSync(binDir, { recursive: true });
	}
	writeFileSync(getMutagenVersionPath(), MUTAGEN_VERSION);
};

/**
 * Get the expected asset filename for the current platform.
 */
const getBundledAssetName = (): string => {
	const os = process.platform === "darwin" ? "darwin" : "linux";
	const cpu = process.arch === "arm64" ? "arm64" : "amd64";
	return `mutagen_${os}_${cpu}_v${MUTAGEN_VERSION}.tar.gz`;
};

/**
 * Extract the bundled Mutagen binary.
 * Looks for the tarball in the compiled binary's asset directory.
 * Returns { success, error? }.
 */
export const extractBundledMutagen = async (
	onProgress?: (message: string) => void,
): Promise<{ success: boolean; error?: string }> => {
	const binDir = getBinDir();
	const assetName = getBundledAssetName();

	try {
		if (!existsSync(binDir)) {
			mkdirSync(binDir, { recursive: true });
		}

		onProgress?.("Extracting bundled Mutagen...");

		// In a Bun-compiled binary, import.meta.dir resolves to the executable's directory.
		// In dev mode, it resolves to the source file's directory.
		// We check both the compiled location (next to executable) and the dev location.
		const compiledDir = join(import.meta.dir, "vendor", "mutagen");
		const devDir = join(import.meta.dir, "..", "..", "vendor", "mutagen");
		const compiledPath = join(compiledDir, assetName);
		const devPath = join(devDir, assetName);
		const assetPath = existsSync(compiledPath) ? compiledPath : devPath;

		if (!existsSync(assetPath)) {
			return {
				success: false,
				error: `Bundled Mutagen asset not found at ${assetPath}. Run 'skybox update' to download.`,
			};
		}

		await extract({
			file: assetPath,
			cwd: binDir,
			filter: (path) => path === "mutagen" || path === "mutagen-agents.tar.gz",
		});

		chmodSync(getMutagenPath(), 0o755);
		recordMutagenVersion();

		onProgress?.(`Extracted Mutagen v${MUTAGEN_VERSION}`);
		return { success: true };
	} catch (error: unknown) {
		return { success: false, error: getErrorMessage(error) };
	}
};

/**
 * Ensure Mutagen is extracted and ready. Call before any Mutagen operation.
 * In bundled mode, extracts from asset. In dev mode, falls through to download flow.
 */
export const ensureMutagenExtracted = async (
	onProgress?: (message: string) => void,
): Promise<{ success: boolean; error?: string }> => {
	if (!needsMutagenExtraction()) {
		return { success: true };
	}
	return extractBundledMutagen(onProgress);
};
