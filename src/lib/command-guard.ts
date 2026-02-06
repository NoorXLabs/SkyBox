import { configExists, loadConfig } from "@lib/config.ts";
import { error, info } from "@lib/ui.ts";
import type { SkyboxConfigV2 } from "@typedefs/index.ts";

export function exitWithError(message: string, code = 1): never {
	error(message);
	process.exit(code);
}

export function exitWithErrorAndInfo(
	errorMessage: string,
	infoMessage: string,
	code = 1,
): never {
	error(errorMessage);
	info(infoMessage);
	process.exit(code);
}

export function requireLoadedConfigOrExit(): SkyboxConfigV2 {
	if (!configExists()) {
		exitWithError("skybox not configured. Run 'skybox init' first.");
	}

	const config = loadConfig();
	if (!config) {
		exitWithError("Failed to load config.");
	}

	return config;
}
