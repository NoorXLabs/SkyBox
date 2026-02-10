// bundled Mutagen binary extraction and version management.
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
import { getMutagenPlatformInfo } from "@lib/mutagen-platform.ts";
import {
	getBinDir,
	getMutagenPath,
	getMutagenVersionPath,
} from "@lib/paths.ts";
import { extract } from "tar";

// check if Mutagen needs to be extracted from the bundle.
// returns true if binary is missing or version doesn't match.
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

// record the currently extracted Mutagen version.
export const recordMutagenVersion = (): void => {
	const binDir = getBinDir();
	if (!existsSync(binDir)) {
		mkdirSync(binDir, { recursive: true });
	}
	writeFileSync(getMutagenVersionPath(), MUTAGEN_VERSION);
};

// get the expected asset filename for the current platform.
const getBundledAssetName = (): string => {
	return getMutagenPlatformInfo(process.platform, process.arch, MUTAGEN_VERSION)
		.filename;
};

// extract the bundled Mutagen binary.
// looks for the tarball in the compiled binary's asset directory.
// returns { success, error? }.
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
				error: `Bundled Mutagen asset not found at ${assetPath}. Run 'skybox doctor' to diagnose.`,
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

// ensure Mutagen is extracted and ready. Call before any Mutagen operation.
// in bundled mode, extracts from asset. In dev mode, falls through to download flow.
export const ensureMutagenExtracted = async (
	onProgress?: (message: string) => void,
): Promise<{ success: boolean; error?: string }> => {
	if (!needsMutagenExtraction()) {
		return { success: true };
	}
	return extractBundledMutagen(onProgress);
};
